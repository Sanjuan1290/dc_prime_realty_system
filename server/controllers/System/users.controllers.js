import { db } from '../../db/connect.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

const sellerRoles = new Set([
  'broker_network_manager',
  'broker',
  'manager',
  'agent',
]);

const roleDefaultRates = {
  broker_network_manager: { bailen: 8, maragondon: 8, general_trias: 8 },
  broker: { bailen: 7, maragondon: 7, general_trias: 7 },
  manager: { bailen: 5, maragondon: 5, general_trias: 5 },
  agent: { bailen: 3, maragondon: 3, general_trias: 3 },
};

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const getErrorMessage = (error) => {
  if (error?.code === 'ER_DUP_ENTRY') return 'Email already exists.';
  return error?.message || 'Something went wrong.';
};

const buildFullNameSql = (alias = 'u') => {
  return `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;
};

const getUserSelectSql = () => `
  SELECT
    u.id,
    u.first_name,
    u.last_name,
    u.middle_name,
    ${buildFullNameSql('u')} AS full_name,
    u.contact_no,
    u.email,
    u.role,
    u.status,
    u.must_change_password,
    u.last_login,
    u.created_at,
    u.updated_at,
    a.seller_group_id,
    sg.seller_group_name,
    a.accredited_seller_reports_under_user_id AS reports_under_user_id,
    ${buildFullNameSql('parent')} AS reports_under_name,
    parent.role AS reports_under_role,
    a.accredited_seller_accreditation_date AS accreditation_date,
    a.accredited_seller_status,
    a.accredited_seller_assigned_rate_bailen,
    a.accredited_seller_assigned_rate_maragondon,
    a.accredited_seller_assigned_rate_general_trias
  FROM users u
  LEFT JOIN accredited_sellers a ON a.user_id = u.id
  LEFT JOIN seller_groups sg ON sg.seller_group_id = a.seller_group_id
  LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
`;

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
        IFNULL(sg.seller_group_name, '') LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword, keyword);
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

    const [summaryRows] = await db.query(`
      SELECT
        COUNT(*) AS total,
        SUM(status = 'active') AS active,
        SUM(status = 'inactive') AS inactive,
        SUM(must_change_password = 1) AS mustChangePassword
      FROM users
    `);

    return res.json({
      data: rows,
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
      email,
      password = 'password',
      role = 'agent',
      status = 'active',
      seller_group_id,
      reports_under_user_id,
      accreditation_date,
      accredited_seller_assigned_rate_bailen,
      accredited_seller_assigned_rate_maragondon,
      accredited_seller_assigned_rate_general_trias,
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'First name, last name, and email are required.' });
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
          email,
          password_hash,
          role,
          status,
          must_change_password
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
      `,
      [
        first_name.trim(),
        last_name.trim(),
        middle_name?.trim() || null,
        contact_no?.trim() || null,
        email.trim(),
        passwordHash,
        role,
        status,
      ]
    );

    const userId = result.insertId;

    if (sellerRoles.has(role)) {
      const defaults = roleDefaultRates[role];

      await connection.query(
        `
          INSERT INTO accredited_sellers (
            user_id,
            seller_group_id,
            accredited_seller_reports_under_user_id,
            accredited_seller_assigned_rate_bailen,
            accredited_seller_assigned_rate_maragondon,
            accredited_seller_assigned_rate_general_trias,
            accredited_seller_accreditation_date,
            accredited_seller_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          userId,
          toNullableNumber(seller_group_id),
          role === 'broker_network_manager' ? null : toNullableNumber(reports_under_user_id),
          Number(accredited_seller_assigned_rate_bailen ?? defaults.bailen),
          Number(accredited_seller_assigned_rate_maragondon ?? defaults.maragondon),
          Number(accredited_seller_assigned_rate_general_trias ?? defaults.general_trias),
          accreditation_date || new Date().toISOString().slice(0, 10),
          status,
        ]
      );
    }

    await connection.commit();

    return res.status(201).json({ message: 'User created successfully.', user_id: userId });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
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
      email,
      role,
      status,
      seller_group_id,
      reports_under_user_id,
      accreditation_date,
      accredited_seller_assigned_rate_bailen,
      accredited_seller_assigned_rate_maragondon,
      accredited_seller_assigned_rate_general_trias,
    } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({ message: 'First name, last name, and email are required.' });
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
        email.trim(),
        role,
        status,
        userId,
      ]
    );

    if (sellerRoles.has(role)) {
      const defaults = roleDefaultRates[role];

      await connection.query(
        `
          INSERT INTO accredited_sellers (
            user_id,
            seller_group_id,
            accredited_seller_reports_under_user_id,
            accredited_seller_assigned_rate_bailen,
            accredited_seller_assigned_rate_maragondon,
            accredited_seller_assigned_rate_general_trias,
            accredited_seller_accreditation_date,
            accredited_seller_status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            seller_group_id = VALUES(seller_group_id),
            accredited_seller_reports_under_user_id = VALUES(accredited_seller_reports_under_user_id),
            accredited_seller_assigned_rate_bailen = VALUES(accredited_seller_assigned_rate_bailen),
            accredited_seller_assigned_rate_maragondon = VALUES(accredited_seller_assigned_rate_maragondon),
            accredited_seller_assigned_rate_general_trias = VALUES(accredited_seller_assigned_rate_general_trias),
            accredited_seller_accreditation_date = VALUES(accredited_seller_accreditation_date),
            accredited_seller_status = VALUES(accredited_seller_status)
        `,
        [
          userId,
          toNullableNumber(seller_group_id),
          role === 'broker_network_manager' ? null : toNullableNumber(reports_under_user_id),
          Number(accredited_seller_assigned_rate_bailen ?? defaults.bailen),
          Number(accredited_seller_assigned_rate_maragondon ?? defaults.maragondon),
          Number(accredited_seller_assigned_rate_general_trias ?? defaults.general_trias),
          accreditation_date || new Date().toISOString().slice(0, 10),
          status,
        ]
      );
    } else {
      await connection.query(`DELETE FROM accredited_sellers WHERE user_id = ?`, [userId]);
    }

    await connection.commit();

    return res.json({ message: 'User updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const toggleUserStatus = async (req, res) => {
  try {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: 'Invalid user id.' });

    const [rows] = await db.query(`SELECT status FROM users WHERE id = ? LIMIT 1`, [userId]);
    const user = rows[0];

    if (!user) return res.status(404).json({ message: 'User not found.' });

    const nextStatus = req.body.status || (user.status === 'active' ? 'inactive' : 'active');

    await db.query(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, userId]);
    await db.query(
      `UPDATE accredited_sellers SET accredited_seller_status = ? WHERE user_id = ?`,
      [nextStatus, userId]
    );

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

    const passwordHash = await bcrypt.hash(String(newPassword), 10);

    await db.query(
      `UPDATE users SET password_hash = ?, must_change_password = 1 WHERE id = ?`,
      [passwordHash, userId]
    );

    return res.json({ message: 'Password reset successfully. User must change password on next login.' });
  } catch (error) {
    return res.status(500).json({ message: getErrorMessage(error) });
  }
};
