import { db } from '../../db/connect.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { writeAuditLog } from './auditLogs.controller.js';
import {
  canActorChangeUserRole,
  canActorCreateUserRole,
  canActorManageUserRole,
} from '../../config/permissions.js';
import { assertSellerProjectRatesFollowHierarchy } from './sellerRateHierarchy.service.js';

const userRoles = new Set(['super_admin', 'admin', 'broker_network_manager', 'broker', 'manager', 'agent']);

const sellerRoles = new Set([
  'broker_network_manager',
  'broker',
  'manager',
  'agent',
]);

const roleDefaultRates = {
  broker_network_manager: 8,
  broker: 7,
  manager: 5,
  agent: 3,
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const getErrorMessage = (error) => {
  if (error?.statusCode && error?.message) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') return 'Email already exists.';
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) return 'Database operation failed. Please try again.';
  return error?.message || 'Something went wrong.';
};

const buildFullNameSql = (alias = 'u') => {
  return `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;
};

const getRoleDefaultRate = (role) => Number(roleDefaultRates[role] ?? 0);

const normalizeStatus = (status) => (status === 'inactive' ? 'inactive' : 'active');

const buildPersonName = (user = {}) => {
  return [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || 'User';
};

const denyUserManagement = (res, message) => res.status(403).json({
  success: false,
  message,
});

const actorCanManageTargetRole = (req, targetRole) =>
  canActorManageUserRole(req.authUser?.role, targetRole);

const actorCanCreateTargetRole = (req, targetRole) =>
  canActorCreateUserRole(req.authUser?.role, targetRole);

const actorCanChangeTargetRole = (req, currentRole, requestedRole) =>
  canActorChangeUserRole(req.authUser?.role, currentRole, requestedRole);

const validateRequestedRole = (role) => userRoles.has(String(role || ''));

const getActiveLotProjects = async (connection = db) => {
  const [projects] = await connection.query(`
    SELECT
      lot_project_id,
      lot_project_name,
      lot_project_slug,
      lot_project_location_code
    FROM lot_projects
    WHERE lot_project_status = 'active'
    ORDER BY lot_project_name ASC
  `);

  return projects;
};

const normalizeProjectRates = (projectRates = [], projects = [], defaultRate = 0) => {
  const rateMap = new Map(
    Array.isArray(projectRates)
      ? projectRates
          .map((item) => [Number(item.lot_project_id), Number(item.accredited_seller_project_rate ?? item.rate ?? item.seller_rate ?? defaultRate)])
          .filter(([projectId, rate]) => projectId && !Number.isNaN(rate))
      : []
  );

  return projects.map((project) => ({
    lot_project_id: Number(project.lot_project_id),
    accredited_seller_project_rate: rateMap.has(Number(project.lot_project_id))
      ? Number(rateMap.get(Number(project.lot_project_id)))
      : defaultRate,
  }));
};

const upsertAccreditedProjectRates = async (connection, accreditedSellerId, projectRates) => {
  if (!projectRates.length) return;

  await connection.query(
    `
      INSERT INTO accredited_seller_lot_project_rates (
        accredited_seller_id,
        lot_project_id,
        accredited_seller_project_rate,
        accredited_seller_lot_project_rate_status
      ) VALUES ${projectRates.map(() => '(?, ?, ?, "active")').join(', ')}
      ON DUPLICATE KEY UPDATE
        accredited_seller_project_rate = VALUES(accredited_seller_project_rate),
        accredited_seller_lot_project_rate_status = 'active'
    `,
    projectRates.flatMap((rate) => [
      accreditedSellerId,
      rate.lot_project_id,
      Number(rate.accredited_seller_project_rate || 0),
    ])
  );
};

const syncManagedSellerLink = async (connection, accreditedSellerId, reportsUnderUserId) => {
  await connection.query(
    `DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?`,
    [accreditedSellerId]
  );

  if (!reportsUnderUserId) return;

  const [parentRows] = await connection.query(
    `
      SELECT accredited_seller_id
      FROM accredited_sellers
      WHERE user_id = ?
      LIMIT 1
    `,
    [reportsUnderUserId]
  );

  const parentAccreditedSellerId = parentRows[0]?.accredited_seller_id;
  if (!parentAccreditedSellerId) return;

  await connection.query(
    `
      INSERT INTO accredited_seller_managed_sellers (
        manager_accredited_seller_id,
        managed_accredited_seller_id
      ) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE updated_at = NOW()
    `,
    [parentAccreditedSellerId, accreditedSellerId]
  );
};

const getUserSelectSql = () => `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.middle_name,
    ${buildFullNameSql('u')} AS full_name,
    u.contact_no,
    u.tin_no,
    u.prc_no,
    u.address,
    u.email,
    u.role,
    u.status,
    u.must_change_password,
    u.last_login,
    u.created_at,
    u.updated_at,
    a.accredited_seller_id,
    a.seller_group_id,
    sg.seller_group_name,
    a.accredited_seller_reports_under_user_id AS reports_under_user_id,
    ${buildFullNameSql('parent')} AS reports_under_name,
    parent.role AS reports_under_role,
    a.accredited_seller_accreditation_date AS accreditation_date,
    a.accredited_seller_status
  FROM users u
  LEFT JOIN accredited_sellers a ON a.user_id = u.id
  LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
  LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
`;

const hydrateUserProjectRates = async (users) => {
  const accreditedSellerIds = users.map((user) => user.accredited_seller_id).filter(Boolean);

  if (!accreditedSellerIds.length) {
    return users.map((user) => ({ ...user, project_rates: [] }));
  }

  const placeholders = accreditedSellerIds.map(() => '?').join(', ');
  const [rateRows] = await db.query(
    `
      SELECT
        asr.accredited_seller_id,
        asr.lot_project_id,
        lp.lot_project_name,
        lp.lot_project_slug,
        lp.lot_project_location_code,
        asr.accredited_seller_project_rate,
        asr.accredited_seller_lot_project_rate_status
      FROM accredited_seller_lot_project_rates asr
      INNER JOIN lot_projects lp ON lp.lot_project_id = asr.lot_project_id
      WHERE asr.accredited_seller_id IN (${placeholders})
      ORDER BY lp.lot_project_name ASC
    `,
    accreditedSellerIds
  );

  const rateMap = new Map();
  rateRows.forEach((rate) => {
    if (!rateMap.has(rate.accredited_seller_id)) rateMap.set(rate.accredited_seller_id, []);
    rateMap.get(rate.accredited_seller_id).push(rate);
  });

  return users.map((user) => ({
    ...user,
    project_rates: rateMap.get(user.accredited_seller_id) || [],
  }));
};

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  const [rows] = await db.query(
    `
      SELECT
        id,
        first_name,
        last_name,
        middle_name,
        contact_no,
        tin_no,
        prc_no,
        address,
        email,
        password_hash,
        role,
        status,
        must_change_password,
        last_login,
        created_at,
        updated_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [String(email).trim()]
  );

  const user = rows[0];

  if (!user) return res.status(401).json({ message: 'Email does not exist!' });
  if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active' });

  const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);

  if (!isPasswordCorrect) return res.status(401).json({ message: 'Wrong password' });

  const token = jwt.sign(
    { id: user.id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24,
  });

  await db.query(`UPDATE users SET last_login = NOW() WHERE id = ?`, [user.id]);

  await writeAuditLog(db, req, {
    actor: user,
    action: 'login',
    module: 'Authentication',
    entityType: 'user',
    entityId: String(user.id),
    entityLabel: buildPersonName(user),
    title: 'User logged in',
    description: `${user.email} logged in successfully.`,
  });

  return res.status(200).json({
    message: user.must_change_password
      ? 'Login successful. Password change is required.'
      : 'Login successful',
    user: {
      id: user.id,
      first_name: user.first_name,
      last_name: user.last_name,
      middle_name: user.middle_name,
      contact_no: user.contact_no,
      tin_no: user.tin_no,
      prc_no: user.prc_no,
      address: user.address,
      email: user.email,
      role: user.role,
      status: user.status,
      must_change_password: Boolean(user.must_change_password),
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at,
    },
  });
};

