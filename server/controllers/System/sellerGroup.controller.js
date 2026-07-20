import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { columnExists, tableExists } from '../Lot_Projects/_shared/lotProject.shared.js';
import {
  syncChildOverrideFromCurrentParent,
  syncGroupHeadFallbackOverrides,
  syncSellerRoleProjectRates,
} from './sellerCommissionRates.service.js';
import {
  getRequiredParentRole,
  isGroupHeadRole,
  SELLER_ROLE_LABELS,
} from './sellerHierarchyRules.js';

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

const getErrorMessage = (error) => {
  if (error?.statusCode && error?.message) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') return 'Seller group already exists.';
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) return 'Database operation failed. Please try again.';
  return error?.message || 'Something went wrong.';
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const validatePoolRate = (value, label = 'Pool rate') => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 6 || numberValue > 15) {
    throw createValidationError(`${label} must be between 6 and 15.`);
  }
  return numberValue;
};

const validateSellerRate = (value, label = 'Seller rate') => {
  const numberValue = Number(value);
  if (Number.isNaN(numberValue) || numberValue < 0 || numberValue > 15) {
    throw createValidationError(`${label} must be between 0 and 15.`);
  }
  return numberValue;
};

const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;

const normalizeStatus = (status) => (status === 'inactive' ? 'inactive' : 'active');

const validateGroupHead = async (connection, userId, groupId = null) => {
  const normalizedUserId = toNullableNumber(userId);
  if (!normalizedUserId) return null;

  const [rows] = await connection.query(
    `
      SELECT
        user.id AS user_id,
        user.role,
        user.status AS user_status,
        seller.accredited_seller_id,
        seller.seller_group_id,
        seller.accredited_seller_status,
        COALESCE(seller.is_system_dummy, 0) AS is_system_dummy
      FROM users user
      INNER JOIN accredited_sellers seller ON seller.user_id = user.id
      WHERE user.id = ?
      LIMIT 1
    `,
    [normalizedUserId]
  );
  const head = rows[0];

  if (!head || Number(head.is_system_dummy || 0) === 1) throw createValidationError('The selected group head is not an accredited seller.');
  if (!isGroupHeadRole(head.role)) {
    throw createValidationError('Only a Broker Network Manager or Broker can be the head of a seller group.');
  }
  if (head.user_status !== 'active' || head.accredited_seller_status !== 'active') {
    throw createValidationError('The selected group head must be active.');
  }
  if (head.seller_group_id && groupId && Number(head.seller_group_id) !== Number(groupId)) {
    throw createValidationError('The selected group head already belongs to another seller group.');
  }
  if (head.seller_group_id && !groupId) {
    throw createValidationError('The selected group head already belongs to another seller group.');
  }

  return head;
};

const getCurrentGroupHead = async (connection, groupId) => {
  if (!groupId) return null;
  const [rows] = await connection.query(
    `
      SELECT
        group_row.seller_group_head_user_id AS user_id,
        seller.accredited_seller_id,
        user.role
      FROM seller_groups group_row
      LEFT JOIN users user ON user.id = group_row.seller_group_head_user_id
      LEFT JOIN accredited_sellers seller ON seller.user_id = user.id
      WHERE group_row.seller_group_id = ?
      LIMIT 1
    `,
    [groupId]
  );
  return rows[0]?.user_id ? rows[0] : null;
};

const validateGroupHeadTransition = (previousHead, nextHead) => {
  if (!previousHead || !nextHead || Number(previousHead.user_id) === Number(nextHead.user_id)) return;

  // A Broker can become a normal Broker below a newly selected BNM. Other head
  // replacements would leave the previous top seller in an invalid role path.
  if (previousHead.role === 'broker' && nextHead.role === 'broker_network_manager') return;

  throw createValidationError(
    'This group already has a head whose role cannot report under the selected replacement. Change the current head’s role or remove the head first.'
  );
};

const attachAndSyncGroupHead = async (connection, groupId, head, previousHead = null) => {
  validateGroupHeadTransition(previousHead, head);

  if (!head) {
    await syncGroupHeadFallbackOverrides(connection, groupId);
    return;
  }

  await connection.query(
    `
      UPDATE accredited_sellers
      SET seller_group_id = ?, accredited_seller_reports_under_user_id = NULL
      WHERE accredited_seller_id = ?
    `,
    [groupId, head.accredited_seller_id]
  );

  if (await tableExists(connection, 'accredited_seller_managed_sellers')) {
    await connection.query(
      `DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?`,
      [head.accredited_seller_id]
    );
  }

  if (
    previousHead
    && Number(previousHead.user_id) !== Number(head.user_id)
    && previousHead.role === 'broker'
    && head.role === 'broker_network_manager'
  ) {
    await connection.query(
      `
        UPDATE accredited_sellers
        SET accredited_seller_reports_under_user_id = ?
        WHERE accredited_seller_id = ?
      `,
      [head.user_id, previousHead.accredited_seller_id]
    );
    if (await tableExists(connection, 'accredited_seller_managed_sellers')) {
      await connection.query(
        `DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?`,
        [previousHead.accredited_seller_id]
      );
      await connection.query(
        `
          INSERT INTO accredited_seller_managed_sellers (
            manager_accredited_seller_id,
            managed_accredited_seller_id
          ) VALUES (?, ?)
          ON DUPLICATE KEY UPDATE updated_at = NOW()
        `,
        [head.accredited_seller_id, previousHead.accredited_seller_id]
      );
    }
    await syncChildOverrideFromCurrentParent(connection, previousHead.accredited_seller_id);
  }

  const [rates] = await connection.query(
    `
      SELECT
        lot_project_id,
        accredited_seller_project_rate,
        accredited_seller_lot_project_rate_status
      FROM accredited_seller_lot_project_rates
      WHERE accredited_seller_id = ?
    `,
    [head.accredited_seller_id]
  );
  await syncSellerRoleProjectRates(connection, head.accredited_seller_id, head.role, rates);
  await syncGroupHeadFallbackOverrides(connection, groupId);
};

/**
 * Makes a newly created top-level BNM or Broker the group head. A new BNM may
 * replace a Broker head; the former Broker is moved directly below the BNM.
 */
export const assignTopLevelSellerAsGroupHead = async (connection, groupId, userId) => {
  const nextHead = await validateGroupHead(connection, userId, groupId);
  if (!nextHead) return null;

  const previousHead = await getCurrentGroupHead(connection, groupId);
  validateGroupHeadTransition(previousHead, nextHead);

  if (!previousHead || Number(previousHead.user_id) !== Number(nextHead.user_id)) {
    await connection.query(
      `UPDATE seller_groups SET seller_group_head_user_id = ? WHERE seller_group_id = ?`,
      [nextHead.user_id, groupId]
    );
  }

  await attachAndSyncGroupHead(connection, groupId, nextHead, previousHead);
  return { previousHead, nextHead };
};

