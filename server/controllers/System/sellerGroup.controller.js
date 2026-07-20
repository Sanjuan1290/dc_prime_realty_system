import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { columnExists, tableExists } from '../Lot_Projects/_shared/lotProject.shared.js';
import { validateGroupFixedRateStructure } from './groupFixedCommissionRates.service.js';
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

  if (!head) return;

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
  }
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

export const normalizeGroupProjectRates = (
  projectRates = [],
  projects = [],
  { groupHeadRole = 'broker_network_manager' } = {}
) => {
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

    const rates = validateGroupFixedRateStructure(item, {
      groupHeadRole,
      projectName: project.lot_project_name,
    });

    return {
      lot_project_id: projectId,
      ...rates,
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
        bnm_override_rate,
        broker_override_rate,
        manager_override_rate,
        agent_rate,
        seller_group_lot_project_rate_status
      ) VALUES ${projectRates.map(() => '(?, ?, ?, ?, ?, ?, ?, "active")').join(', ')}
      ON DUPLICATE KEY UPDATE
        seller_group_pool_rate = VALUES(seller_group_pool_rate),
        bnm_override_rate = VALUES(bnm_override_rate),
        broker_override_rate = VALUES(broker_override_rate),
        manager_override_rate = VALUES(manager_override_rate),
        agent_rate = VALUES(agent_rate),
        seller_group_lot_project_rate_status = 'active'
    `,
    projectRates.flatMap((rate) => [
      groupId,
      rate.lot_project_id,
      rate.seller_group_pool_rate,
      rate.bnm_override_rate,
      rate.broker_override_rate,
      rate.manager_override_rate,
      rate.agent_rate,
    ])
  );
};

const deactivateLegacyIndividualRates = async (connection, groupId) => {
  if (await tableExists(connection, 'accredited_seller_lot_project_rates')) {
    await connection.query(
      `
        UPDATE accredited_seller_lot_project_rates role_rate
        INNER JOIN accredited_sellers seller
          ON seller.accredited_seller_id = role_rate.accredited_seller_id
        SET role_rate.accredited_seller_lot_project_rate_status = 'inactive'
        WHERE seller.seller_group_id = ?
      `,
      [groupId]
    );
  }
  if (await tableExists(connection, 'agent_lot_project_direct_rates')) {
    await connection.query(
      `
        UPDATE agent_lot_project_direct_rates direct_rate
        INNER JOIN accredited_sellers seller
          ON seller.accredited_seller_id = direct_rate.accredited_seller_id
        SET direct_rate.direct_rate_status = 'inactive'
        WHERE seller.seller_group_id = ?
      `,
      [groupId]
    );
  }
  if (await tableExists(connection, 'seller_hierarchy_lot_project_overrides')) {
    await connection.query(
      `
        UPDATE seller_hierarchy_lot_project_overrides override_row
        INNER JOIN accredited_sellers child
          ON child.accredited_seller_id = override_row.child_accredited_seller_id
        SET override_row.override_rate_status = 'inactive'
        WHERE child.seller_group_id = ?
      `,
      [groupId]
    );
  }
};

const syncGroupProjectAccreditations = async (connection, groupId, projectRates) => {
  await upsertGroupProjectRates(connection, groupId, projectRates);

  const selectedIds = projectRates.map((rate) => Number(rate.lot_project_id));
  const placeholders = selectedIds.map(() => '?').join(', ');

  await connection.query(
    `
      UPDATE seller_group_lot_project_rates
      SET seller_group_lot_project_rate_status = 'inactive'
      WHERE seller_group_id = ?
        AND lot_project_id NOT IN (${placeholders})
    `,
    [groupId, ...selectedIds]
  );

  await deactivateLegacyIndividualRates(connection, groupId);
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
        sgr.bnm_override_rate,
        sgr.broker_override_rate,
        sgr.manager_override_rate,
        sgr.agent_rate,
        ROUND(
          sgr.bnm_override_rate
          + sgr.broker_override_rate
          + sgr.manager_override_rate
          + sgr.agent_rate,
          2
        ) AS allocated_rate,
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
    rateMap.get(rate.seller_group_id).push({
      ...rate,
      seller_group_pool_rate: Number(rate.seller_group_pool_rate || 0),
      bnm_override_rate: Number(rate.bnm_override_rate || 0),
      broker_override_rate: Number(rate.broker_override_rate || 0),
      manager_override_rate: Number(rate.manager_override_rate || 0),
      agent_rate: Number(rate.agent_rate || 0),
      allocated_rate: Number(rate.allocated_rate || 0),
    });
  });

  return groups.map((group) => ({
    ...group,
    project_rates: rateMap.get(group.seller_group_id) || [],
  }));
};

const hydrateMemberRates = async (members) => members.map((member) => ({
  ...member,
  project_rates: [],
}));

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
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects, { groupHeadRole: groupHead?.role });
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates);

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
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects, { groupHeadRole: groupHead?.role });
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates);

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
  const requiredColumns = [
    'bnm_override_rate',
    'broker_override_rate',
    'manager_override_rate',
    'agent_rate',
  ];

  for (const columnName of requiredColumns) {
    if (!(await columnExists(connection, 'seller_group_lot_project_rates', columnName))) {
      throw createValidationError(
        'Group fixed commission rates need the 20260720 group-fixed-rate migration.'
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
        sgr.bnm_override_rate,
        sgr.broker_override_rate,
        sgr.manager_override_rate,
        sgr.agent_rate,
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

const loadGroupProjectMembers = async (connection, groupId) => {
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
        ${fullNameSql('owner_user')} AS owner_name
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      LEFT JOIN accredited_sellers parent_acs
        ON parent_acs.user_id = acs.accredited_seller_reports_under_user_id
      LEFT JOIN users parent_user ON parent_user.id = parent_acs.user_id
      LEFT JOIN accredited_sellers owner_acs
        ON owner_acs.accredited_seller_id = acs.dummy_owner_accredited_seller_id
      LEFT JOIN users owner_user ON owner_user.id = owner_acs.user_id
      WHERE acs.seller_group_id = ?
      ORDER BY
        FIELD(u.role, 'broker_network_manager', 'broker', 'manager', 'agent'),
        COALESCE(acs.is_system_dummy, 0),
        full_name ASC
    `,
    [groupId]
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
    display_name: Number(row.is_system_dummy || 0) === 1 && row.owner_name
      ? `${row.owner_name} — Direct Sales Agent`
      : row.full_name,
  }));
};