export const logout = async (req, res) => {
  try {
    await writeAuditLog(db, req, {
      action: 'logout',
      module: 'Authentication',
      title: 'User logged out',
      description: 'User ended the current session.',
    });

    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return res.status(200).json({ message: 'Logged out successfully' });
  } catch {
    return res.status(500).json({ message: 'Logout failed' });
  }
};

export const getMe = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const [rows] = await db.query(
      `
        SELECT
          id,
          first_name,
          last_name,
          middle_name,
          contact_no,
          tin_no,
          email,
          role,
          status,
          must_change_password,
          last_login,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [decoded.id]
    );

    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ user, message: 'Successfully getMe :3' });
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};


export const changePassword = async (req, res) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: 'You must be logged in to change your password.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = Number(decoded.id);

    if (!userId) return res.status(401).json({ message: 'Invalid or expired session.' });

    const currentPassword = String(req.body.current_password ?? req.body.currentPassword ?? '');
    const newPassword = String(req.body.new_password ?? req.body.newPassword ?? '');
    const confirmPassword = String(req.body.confirm_password ?? req.body.confirmPassword ?? '');

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({ message: 'Current password, new password, and confirmation are required.' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match.' });
    }

    if (newPassword === currentPassword) {
      return res.status(400).json({ message: 'New password must be different from the current password.' });
    }

    if (newPassword.toLowerCase() === 'password') {
      return res.status(400).json({ message: 'Do not use the temporary default password.' });
    }

    const [rows] = await db.query(
      `
        SELECT
          id,
          first_name,
          middle_name,
          last_name,
          contact_no,
          tin_no,
          prc_no,
          address,
          email,
          password_hash,
          role,
          status,
          must_change_password,
          last_login,
          created_at,
          updated_at
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.status !== 'active') return res.status(403).json({ message: 'Account is not active.' });

    const isCurrentPasswordCorrect = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isCurrentPasswordCorrect) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await db.query(
      `
        UPDATE users
        SET password_hash = ?, must_change_password = 0, updated_at = NOW()
        WHERE id = ?
      `,
      [passwordHash, userId]
    );

    await writeAuditLog(db, req, {
      actor: user,
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: buildPersonName(user),
      title: 'Changed password',
      description: 'User changed their password after a reset requirement.',
      metadata: { previousMustChangePassword: Boolean(user.must_change_password) },
    });

    return res.json({
      message: 'Password changed successfully.',
      user: {
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        middle_name: user.middle_name,
        contact_no: user.contact_no,
        tin_no: user.tin_no,
        email: user.email,
        role: user.role,
        status: user.status,
        must_change_password: false,
        last_login: user.last_login,
        created_at: user.created_at,
        updated_at: user.updated_at,
      },
    });
  } catch (error) {
    if (error?.name === 'JsonWebTokenError' || error?.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Invalid or expired session.' });
    }

    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const getUsers = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const role = String(req.query.role || 'all');
    const status = String(req.query.status || 'all');

    const where = [];
    const params = [];

    if (search) {
      where.push(`(
        ${buildFullNameSql('u')} LIKE ? OR
        u.email LIKE ? OR
        IFNULL(u.contact_no, '') LIKE ? OR
        IFNULL(u.tin_no, '') LIKE ? OR
        IFNULL(u.prc_no, '') LIKE ? OR
        IFNULL(u.address, '') LIKE ? OR
        IFNULL(sg.seller_group_name, '') LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword, keyword, keyword, keyword);
    }

    if (role !== 'all') {
      where.push('u.role = ?');
      params.push(role);
    }

    if (status !== 'all') {
      where.push('u.status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM users u
        LEFT JOIN accredited_sellers a ON a.user_id = u.id
        LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
        ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const [rows] = await db.query(
      `
        ${getUserSelectSql()}
        ${whereSql}
        ORDER BY u.created_at DESC, u.id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const hydratedRows = await hydrateUserProjectRates(rows);

    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'active') AS active,
        SUM(status = 'inactive') AS inactive,
        SUM(must_change_password = 1) AS mustChangePassword
      FROM users
    `);

    return res.json({
      data: hydratedRows,
      summary: {
        total: Number(summaryRows[0]?.total || 0),
        active: Number(summaryRows[0]?.active || 0),
        inactive: Number(summaryRows[0]?.inactive || 0),
        mustChangePassword: Number(summaryRows[0]?.mustChangePassword || 0),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const createUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      first_name,
      last_name,
      middle_name,
      contact_no,
      tin_no,
      prc_no,
      address,
      email,
      password = 'password',
      role = 'agent',
      status = 'active',
      seller_group_id,
      reports_under_user_id,
      accreditation_date,
      project_rates = [],
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'First name, last name, and email are required.' });
    }
    if (!validateRequestedRole(role)) {
      return res.status(400).json({ message: 'Select a valid user role.' });
    }
    if (!actorCanCreateTargetRole(req, role)) {
      return denyUserManagement(res, 'Admin can create seller accounts only. Admin and Super Admin accounts can only be created by a Super Admin.');
    }

    await connection.beginTransaction();

    const passwordHash = await bcrypt.hash(String(password), 10);

    const [result] = await connection.query(
      `
        INSERT INTO users (
          first_name,
          last_name,
          middle_name,
          contact_no,
          tin_no,
          prc_no,
          address,
          email,
          password_hash,
          role,
          status,
          must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        first_name.trim(),
        last_name.trim(),
        middle_name?.trim() || null,
        contact_no?.trim() || null,
        tin_no?.trim() || null,
        prc_no?.trim() || null,
        address?.trim() || null,
        email.trim(),
        passwordHash,
        role,
        normalizeStatus(status),
      ]
    );

    const userId = result.insertId;
    let accreditedSellerId = null;

    if (sellerRoles.has(role)) {
      const [sellerResult] = await connection.query(
        `
          INSERT INTO accredited_sellers (
            user_id,
            seller_group_id,
            accredited_seller_reports_under_user_id,
            accredited_seller_accreditation_date,
            accredited_seller_status
          ) VALUES (?, ?, ?, ?, ?)
        `,
        [
          userId,
          toNullableNumber(seller_group_id),
          role === 'broker_network_manager' ? null : toNullableNumber(reports_under_user_id),
          accreditation_date || new Date().toISOString().slice(0, 10),
          normalizeStatus(status),
        ]
      );

      accreditedSellerId = sellerResult.insertId;
      const projects = await getActiveLotProjects(connection);
      const normalizedRates = normalizeProjectRates(project_rates, projects, getRoleDefaultRate(role));

      // New seller rates must already fit the selected reporting hierarchy.
      // The transaction is rolled back when a child rate exceeds its parent.
      await assertSellerProjectRatesFollowHierarchy(connection, accreditedSellerId, normalizedRates);
      await upsertAccreditedProjectRates(connection, accreditedSellerId, normalizedRates);
      await syncManagedSellerLink(connection, accreditedSellerId, role === 'broker_network_manager' ? null : toNullableNumber(reports_under_user_id));
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: `${first_name.trim()} ${last_name.trim()}`,
      title: 'Created user account',
      description: `Created account for ${first_name.trim()} ${last_name.trim()} (${email.trim()}).`,
      metadata: { role, status: normalizeStatus(status), seller_group_id, reports_under_user_id },
    });

    if (accreditedSellerId) {
      await writeAuditLog(connection, req, {
        action: 'create',
        module: 'Accreditation',
        entityType: 'accredited_seller',
        entityId: String(accreditedSellerId),
        entityLabel: `${first_name.trim()} ${last_name.trim()}`,
        title: 'Accredited seller',
        description: `Accredited ${first_name.trim()} ${last_name.trim()} as ${role}.`,
        metadata: { role, status: normalizeStatus(status), seller_group_id, reports_under_user_id },
      });
    }

    await connection.commit();

    return res.status(201).json({ message: 'User created successfully.', user_id: userId });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const editUser = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const userId = Number(req.params.id);

    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    const {
      first_name,
      last_name,
      middle_name,
      contact_no,
      tin_no,
      prc_no,
      address,
      email,
      role,
      status,
      seller_group_id,
      reports_under_user_id,
      accreditation_date,
      project_rates = [],
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'First name, last name, and email are required.' });
    }
    if (!validateRequestedRole(role)) {
      return res.status(400).json({ message: 'Select a valid user role.' });
    }

    const [targetRows] = await connection.query(
      `SELECT id, role FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const targetUser = targetRows[0];
    if (!targetUser) return res.status(404).json({ message: 'User not found.' });

    if (!actorCanManageTargetRole(req, targetUser.role)) {
      return denyUserManagement(res, 'You do not have permission to edit this account.');
    }

    if (!actorCanChangeTargetRole(req, targetUser.role, role)) {
      return denyUserManagement(
        res,
        'Admin cannot create or assign Admin and Super Admin roles. Existing privileged accounts must keep their current role.'
      );
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE users
        SET
          first_name = ?,
          last_name = ?,
          middle_name = ?,
          contact_no = ?,
          tin_no = ?,
          prc_no = ?,
          address = ?,
          email = ?,
          role = ?,
          status = ?
        WHERE id = ?
      `,
      [
        first_name.trim(),
        last_name.trim(),
        middle_name?.trim() || null,
        contact_no?.trim() || null,
        tin_no?.trim() || null,
        prc_no?.trim() || null,
        address?.trim() || null,
        email.trim(),
        role,
        normalizeStatus(status),
        userId,
      ]
    );

    let accreditedSellerId = null;

    if (sellerRoles.has(role)) {
      await connection.query(
        `
          INSERT INTO accredited_sellers (
            user_id,
            seller_group_id,
            accredited_seller_reports_under_user_id,
            accredited_seller_accreditation_date,
            accredited_seller_status
          ) VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            seller_group_id = VALUES(seller_group_id),
            accredited_seller_reports_under_user_id = VALUES(accredited_seller_reports_under_user_id),
            accredited_seller_accreditation_date = VALUES(accredited_seller_accreditation_date),
            accredited_seller_status = VALUES(accredited_seller_status)
        `,
        [
          userId,
          toNullableNumber(seller_group_id),
          role === 'broker_network_manager' ? null : toNullableNumber(reports_under_user_id),
          accreditation_date || new Date().toISOString().slice(0, 10),
          normalizeStatus(status),
        ]
      );

      const [sellerRows] = await connection.query(
        `SELECT accredited_seller_id FROM accredited_sellers WHERE user_id = ? LIMIT 1`,
        [userId]
      );

      accreditedSellerId = sellerRows[0]?.accredited_seller_id;
      const projects = await getActiveLotProjects(connection);
      const normalizedRates = normalizeProjectRates(project_rates, projects, getRoleDefaultRate(role));

      // New seller rates must already fit the selected reporting hierarchy.
      // The transaction is rolled back when a child rate exceeds its parent.
      await assertSellerProjectRatesFollowHierarchy(connection, accreditedSellerId, normalizedRates);
      await upsertAccreditedProjectRates(connection, accreditedSellerId, normalizedRates);
      await syncManagedSellerLink(connection, accreditedSellerId, role === 'broker_network_manager' ? null : toNullableNumber(reports_under_user_id));
    } else {
      await connection.query(`DELETE FROM accredited_sellers WHERE user_id = ?`, [userId]);
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: `${first_name.trim()} ${last_name.trim()}`,
      title: 'Updated user account',
      description: `Updated account for ${first_name.trim()} ${last_name.trim()} (${email.trim()}).`,
      metadata: { role, status: normalizeStatus(status), seller_group_id, reports_under_user_id },
    });

    if (accreditedSellerId) {
      await writeAuditLog(connection, req, {
        action: 'update',
        module: 'Accreditation',
        entityType: 'accredited_seller',
        entityId: String(accreditedSellerId),
        entityLabel: `${first_name.trim()} ${last_name.trim()}`,
        title: 'Updated accreditation',
        description: `Updated accreditation for ${first_name.trim()} ${last_name.trim()}.`,
        metadata: { role, status: normalizeStatus(status), seller_group_id, reports_under_user_id },
      });
    }

    await connection.commit();

    return res.json({ message: 'User updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    const [rows] = await db.query(
      `SELECT id, first_name, middle_name, last_name, email, role, status FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!actorCanManageTargetRole(req, user.role)) {
      return denyUserManagement(res, 'You do not have permission to activate or deactivate this account.');
    }

    const nextStatus = normalizeStatus(req.body.status || (user.status === 'active' ? 'inactive' : 'active'));

    await db.query(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, userId]);
    await db.query(
      `UPDATE accredited_sellers SET accredited_seller_status = ? WHERE user_id = ?`,
      [nextStatus, userId]
    );

    await writeAuditLog(db, req, {
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: buildPersonName(user),
      title: 'Changed user account status',
      description: `User account status changed to ${nextStatus}.`,
      metadata: { previousStatus: user.status, nextStatus },
    });

    return res.json({ message: `User is now ${nextStatus}.`, status: nextStatus });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};

export const resetUserPassword = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    const newPassword = req.body.password || 'password';

    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    const [rows] = await db.query(
      `SELECT id, first_name, middle_name, last_name, email, role FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (!actorCanManageTargetRole(req, user.role)) {
      return denyUserManagement(res, 'You do not have permission to reset this account password.');
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await db.query(
      `UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
      [passwordHash, userId]
    );

    await writeAuditLog(db, req, {
      action: 'update',
      module: 'Users',
      entityType: 'user',
      entityId: String(userId),
      entityLabel: buildPersonName(user),
      title: 'Reset user password',
      description: 'User password was reset and must be changed on next login.',
    });

    return res.json({ message: 'Password reset successfully. User must change password at /change-password on next login.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};