export const assertSellerGroupRoleHierarchy = async (connection, groupId) => {
  if (!groupId) return;

  const [rows] = await connection.query(
    `
      SELECT
        group_row.seller_group_head_user_id,
        seller.accredited_seller_id,
        seller.user_id,
        seller.accredited_seller_reports_under_user_id,
        seller.seller_group_id,
        user.role,
        ${fullNameSql('user')} AS full_name,
        parent_seller.accredited_seller_id AS parent_accredited_seller_id,
        parent_seller.seller_group_id AS parent_group_id,
        parent_user.role AS parent_role,
        ${fullNameSql('parent_user')} AS parent_name
      FROM seller_groups group_row
      LEFT JOIN accredited_sellers seller
        ON seller.seller_group_id = group_row.seller_group_id
       AND COALESCE(seller.is_system_dummy, 0) = 0
      LEFT JOIN users user ON user.id = seller.user_id
      LEFT JOIN users parent_user ON parent_user.id = seller.accredited_seller_reports_under_user_id
      LEFT JOIN accredited_sellers parent_seller ON parent_seller.user_id = parent_user.id
      WHERE group_row.seller_group_id = ?
      ORDER BY seller.accredited_seller_id ASC
    `,
    [groupId]
  );

  if (!rows.length) throw createValidationError('The selected seller group was not found.');
  const headUserId = Number(rows[0].seller_group_head_user_id || 0);
  const sellers = rows.filter((row) => row.accredited_seller_id);
  const topLevelSellers = sellers.filter((seller) => !seller.accredited_seller_reports_under_user_id);

  if (headUserId) {
    const head = sellers.find((seller) => Number(seller.user_id) === headUserId);
    if (!head) throw createValidationError('The seller group head must belong to the same seller group.');
    if (!isGroupHeadRole(head.role)) {
      throw createValidationError('Only a Broker Network Manager or Broker can be the head of a seller group.');
    }
    if (head.accredited_seller_reports_under_user_id) {
      throw createValidationError('The seller group head must report directly to the developer.');
    }
  } else if (topLevelSellers.length > 1) {
    throw createValidationError('A headless seller group can have only one top-level Broker Network Manager or Broker. Assign a group head before adding another top-level seller.');
  }

  for (const seller of sellers) {
    const isHead = headUserId && Number(seller.user_id) === headUserId;
    if (!seller.accredited_seller_reports_under_user_id) {
      if (isHead) continue;
      if (!headUserId && isGroupHeadRole(seller.role)) continue;
      throw createValidationError(
        `${seller.full_name || 'Seller'} must report under a ${SELLER_ROLE_LABELS[getRequiredParentRole(seller.role)] || 'valid parent seller'}.`
      );
    }

    if (isHead) {
      throw createValidationError('The seller group head cannot have a reporting parent.');
    }
    if (!seller.parent_accredited_seller_id || Number(seller.parent_group_id) !== Number(groupId)) {
      throw createValidationError(`${seller.full_name || 'Seller'} must report under a seller from the same group.`);
    }

    const expectedParentRole = getRequiredParentRole(seller.role);
    if (!expectedParentRole || seller.parent_role !== expectedParentRole) {
      throw createValidationError(
        `${seller.full_name || 'Seller'} is a ${SELLER_ROLE_LABELS[seller.role] || seller.role} and can only report under a ${SELLER_ROLE_LABELS[expectedParentRole] || 'valid parent seller'}.`
      );
    }
  }
};

const getActiveLotProjects = async (connection = db) => {
  const [projects] = await connection.query(`
    SELECT
      lot_project_id,
      lot_project_name,
      lot_project_slug,
      lot_project_location,
      lot_project_location_code
    FROM lot_projects
    WHERE lot_project_status = 'active'
    ORDER BY lot_project_name ASC
  `);

  return projects;
};

export const normalizeGroupProjectRates = (projectRates = [], projects = []) => {
  if (!Array.isArray(projectRates) || projectRates.length === 0) {
    throw createValidationError('Select at least one accredited project for this seller group.');
  }

  const projectMap = new Map(
    projects.map((project) => [Number(project.lot_project_id), project])
  );
  const selectedProjectIds = new Set();

  return projectRates.map((item) => {
    const projectId = Number(item?.lot_project_id);
    const project = projectMap.get(projectId);

    if (!project) {
      throw createValidationError('One or more selected projects are unavailable or inactive. Refresh the form and try again.');
    }
    if (selectedProjectIds.has(projectId)) {
      throw createValidationError(`${project.lot_project_name} was selected more than once.`);
    }
    selectedProjectIds.add(projectId);

    return {
      lot_project_id: projectId,
      seller_group_pool_rate: validatePoolRate(
        item?.seller_group_pool_rate ?? item?.rate,
        `${project.lot_project_name} pool rate`
      ),
    };
  });
};


const upsertGroupProjectRates = async (connection, groupId, projectRates) => {
  if (!projectRates.length) return;

  await connection.query(
    `
      INSERT INTO seller_group_lot_project_rates (
        seller_group_id,
        lot_project_id,
        seller_group_pool_rate,
        seller_group_lot_project_rate_status
      ) VALUES ${projectRates.map(() => '(?, ?, ?, "active")').join(', ')}
      ON DUPLICATE KEY UPDATE
        seller_group_pool_rate = VALUES(seller_group_pool_rate),
        seller_group_lot_project_rate_status = 'active'
    `,
    projectRates.flatMap((rate) => [
      groupId,
      rate.lot_project_id,
      rate.seller_group_pool_rate,
    ])
  );
};

const syncGroupProjectAccreditations = async (connection, groupId, projectRates) => {
  await upsertGroupProjectRates(connection, groupId, projectRates);

  const selectedIds = projectRates.map((rate) => Number(rate.lot_project_id));
  const placeholders = selectedIds.map(() => '?').join(', ');

  // Removing a project accreditation only disables future configuration. Historical
  // reservations and commission snapshots stay intact for reporting and audits.
  await connection.query(
    `
      UPDATE seller_group_lot_project_rates
      SET seller_group_lot_project_rate_status = 'inactive'
      WHERE seller_group_id = ?
        AND lot_project_id NOT IN (${placeholders})
    `,
    [groupId, ...selectedIds]
  );

  await connection.query(
    `
      UPDATE agent_lot_project_direct_rates direct_rate
      INNER JOIN accredited_sellers seller
        ON seller.accredited_seller_id = direct_rate.accredited_seller_id
      SET direct_rate.direct_rate_status = 'inactive'
      WHERE seller.seller_group_id = ?
        AND direct_rate.lot_project_id NOT IN (${placeholders})
    `,
    [groupId, ...selectedIds]
  );

  await connection.query(
    `
      UPDATE seller_hierarchy_lot_project_overrides override_row
      INNER JOIN accredited_sellers child
        ON child.accredited_seller_id = override_row.child_accredited_seller_id
      SET override_row.override_rate_status = 'inactive'
      WHERE child.seller_group_id = ?
        AND override_row.lot_project_id NOT IN (${placeholders})
    `,
    [groupId, ...selectedIds]
  );
};

const hydrateGroupRates = async (groups) => {
  const groupIds = groups.map((group) => group.seller_group_id).filter(Boolean);
  if (!groupIds.length) return groups.map((group) => ({ ...group, project_rates: [] }));

  const placeholders = groupIds.map(() => '?').join(', ');
  const [rateRows] = await db.query(
    `
      SELECT
        sgr.seller_group_id,
        sgr.lot_project_id,
        lp.lot_project_name,
        lp.lot_project_slug,
        lp.lot_project_location_code,
        sgr.seller_group_pool_rate,
        sgr.seller_group_lot_project_rate_status
      FROM seller_group_lot_project_rates sgr
      INNER JOIN lot_projects lp ON lp.lot_project_id = sgr.lot_project_id
      WHERE sgr.seller_group_id IN (${placeholders})
        AND sgr.seller_group_lot_project_rate_status = 'active'
      ORDER BY lp.lot_project_name ASC
    `,
    groupIds
  );

  const rateMap = new Map();
  rateRows.forEach((rate) => {
    if (!rateMap.has(rate.seller_group_id)) rateMap.set(rate.seller_group_id, []);
    rateMap.get(rate.seller_group_id).push(rate);
  });

  return groups.map((group) => ({
    ...group,
    project_rates: rateMap.get(group.seller_group_id) || [],
  }));
};