export const assertGroupCurrentPathsWithinPools = async (connection, groupId) => {
  if (!groupId) return;
  await requireCommissionConfigurationSchema(connection);
  const [projectRates] = await connection.query(
    `
      SELECT
        rate.*,
        project.lot_project_name,
        head_user.role AS group_head_role
      FROM seller_group_lot_project_rates rate
      INNER JOIN seller_groups group_row
        ON group_row.seller_group_id = rate.seller_group_id
      INNER JOIN lot_projects project
        ON project.lot_project_id = rate.lot_project_id
      LEFT JOIN users head_user
        ON head_user.id = group_row.seller_group_head_user_id
      WHERE rate.seller_group_id = ?
        AND rate.seller_group_lot_project_rate_status = 'active'
    `,
    [groupId]
  );

  projectRates.forEach((rate) => validateGroupFixedRateStructure(rate, {
    groupHeadRole: rate.group_head_role || 'broker_network_manager',
    projectName: rate.lot_project_name || 'Project',
  }));
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
        rate.bnm_override_rate,
        rate.broker_override_rate,
        rate.manager_override_rate,
        rate.agent_rate,
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
    bnm_override_rate: Number(row.bnm_override_rate || 0),
    broker_override_rate: Number(row.broker_override_rate || 0),
    manager_override_rate: Number(row.manager_override_rate || 0),
    agent_rate: Number(row.agent_rate || 0),
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

    const members = await loadGroupProjectMembers(connection, groupId);
    const accreditedProjects = await getGroupAccreditedProjects(connection, groupId);
    const fixedRates = validateGroupFixedRateStructure(group, {
      groupHeadRole: members.find((member) => Number(member.user_id) === Number(group.seller_group_head_user_id))?.role || 'broker_network_manager',
      projectName: group.lot_project_name,
    });

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
        poolRate: fixedRates.seller_group_pool_rate,
        poolRateStatus: group.pool_rate_status,
        fixedRates: {
          poolRate: fixedRates.seller_group_pool_rate,
          bnmOverrideRate: fixedRates.bnm_override_rate,
          brokerOverrideRate: fixedRates.broker_override_rate,
          managerOverrideRate: fixedRates.manager_override_rate,
          agentRate: fixedRates.agent_rate,
          allocatedRate: fixedRates.allocated_rate,
          remainingRate: fixedRates.remaining_rate,
        },
        members,
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
    if (!groupId || !projectId) throw createValidationError('Seller group and project are required.');

    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();

    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('Seller group or project not found.');
    const [headRows] = await connection.query(
      `SELECT role FROM users WHERE id = ? LIMIT 1`,
      [group.seller_group_head_user_id || 0]
    );
    const rates = validateGroupFixedRateStructure({
      seller_group_pool_rate: req.body.poolRate ?? req.body.seller_group_pool_rate,
      bnm_override_rate: req.body.bnmOverrideRate ?? req.body.bnm_override_rate,
      broker_override_rate: req.body.brokerOverrideRate ?? req.body.broker_override_rate,
      manager_override_rate: req.body.managerOverrideRate ?? req.body.manager_override_rate,
      agent_rate: req.body.agentRate ?? req.body.agent_rate,
    }, {
      groupHeadRole: headRows[0]?.role || 'broker_network_manager',
      projectName: group.lot_project_name,
    });
    const status = normalizeStatus(req.body.status);

    await connection.query(
      `
        UPDATE seller_group_lot_project_rates
        SET
          seller_group_pool_rate = ?,
          bnm_override_rate = ?,
          broker_override_rate = ?,
          manager_override_rate = ?,
          agent_rate = ?,
          seller_group_lot_project_rate_status = ?
        WHERE seller_group_id = ?
          AND lot_project_id = ?
      `,
      [
        rates.seller_group_pool_rate,
        rates.bnm_override_rate,
        rates.broker_override_rate,
        rates.manager_override_rate,
        rates.agent_rate,
        status,
        groupId,
        projectId,
      ]
    );
    await deactivateLegacyIndividualRates(connection, groupId);

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Seller Groups',
      entityType: 'seller_group_project_rates',
      entityId: `${groupId}:${projectId}`,
      entityLabel: `${group.seller_group_name} — ${group.lot_project_name}`,
      title: 'Updated fixed group commission rates',
      description: `Updated the fixed role rates for ${group.seller_group_name} in ${group.lot_project_name}.`,
      metadata: { groupId, projectId, ...rates, status },
    });

    await connection.commit();
    return res.json({
      message: 'Fixed group commission rates updated successfully.',
      data: rates,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