const hydrateMemberRates = async (members) => {
  const sellerIds = members.map((member) => member.accredited_seller_id).filter(Boolean);
  if (!sellerIds.length) return members.map((member) => ({ ...member, project_rates: [] }));

  const placeholders = sellerIds.map(() => '?').join(', ');
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
    sellerIds
  );

  const rateMap = new Map();
  rateRows.forEach((rate) => {
    if (!rateMap.has(rate.accredited_seller_id)) rateMap.set(rate.accredited_seller_id, []);
    rateMap.get(rate.accredited_seller_id).push(rate);
  });

  return members.map((member) => ({
    ...member,
    project_rates: rateMap.get(member.accredited_seller_id) || [],
  }));
};

export const createGroup = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status = 'active',
      project_rates = [],
    } = req.body;

    if (!seller_group_name?.trim()) {
      return res.status(400).json({ message: 'Seller group name is required.' });
    }

    await connection.beginTransaction();
    const groupHead = await validateGroupHead(connection, seller_group_head_user_id);

    const [result] = await connection.query(
      `
        INSERT INTO seller_groups (
          seller_group_name,
          seller_group_head_user_id,
          seller_group_description,
          seller_group_status
        ) VALUES (?, ?, ?, ?)
      `,
      [
        seller_group_name.trim(),
        toNullableNumber(seller_group_head_user_id),
        seller_group_description?.trim() || null,
        normalizeStatus(seller_group_status),
      ]
    );

    const groupId = result.insertId;
    await attachAndSyncGroupHead(connection, groupId, groupHead);
    await assertSellerGroupRoleHierarchy(connection, groupId);
    // A group is accredited only to projects explicitly selected in the form.
    const projects = await getActiveLotProjects(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects);
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates);
    await assertConfiguredPathsWithinPools(connection, groupId, normalizedRates);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Seller Groups',
      entityType: 'seller_group',
      entityId: String(groupId),
      entityLabel: seller_group_name.trim(),
      title: 'Created seller group',
      description: `Created seller group ${seller_group_name.trim()}.`,
      metadata: { status: normalizeStatus(seller_group_status), projectRates: normalizedRates },
    });

    await connection.commit();

    return res.status(201).json({
      message: 'Seller group created successfully.',
      seller_group_id: groupId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getGroups = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
    const offset = (page - 1) * limit;
    const search = String(req.query.search || '').trim();
    const status = String(req.query.status || 'all');

    const where = [];
    const params = [];

    if (search) {
      where.push(`(
        sg.seller_group_name LIKE ? OR
        IFNULL(sg.seller_group_description, '') LIKE ? OR
        ${fullNameSql('head_user')} LIKE ?
      )`);
      const keyword = `%${search}%`;
      params.push(keyword, keyword, keyword);
    }

    if (status !== 'all') {
      where.push('sg.seller_group_status = ?');
      params.push(status);
    }

    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [countRows] = await db.query(
      `
        SELECT COUNT(*) AS total
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        ${whereSql}
      `,
      params
    );

    const total = Number(countRows[0]?.total || 0);
    const totalPages = Math.max(Math.ceil(total / limit), 1);

    const [rows] = await db.query(
      `
        SELECT
          sg.*,
          ${fullNameSql('head_user')} AS group_head_name,
          COUNT(CASE WHEN COALESCE(a.is_system_dummy, 0) = 0 THEN 1 END) AS member_count,
          SUM(COALESCE(a.is_system_dummy, 0) = 0 AND a.accredited_seller_status = 'active') AS active_member_count
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        LEFT JOIN accredited_sellers a ON a.seller_group_id = sg.seller_group_id
        ${whereSql}
        GROUP BY sg.seller_group_id, head_user.id
        ORDER BY sg.seller_group_created_at DESC, sg.seller_group_id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );

    const hydratedRows = await hydrateGroupRates(
      rows.map((row) => ({
        ...row,
        member_count: Number(row.member_count || 0),
        active_member_count: Number(row.active_member_count || 0),
      }))
    );

    const [metaRows] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM seller_groups WHERE seller_group_status = 'active') AS active,
        (SELECT COUNT(*) FROM seller_groups WHERE seller_group_status = 'inactive') AS inactive,
        COALESCE((SELECT COUNT(*) FROM accredited_sellers WHERE COALESCE(is_system_dummy, 0) = 0), 0) AS totalMembers,
        COALESCE((SELECT COUNT(*) FROM seller_group_lot_project_rates WHERE seller_group_lot_project_rate_status = 'active'), 0) AS accreditedProjects
    `);

    return res.json({
      data: hydratedRows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      meta: {
        active: Number(metaRows[0]?.active || 0),
        inactive: Number(metaRows[0]?.inactive || 0),
        totalMembers: Number(metaRows[0]?.totalMembers || 0),
        accreditedProjects: Number(metaRows[0]?.accreditedProjects || 0),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const getGroupOptions = async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT
        group_row.seller_group_id,
        group_row.seller_group_name,
        group_row.seller_group_head_user_id,
        head_user.role AS seller_group_head_role,
        ${fullNameSql('head_user')} AS seller_group_head_name
      FROM seller_groups group_row
      LEFT JOIN users head_user ON head_user.id = group_row.seller_group_head_user_id
      WHERE group_row.seller_group_status = 'active'
      ORDER BY group_row.seller_group_name ASC
    `);

    return res.json({ data: rows });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const editGroup = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status,
      project_rates = [],
    } = req.body;

    if (!seller_group_name?.trim()) {
      return res.status(400).json({ message: 'Seller group name is required.' });
    }

    await connection.beginTransaction();
    const previousGroupHead = await getCurrentGroupHead(connection, groupId);
    const groupHead = await validateGroupHead(connection, seller_group_head_user_id, groupId);
    validateGroupHeadTransition(previousGroupHead, groupHead);

    await connection.query(
      `
        UPDATE seller_groups
        SET
          seller_group_name = ?,
          seller_group_head_user_id = ?,
          seller_group_description = ?,
          seller_group_status = ?
        WHERE seller_group_id = ?
      `,
      [
        seller_group_name.trim(),
        toNullableNumber(seller_group_head_user_id),
        seller_group_description?.trim() || null,
        normalizeStatus(seller_group_status),
        groupId,
      ]
    );

    await attachAndSyncGroupHead(connection, groupId, groupHead, previousGroupHead);
    await assertSellerGroupRoleHierarchy(connection, groupId);

    const projects = await getActiveLotProjects(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects);
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates);
    await assertConfiguredPathsWithinPools(connection, groupId, normalizedRates);

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Seller Groups',
      entityType: 'seller_group',
      entityId: String(groupId),
      entityLabel: seller_group_name.trim(),
      title: 'Updated seller group',
      description: `Updated seller group ${seller_group_name.trim()}.`,
      metadata: { status: normalizeStatus(seller_group_status), projectRates: normalizedRates },
    });

    await connection.commit();

    return res.json({ message: 'Seller group updated successfully.' });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const toggleGroupStatus = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const [rows] = await db.query(
      `SELECT seller_group_status FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );

    const group = rows[0];
    if (!group) return res.status(404).json({ message: 'Seller group not found.' });

    const nextStatus = normalizeStatus(req.body.status || (group.seller_group_status === 'active' ? 'inactive' : 'active'));

    await db.query(
      `UPDATE seller_groups SET seller_group_status = ? WHERE seller_group_id = ?`,
      [nextStatus, groupId]
    );

    return res.json({ message: `Seller group is now ${nextStatus}.`, status: nextStatus });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const viewGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const [groupRows] = await db.query(
      `
        SELECT
          sg.*,
          ${fullNameSql('head_user')} AS group_head_name,
          COUNT(a.accredited_seller_id) AS member_count,
          SUM(a.accredited_seller_status = 'active') AS active_member_count
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        LEFT JOIN accredited_sellers a ON a.seller_group_id = sg.seller_group_id
        WHERE sg.seller_group_id = ?
        GROUP BY sg.seller_group_id, head_user.id
        LIMIT 1
      `,
      [groupId]
    );

    const group = groupRows[0];
    if (!group) return res.status(404).json({ message: 'Seller group not found.' });

    const [members] = await db.query(
      `
        SELECT
          a.accredited_seller_id,
          a.user_id,
          ${fullNameSql('u')} AS full_name,
          u.email,
          u.role,
          a.accredited_seller_reports_under_user_id AS reports_under_user_id,
          ${fullNameSql('parent')} AS reports_under_name,
          a.accredited_seller_status
        FROM accredited_sellers a
        INNER JOIN users u ON u.id = a.user_id
        LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
        WHERE a.seller_group_id = ?
          OR a.user_id = ?
        ORDER BY FIELD(u.role, 'broker_network_manager', 'broker', 'manager', 'agent'), full_name ASC
      `,
      [groupId, group.seller_group_head_user_id || 0]
    );

    const [hydratedGroup] = await hydrateGroupRates([
      {
        ...group,
        member_count: Number(group.member_count || 0),
        active_member_count: Number(group.active_member_count || 0),
      },
    ]);

    const hydratedMembers = await hydrateMemberRates(members);

    return res.json({
      data: {
        group: hydratedGroup,
        members: hydratedMembers,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

const requireCommissionConfigurationSchema = async (connection) => {
  const requiredTables = [
    'agent_lot_project_direct_rates',
    'seller_hierarchy_lot_project_overrides',
  ];

  for (const tableName of requiredTables) {
    if (!(await tableExists(connection, tableName))) {
      throw createValidationError(
        'Commission configuration needs the 20260718 direct-agent override migration.'
      );
    }
  }
};

const getGroupAndProject = async (connection, groupId, projectId) => {
  const [rows] = await connection.query(
    `
      SELECT
        sg.seller_group_id,
        sg.seller_group_name,
        sg.seller_group_head_user_id,
        sg.seller_group_description,
        sg.seller_group_status,
        ${fullNameSql('head_user')} AS group_head_name,
        lp.lot_project_id,
        lp.lot_project_name,
        lp.lot_project_slug,
        lp.lot_project_location_code,
        lp.lot_project_status,
        sgr.seller_group_pool_rate,
        sgr.seller_group_lot_project_rate_status AS pool_rate_status
      FROM seller_groups sg
      INNER JOIN seller_group_lot_project_rates sgr
        ON sgr.seller_group_id = sg.seller_group_id
       AND sgr.lot_project_id = ?
       AND sgr.seller_group_lot_project_rate_status = 'active'
      INNER JOIN lot_projects lp
        ON lp.lot_project_id = sgr.lot_project_id
       AND lp.lot_project_status = 'active'
      LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
      WHERE sg.seller_group_id = ?
      LIMIT 1
    `,
    [projectId, groupId]
  );

  return rows[0] || null;
};

const loadGroupProjectMembers = async (connection, groupId, projectId) => {
  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id,
        acs.user_id,
        acs.seller_group_id,
        acs.accredited_seller_reports_under_user_id,
        acs.accredited_seller_status,
        COALESCE(acs.is_system_dummy, 0) AS is_system_dummy,
        acs.dummy_owner_accredited_seller_id,
        u.role,
        u.status AS user_status,
        ${fullNameSql('u')} AS full_name,
        parent_acs.accredited_seller_id AS parent_accredited_seller_id,
        ${fullNameSql('parent_user')} AS reports_under_name,
        owner_user.role AS owner_role,
        ${fullNameSql('owner_user')} AS owner_name,
        role_rate.accredited_seller_project_rate AS project_rate,
        role_rate.accredited_seller_lot_project_rate_status AS project_rate_status,
        direct_rate.direct_rate,
        direct_rate.direct_rate_status
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      LEFT JOIN accredited_sellers parent_acs
        ON parent_acs.user_id = acs.accredited_seller_reports_under_user_id
      LEFT JOIN users parent_user ON parent_user.id = parent_acs.user_id
      LEFT JOIN accredited_sellers owner_acs
        ON owner_acs.accredited_seller_id = acs.dummy_owner_accredited_seller_id
      LEFT JOIN users owner_user ON owner_user.id = owner_acs.user_id
      LEFT JOIN agent_lot_project_direct_rates direct_rate
        ON direct_rate.accredited_seller_id = acs.accredited_seller_id
       AND direct_rate.lot_project_id = ?
      LEFT JOIN accredited_seller_lot_project_rates role_rate
        ON role_rate.accredited_seller_id = acs.accredited_seller_id
       AND role_rate.lot_project_id = ?
      WHERE acs.seller_group_id = ?
      ORDER BY
        FIELD(u.role, 'broker_network_manager', 'broker', 'manager', 'agent'),
        COALESCE(acs.is_system_dummy, 0),
        full_name ASC
    `,
    [projectId, projectId, groupId]
  );

  return rows.map((row) => ({
    ...row,
    accredited_seller_id: Number(row.accredited_seller_id),
    user_id: Number(row.user_id),
    parent_accredited_seller_id: row.parent_accredited_seller_id
      ? Number(row.parent_accredited_seller_id)
      : null,
    is_system_dummy: Boolean(Number(row.is_system_dummy || 0)),
    dummy_owner_accredited_seller_id: row.dummy_owner_accredited_seller_id
      ? Number(row.dummy_owner_accredited_seller_id)
      : null,
    direct_rate: row.direct_rate === null ? null : Number(row.direct_rate),
    project_rate: row.project_rate === null ? null : Number(row.project_rate),
    display_name: Number(row.is_system_dummy || 0) === 1 && row.owner_name
      ? `${row.owner_name} — Direct Sales Agent`
      : row.full_name,
  }));
};

const loadGroupProjectOverrides = async (connection, groupId, projectId) => {
  const [rows] = await connection.query(
    `
      SELECT
        override_row.seller_hierarchy_lot_project_override_id,
        override_row.child_accredited_seller_id,
        override_row.parent_accredited_seller_id,
        override_row.override_rate,
        override_row.override_rate_status,
        ${fullNameSql('child_user')} AS child_name,
        child_user.role AS child_role,
        ${fullNameSql('parent_user')} AS parent_name,
        parent_user.role AS parent_role
      FROM seller_hierarchy_lot_project_overrides override_row
      INNER JOIN accredited_sellers child_acs
        ON child_acs.accredited_seller_id = override_row.child_accredited_seller_id
      INNER JOIN users child_user ON child_user.id = child_acs.user_id
      INNER JOIN accredited_sellers parent_acs
        ON parent_acs.accredited_seller_id = override_row.parent_accredited_seller_id
      INNER JOIN users parent_user ON parent_user.id = parent_acs.user_id
      WHERE override_row.lot_project_id = ?
        AND child_acs.seller_group_id = ?
        AND parent_acs.seller_group_id = ?
      ORDER BY parent_name ASC, child_name ASC
    `,
    [projectId, groupId, groupId]
  );

  return rows.map((row) => ({
    ...row,
    seller_hierarchy_lot_project_override_id: Number(row.seller_hierarchy_lot_project_override_id),
    child_accredited_seller_id: Number(row.child_accredited_seller_id),
    parent_accredited_seller_id: Number(row.parent_accredited_seller_id),
    override_rate: Number(row.override_rate || 0),
  }));
};

const buildConfigurationValidation = (group, members, overrides) => {
  const memberMap = new Map(members.map((member) => [Number(member.accredited_seller_id), member]));
  const userSellerMap = new Map(members.map((member) => [Number(member.user_id), member]));
  const overrideMap = new Map(
    overrides
      .filter((row) => row.override_rate_status === 'active')
      .map((row) => [
        `${Number(row.child_accredited_seller_id)}:${Number(row.parent_accredited_seller_id)}`,
        Number(row.override_rate || 0),
      ])
  );
  const head = userSellerMap.get(Number(group.seller_group_head_user_id));
  const poolRate = Number(group.seller_group_pool_rate || 0);
  const paths = [];

  members
    .filter((member) => member.role === 'agent' && member.accredited_seller_status === 'active')
    .forEach((agent) => {
      const chain = [];
      const seen = new Set();
      let current = agent;
      let total = Number(agent.direct_rate_status === 'active' ? agent.direct_rate || 0 : 0);

      chain.push({
        sellerId: agent.accredited_seller_id,
        sellerName: agent.display_name,
        role: agent.role,
        type: 'direct',
        rate: Number(agent.direct_rate_status === 'active' ? agent.direct_rate || 0 : 0),
      });
      seen.add(agent.accredited_seller_id);

      while (current) {
        let parent = current.parent_accredited_seller_id
          ? memberMap.get(Number(current.parent_accredited_seller_id))
          : null;
        if (!parent && head && !seen.has(Number(head.accredited_seller_id))) parent = head;
        if (!parent || seen.has(Number(parent.accredited_seller_id))) break;

        const rate = Number(
          overrideMap.get(`${Number(current.accredited_seller_id)}:${Number(parent.accredited_seller_id)}`) || 0
        );
        total += rate;
        chain.push({
          sellerId: parent.accredited_seller_id,
          sellerName: parent.display_name,
          role: parent.role,
          type: 'override',
          childSellerId: current.accredited_seller_id,
          rate,
        });
        seen.add(parent.accredited_seller_id);
        current = parent;
      }

      const errors = [];
      if (Number(agent.direct_rate || 0) <= 0 || agent.direct_rate_status !== 'active') {
        errors.push(`${agent.display_name} has no active sales commission rate.`);
      }
      if (poolRate > 0 && total > poolRate + 0.0001) {
        errors.push(`Allocated ${total.toFixed(2)}% exceeds the ${poolRate.toFixed(2)}% pool.`);
      }

      paths.push({
        agentId: agent.accredited_seller_id,
        agentName: agent.display_name,
        allocatedRate: Number(total.toFixed(2)),
        poolRate,
        unallocatedRate: Number(Math.max(poolRate - total, 0).toFixed(2)),
        hasErrors: errors.length > 0,
        errors,
        chain,
      });
    });

  return {
    pathCount: paths.length,
    errorCount: paths.filter((path) => path.hasErrors).length,
    paths,
  };
};

/**
 * Pool-rate edits are validated against the current direct-rate and override
 * model. Legacy cumulative seller-rate rows are intentionally ignored.
 */
async function assertConfiguredPathsWithinPools(connection, groupId, projectRates = []) {
  for (const projectRate of projectRates) {
    const projectId = Number(projectRate.lot_project_id || 0);
    if (!projectId) continue;

    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) continue;
    const members = await loadGroupProjectMembers(connection, groupId, projectId);
    const overrides = await loadGroupProjectOverrides(connection, groupId, projectId);
    const validation = buildConfigurationValidation(
      { ...group, seller_group_pool_rate: Number(projectRate.seller_group_pool_rate || 0) },
      members,
      overrides
    );
    const overAllocated = validation.paths.find((path) =>
      path.errors.some((message) => message.includes('exceeds the'))
    );
    if (overAllocated) {
      throw createValidationError(
        `${group.lot_project_name} pool rate is lower than the configured ${overAllocated.allocatedRate.toFixed(2)}% commission path for ${overAllocated.agentName}. Edit member rates first or use a higher pool rate.`
      );
    }
  }
}

export const assertGroupCurrentPathsWithinPools = async (connection, groupId) => {
  if (!groupId) return;
  const [projectRates] = await connection.query(
    `
      SELECT lot_project_id, seller_group_pool_rate
      FROM seller_group_lot_project_rates
      WHERE seller_group_id = ?
        AND seller_group_lot_project_rate_status = 'active'
    `,
    [groupId]
  );
  await assertConfiguredPathsWithinPools(connection, groupId, projectRates);
};

export const normalizeGroupAnalyticsRange = (fromValue, toValue) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(String(fromValue || '')) || !datePattern.test(String(toValue || ''))) {
    throw createValidationError('A valid From Date and To Date are required.');
  }

  const from = new Date(`${fromValue}T00:00:00Z`);
  const to = new Date(`${toValue}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw createValidationError('The selected analytics date range is invalid.');
  }
  if (from > to) throw createValidationError('From Date cannot be after To Date.');

  const dayCount = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
  if (dayCount > 3660) throw createValidationError('The analytics date range cannot exceed 10 years.');

  return { fromDate: String(fromValue), toDate: String(toValue), dayCount };
};

export const mergeGroupAnalyticsTimeline = (salesRows = [], commissionRows = []) => {
  const periods = new Map();
  const getPeriod = (row) => String(row.period_start || row.period || '').slice(0, 10);

  salesRows.forEach((row) => {
    const period = getPeriod(row);
    if (!period) return;
    periods.set(period, {
      period,
      salesCount: Number(row.sales_count || 0),
      salesAmount: Number(row.sales_amount || 0),
      grossCommission: 0,
      releasedCommission: 0,
    });
  });

  commissionRows.forEach((row) => {
    const period = getPeriod(row);
    if (!period) return;
    const current = periods.get(period) || {
      period,
      salesCount: 0,
      salesAmount: 0,
      grossCommission: 0,
      releasedCommission: 0,
    };
    current.grossCommission = Number(row.gross_commission || 0);
    current.releasedCommission = Number(row.released_commission || 0);
    periods.set(period, current);
  });

  return [...periods.values()].sort((a, b) => a.period.localeCompare(b.period));
};

const getGroupAccreditedProjects = async (connection, groupId) => {
  const [rows] = await connection.query(
    `
      SELECT
        rate.lot_project_id,
        project.lot_project_name,
        project.lot_project_slug,
        project.lot_project_location,
        project.lot_project_location_code,
        rate.seller_group_pool_rate,
        rate.seller_group_lot_project_rate_status
      FROM seller_group_lot_project_rates rate
      INNER JOIN lot_projects project
        ON project.lot_project_id = rate.lot_project_id
       AND project.lot_project_status = 'active'
      WHERE rate.seller_group_id = ?
        AND rate.seller_group_lot_project_rate_status = 'active'
      ORDER BY project.lot_project_name ASC
    `,
    [groupId]
  );

  return rows.map((row) => ({
    ...row,
    lot_project_id: Number(row.lot_project_id),
    seller_group_pool_rate: Number(row.seller_group_pool_rate || 0),
  }));
};

export const getGroupProjectOptions = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId || 0);
    if (!groupId) return res.status(400).json({ message: 'Invalid seller group id.' });

    const [groupRows] = await db.query(
      `SELECT seller_group_id, seller_group_name, seller_group_status FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );
    if (!groupRows[0]) return res.status(404).json({ message: 'Seller group not found.' });

    const projects = await getGroupAccreditedProjects(db, groupId);
    return res.json({
      success: true,
      data: projects,
      group: {
        id: Number(groupRows[0].seller_group_id),
        name: groupRows[0].seller_group_name,
        status: groupRows[0].seller_group_status,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const getGroupProjectAnalytics = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const groupId = Number(req.params.groupId || 0);
    const projectId = Number(req.params.projectId || 0);
    const range = normalizeGroupAnalyticsRange(req.query.from, req.query.to);
    if (!groupId || !projectId) throw createValidationError('Seller group and project are required.');

    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('This seller group is not accredited to the selected project.');

    const dateFormat = range.dayCount <= 93 ? '%Y-%m-%d' : '%Y-%m';
    const hasSelectedContractTcp = await columnExists(connection, 'lot_project_client_profiles', 'soa_selected_tcp');
    const contractTcpExpr = hasSelectedContractTcp
      ? 'COALESCE(profile.soa_selected_tcp, listing.lot_project_listing_tcp)'
      : 'listing.lot_project_listing_tcp';
    const [salesSummaryRows] = await connection.query(
      `
        SELECT
          COUNT(DISTINCT profile.lot_project_client_profile_id) AS sales_count,
          COALESCE(SUM(${contractTcpExpr}), 0) AS sales_amount,
          COALESCE(AVG(${contractTcpExpr}), 0) AS average_sale_amount
        FROM lot_project_client_profiles profile
        INNER JOIN lot_project_listings listing
          ON listing.lot_project_listing_id = profile.lot_project_listing_id
        INNER JOIN accredited_sellers assigned_seller
          ON assigned_seller.accredited_seller_id = profile.assigned_accredited_seller_id
        WHERE profile.lot_project_id = ?
          AND assigned_seller.seller_group_id = ?
          AND profile.lot_project_client_profile_status <> 'cancelled'
          AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
      `,
      [projectId, groupId, range.fromDate, range.toDate]
    );

    const [commissionSummaryRows] = await connection.query(
      `
        SELECT
          COALESCE(SUM(commission.gross_commission_amount), 0) AS gross_commission,
          COALESCE(SUM(commission.released_commission_amount), 0) AS released_commission,
          COALESCE(SUM(commission.net_remaining_commission_amount), 0) AS remaining_commission
        FROM lot_project_commissions commission
        INNER JOIN lot_project_client_profiles profile
          ON profile.lot_project_client_profile_id = commission.lot_project_client_profile_id
        INNER JOIN accredited_sellers recipient
          ON recipient.accredited_seller_id = commission.accredited_seller_id
        WHERE commission.lot_project_id = ?
          AND recipient.seller_group_id = ?
          AND commission.commission_status <> 'Cancelled'
          AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
      `,
      [projectId, groupId, range.fromDate, range.toDate]
    );

    const [salesTimelineRows] = await connection.query(
      `
        SELECT
          DATE_FORMAT(profile.lot_project_client_profile_created_at, ?) AS period_start,
          COUNT(DISTINCT profile.lot_project_client_profile_id) AS sales_count,
          COALESCE(SUM(${contractTcpExpr}), 0) AS sales_amount
        FROM lot_project_client_profiles profile
        INNER JOIN lot_project_listings listing
          ON listing.lot_project_listing_id = profile.lot_project_listing_id
        INNER JOIN accredited_sellers assigned_seller
          ON assigned_seller.accredited_seller_id = profile.assigned_accredited_seller_id
        WHERE profile.lot_project_id = ?
          AND assigned_seller.seller_group_id = ?
          AND profile.lot_project_client_profile_status <> 'cancelled'
          AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
        GROUP BY period_start
        ORDER BY period_start ASC
      `,
      [dateFormat, projectId, groupId, range.fromDate, range.toDate]
    );

    const [commissionTimelineRows] = await connection.query(
      `
        SELECT
          DATE_FORMAT(profile.lot_project_client_profile_created_at, ?) AS period_start,
          COALESCE(SUM(commission.gross_commission_amount), 0) AS gross_commission,
          COALESCE(SUM(commission.released_commission_amount), 0) AS released_commission
        FROM lot_project_commissions commission
        INNER JOIN lot_project_client_profiles profile
          ON profile.lot_project_client_profile_id = commission.lot_project_client_profile_id
        INNER JOIN accredited_sellers recipient
          ON recipient.accredited_seller_id = commission.accredited_seller_id
        WHERE commission.lot_project_id = ?
          AND recipient.seller_group_id = ?
          AND commission.commission_status <> 'Cancelled'
          AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
        GROUP BY period_start
        ORDER BY period_start ASC
      `,
      [dateFormat, projectId, groupId, range.fromDate, range.toDate]
    );

    const [sellerRows] = await connection.query(
      `
        SELECT
          COALESCE(owner.accredited_seller_id, assigned.accredited_seller_id) AS seller_id,
          CASE
            WHEN assigned.is_system_dummy = 1 THEN ${fullNameSql('owner_user')}
            ELSE ${fullNameSql('assigned_user')}
          END AS seller_name,
          COUNT(DISTINCT profile.lot_project_client_profile_id) AS sales_count,
          COALESCE(SUM(${contractTcpExpr}), 0) AS sales_amount
        FROM lot_project_client_profiles profile
        INNER JOIN lot_project_listings listing
          ON listing.lot_project_listing_id = profile.lot_project_listing_id
        INNER JOIN accredited_sellers assigned
          ON assigned.accredited_seller_id = profile.assigned_accredited_seller_id
        INNER JOIN users assigned_user ON assigned_user.id = assigned.user_id
        LEFT JOIN accredited_sellers owner
          ON owner.accredited_seller_id = assigned.dummy_owner_accredited_seller_id
        LEFT JOIN users owner_user ON owner_user.id = owner.user_id
        WHERE profile.lot_project_id = ?
          AND assigned.seller_group_id = ?
          AND profile.lot_project_client_profile_status <> 'cancelled'
          AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
        GROUP BY seller_id, seller_name
        ORDER BY sales_amount DESC, sales_count DESC, seller_name ASC
        LIMIT 10
      `,
      [projectId, groupId, range.fromDate, range.toDate]
    );

    const salesSummary = salesSummaryRows[0] || {};
    const commissionSummary = commissionSummaryRows[0] || {};
    return res.json({
      success: true,
      data: {
        range,
        project: {
          id: Number(group.lot_project_id),
          name: group.lot_project_name,
        },
        summary: {
          salesCount: Number(salesSummary.sales_count || 0),
          salesAmount: Number(salesSummary.sales_amount || 0),
          averageSaleAmount: Number(salesSummary.average_sale_amount || 0),
          grossCommission: Number(commissionSummary.gross_commission || 0),
          releasedCommission: Number(commissionSummary.released_commission || 0),
          remainingCommission: Number(commissionSummary.remaining_commission || 0),
        },
        timeline: mergeGroupAnalyticsTimeline(salesTimelineRows, commissionTimelineRows),
        sellers: sellerRows.map((row) => ({
          sellerId: Number(row.seller_id || 0),
          sellerName: row.seller_name || 'Unassigned seller',
          salesCount: Number(row.sales_count || 0),
          salesAmount: Number(row.sales_amount || 0),
        })),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const getGroupProjectConfiguration = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.groupId || req.params.id || 0);
    const projectId = Number(req.params.projectId || 0);
    if (!groupId || !projectId) {
      return res.status(400).json({ message: 'Seller group and project are required.' });
    }

    await requireCommissionConfigurationSchema(connection);
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) return res.status(404).json({ message: 'Seller group or project not found.' });

    const members = await loadGroupProjectMembers(connection, groupId, projectId);
    const overrides = await loadGroupProjectOverrides(connection, groupId, projectId);
    const validation = buildConfigurationValidation(group, members, overrides);
    const accreditedProjects = await getGroupAccreditedProjects(connection, groupId);

    return res.json({
      success: true,
      data: {
        group: {
          id: Number(group.seller_group_id),
          name: group.seller_group_name,
          headUserId: group.seller_group_head_user_id
            ? Number(group.seller_group_head_user_id)
            : null,
          headName: group.group_head_name || null,
          description: group.seller_group_description,
          status: group.seller_group_status,
          projectRates: accreditedProjects,
        },
        project: {
          id: Number(group.lot_project_id),
          name: group.lot_project_name,
          slug: group.lot_project_slug,
          locationCode: group.lot_project_location_code,
          status: group.lot_project_status,
        },
        poolRate: Number(group.seller_group_pool_rate || 0),
        poolRateStatus: group.pool_rate_status,
        members,
        directRates: members
          .filter((member) => member.role === 'agent')
          .map((member) => ({
            accreditedSellerId: member.accredited_seller_id,
            sellerName: member.display_name,
            isSystemDummy: member.is_system_dummy,
            ownerName: member.owner_name || null,
            directRate: member.direct_rate,
            status: member.direct_rate_status || 'inactive',
          })),
        overrides,
        validation,
        accreditedProjects,
        summary: {
          activeMembers: members.filter((member) => !member.is_system_dummy && member.accredited_seller_status === 'active').length,
          accreditedProjects: accreditedProjects.length,
        },
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateGroupProjectPool = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.groupId || 0);
    const projectId = Number(req.params.projectId || 0);
    const poolRate = validatePoolRate(req.body.poolRate, 'Group commission pool');
    const status = normalizeStatus(req.body.status);
    if (!groupId || !projectId) throw createValidationError('Seller group and project are required.');

    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();

    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('Seller group or project not found.');

    await connection.query(
      `
        INSERT INTO seller_group_lot_project_rates (
          seller_group_id,
          lot_project_id,
          seller_group_pool_rate,
          seller_group_lot_project_rate_status
        ) VALUES (?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          seller_group_pool_rate = VALUES(seller_group_pool_rate),
          seller_group_lot_project_rate_status = VALUES(seller_group_lot_project_rate_status)
      `,
      [groupId, projectId, poolRate, status]
    );

    const members = await loadGroupProjectMembers(connection, groupId, projectId);
    const overrides = await loadGroupProjectOverrides(connection, groupId, projectId);
    const validation = buildConfigurationValidation(
      { ...group, seller_group_pool_rate: poolRate },
      members,
      overrides
    );
    const overAllocatedPaths = validation.paths.filter((path) =>
      path.errors.some((message) => message.includes('exceeds the'))
    );
    if (overAllocatedPaths.length > 0) {
      throw createValidationError(
        `The ${poolRate.toFixed(2)}% pool is lower than ${overAllocatedPaths.length} active commission path(s). Lower rates first or use a higher pool.`
      );
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Seller Groups',
      entityType: 'seller_group_project_pool',
      entityId: `${groupId}:${projectId}`,
      entityLabel: `${group.seller_group_name} — ${group.lot_project_name}`,
      title: 'Updated group project commission pool',
      description: `Set the ${group.lot_project_name} commission pool to ${poolRate.toFixed(2)}%.`,
      metadata: { groupId, projectId, poolRate, status },
    });

    await connection.commit();
    return res.json({ message: 'Project commission pool saved.', data: { poolRate, status } });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

const upsertSellerProjectRoleRate = async (
  connection,
  accreditedSellerId,
  role,
  projectId,
  rate,
  status
) => {
  await connection.query(
    `
      INSERT INTO accredited_seller_lot_project_rates (
        accredited_seller_id,
        lot_project_id,
        accredited_seller_project_rate,
        accredited_seller_lot_project_rate_status
      ) VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        accredited_seller_project_rate = VALUES(accredited_seller_project_rate),
        accredited_seller_lot_project_rate_status = VALUES(accredited_seller_lot_project_rate_status)
    `,
    [accreditedSellerId, projectId, rate, status]
  );

  await syncSellerRoleProjectRates(connection, accreditedSellerId, role, [{
    lot_project_id: projectId,
    accredited_seller_project_rate: rate,
    accredited_seller_lot_project_rate_status: status,
  }]);
};

export const upsertAgentDirectRate = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.groupId || 0);
    const projectId = Number(req.params.projectId || 0);
    const agentId = Number(req.params.agentId || 0);
    const directRate = validateSellerRate(req.body.directRate, 'Sales commission rate');
    const status = normalizeStatus(req.body.status);
    if (!groupId || !projectId || !agentId) throw createValidationError('Group, project, and agent are required.');

    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();

    const [sellerRows] = await connection.query(
      `
        SELECT acs.accredited_seller_id, acs.seller_group_id, u.role,
               ${fullNameSql('u')} AS seller_name
        FROM accredited_sellers acs
        INNER JOIN users u ON u.id = acs.user_id
        WHERE acs.accredited_seller_id = ?
          AND acs.seller_group_id = ?
          AND COALESCE(acs.is_system_dummy, 0) = 0
        LIMIT 1
      `,
      [agentId, groupId]
    );
    const seller = sellerRows[0];
    if (!seller) throw createValidationError('Sales agent does not belong to this seller group.');
    if (seller.role !== 'agent') throw createValidationError('Sales commission rates can only be assigned to agents.');

    await upsertSellerProjectRoleRate(
      connection,
      agentId,
      seller.role,
      projectId,
      directRate,
      status
    );

    const group = await getGroupAndProject(connection, groupId, projectId);
    const members = await loadGroupProjectMembers(connection, groupId, projectId);
    const overrides = await loadGroupProjectOverrides(connection, groupId, projectId);
    const validation = buildConfigurationValidation(group, members, overrides);
    const invalidPath = validation.paths.find((path) => Number(path.agentId) === agentId && path.hasErrors);
    if (invalidPath && !invalidPath.errors.every((message) => message.includes('no active sales commission rate'))) {
      throw createValidationError(invalidPath.errors[0]);
    }

    await writeAuditLog(connection, req, {
      action: status === 'inactive' ? 'delete' : 'update',
      module: 'Seller Groups',
      entityType: 'agent_project_direct_rate',
      entityId: `${agentId}:${projectId}`,
      entityLabel: seller.seller_name,
      title: status === 'inactive' ? 'Removed agent sales commission rate' : 'Saved agent sales commission rate',
      description: status === 'inactive'
        ? `Removed the project sales commission rate for ${seller.seller_name}.`
        : `Set ${seller.seller_name}'s project sales commission rate to ${directRate.toFixed(2)}%.`,
      metadata: { groupId, projectId, agentId, directRate, status },
    });

    await connection.commit();
    return res.json({
      message: status === 'inactive' ? 'Agent sales commission rate removed.' : 'Agent sales commission rate saved.',
      data: { agentId, directRate, status },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const upsertHierarchyOverride = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const groupId = Number(req.params.groupId || 0);
    const projectId = Number(req.params.projectId || 0);
    const childId = Number(req.params.childId || req.body.childId || 0);
    const parentId = Number(req.body.parentId || 0);
    const overrideRate = validateSellerRate(req.body.overrideRate, 'Override rate');
    const status = normalizeStatus(req.body.status);
    if (!groupId || !projectId || !childId || !parentId) {
      throw createValidationError('Child seller, parent seller, group, and project are required.');
    }
    if (childId === parentId) throw createValidationError('A seller cannot receive an override from themselves.');

    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();

    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('Seller group or project not found.');
    const members = await loadGroupProjectMembers(connection, groupId, projectId);
    const child = members.find((member) => Number(member.accredited_seller_id) === childId && !member.is_system_dummy);
    const parent = members.find((member) => Number(member.accredited_seller_id) === parentId && !member.is_system_dummy);
    if (!child || !parent) throw createValidationError('Both sellers must be real users in this seller group.');
    if (parent.role === 'agent') throw createValidationError('Agents receive sales rates and cannot receive hierarchy overrides.');
    if (getRequiredParentRole(child.role) !== parent.role) {
      throw createValidationError(
        `${SELLER_ROLE_LABELS[child.role] || child.role} can only report under a ${SELLER_ROLE_LABELS[getRequiredParentRole(child.role)] || 'valid parent seller'}.`
      );
    }

    const expectedParentId = child.parent_accredited_seller_id
      || members.find((member) => Number(member.user_id) === Number(group.seller_group_head_user_id))?.accredited_seller_id
      || null;
    if (Number(expectedParentId) !== parentId) {
      throw createValidationError('Override rates can only be assigned to the seller directly above this child.');
    }

    await upsertSellerProjectRoleRate(
      connection,
      parentId,
      parent.role,
      projectId,
      overrideRate,
      status
    );

    const refreshedOverrides = await loadGroupProjectOverrides(connection, groupId, projectId);
    const validation = buildConfigurationValidation(group, members, refreshedOverrides);
    // One relationship can affect several agents below the child. Validate only
    // those paths so unrelated incomplete branches do not block this save.
    const affectedPaths = validation.paths.filter((path) => path.chain.some((row) =>
      row.type === 'override'
      && Number(row.childSellerId) === childId
      && Number(row.sellerId) === parentId
    ));
    const invalidPath = affectedPaths.find((path) =>
      path.errors.some((message) => !message.includes('no active sales commission rate'))
    );
    if (invalidPath) {
      throw createValidationError(
        invalidPath.errors.find((message) => !message.includes('no active sales commission rate'))
      );
    }

    await writeAuditLog(connection, req, {
      action: status === 'inactive' ? 'delete' : 'update',
      module: 'Seller Groups',
      entityType: 'hierarchy_project_override',
      entityId: `${childId}:${parentId}:${projectId}`,
      entityLabel: `${parent.display_name} override from ${child.display_name}`,
      title: status === 'inactive' ? 'Removed hierarchy override' : 'Saved hierarchy override',
      description: status === 'inactive'
        ? `Removed ${parent.display_name}'s override from ${child.display_name}.`
        : `Set ${parent.display_name}'s override from ${child.display_name} to ${overrideRate.toFixed(2)}%.`,
      metadata: { groupId, projectId, childId, parentId, overrideRate, status },
    });

    await connection.commit();
    return res.json({
      message: status === 'inactive' ? 'Hierarchy override removed.' : 'Hierarchy override saved.',
      data: { childId, parentId, overrideRate, status },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateMemberProjectRates = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const groupId = Number(req.params.groupId || 0);
    const projectId = Number(req.params.projectId || 0);
    const memberId = Number(req.params.memberId || 0);
    if (!groupId || !projectId || !memberId) {
      throw createValidationError('Seller group, project, and member are required.');
    }

    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();

    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('This seller group is not accredited to the selected project.');

    let members = await loadGroupProjectMembers(connection, groupId, projectId);
    const member = members.find((row) => Number(row.accredited_seller_id) === memberId && !row.is_system_dummy);
    if (!member) throw createValidationError('Seller group member was not found.');

    const rateType = member.role === 'agent' ? 'direct' : 'override';
    const rateLabel = rateType === 'direct' ? 'Sales commission rate' : 'Override commission rate';
    const rate = validateSellerRate(
      req.body.rate ?? (rateType === 'direct' ? req.body.directRate : req.body.overrideRate),
      rateLabel
    );
    const rateStatus = normalizeStatus(
      req.body.rateStatus ?? (rateType === 'direct' ? req.body.directStatus : req.body.overrideStatus)
    );

    if (rateStatus === 'active' && rate <= 0) {
      throw createValidationError(`An active ${rateLabel.toLowerCase()} must be greater than 0%.`);
    }

    await upsertSellerProjectRoleRate(
      connection,
      memberId,
      member.role,
      projectId,
      rate,
      rateStatus
    );

    members = await loadGroupProjectMembers(connection, groupId, projectId);
    const overrides = await loadGroupProjectOverrides(connection, groupId, projectId);
    const validation = buildConfigurationValidation(group, members, overrides);
    const invalidPath = validation.paths.find((path) =>
      path.chain.some((row) => Number(row.sellerId) === memberId)
      && path.errors.some((message) => !message.includes('no active sales commission rate'))
    );
    if (invalidPath) {
      throw createValidationError(
        invalidPath.errors.find((message) => !message.includes('no active sales commission rate'))
      );
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Seller Groups',
      entityType: 'seller_project_rate',
      entityId: `${memberId}:${projectId}`,
      entityLabel: member.display_name,
      title: `Updated seller ${rateType} rate`,
      description: `Set ${member.display_name}'s ${rateType} rate for ${group.lot_project_name} to ${rate.toFixed(2)}%.`,
      metadata: { groupId, projectId, memberId, role: member.role, rateType, rate, rateStatus },
    });

    await connection.commit();
    return res.json({
      message: `${rateType === 'direct' ? 'Sales' : 'Override'} rate saved.`,
      data: { memberId, role: member.role, rateType, rate, rateStatus },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

