import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { columnExists, tableExists } from '../Lot_Projects/_shared/lotProject.shared.js';
import {
  normalizeSellerGroupType,
  validateGroupFixedRateStructure,
} from './groupFixedCommissionRates.service.js';
import {
  EXTERNAL_GROUP_ROLE,
  getRequiredParentRole,
  isExternalGroupRole,
  isGroupHeadRole,
  SELLER_ROLE_LABELS,
} from './sellerHierarchyRules.js';

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const getErrorMessage = (error) => {
  if (error?.statusCode && error?.message) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') {
    if (String(error?.sqlMessage || '').includes('email')) return 'That email address is already in use.';
    return 'A group with the same unique information already exists.';
  }
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) {
    return 'Database operation failed. Apply the In-House and External Groups migration, then try again.';
  }
  return error?.message || 'Something went wrong.';
};

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const fullNameSql = (alias) => `TRIM(CONCAT_WS(' ', ${alias}.first_name, ${alias}.middle_name, ${alias}.last_name))`;
const normalizeStatus = (status) => (String(status || '').toLowerCase() === 'inactive' ? 'inactive' : 'active');
const groupTypeLabel = (groupType) => normalizeSellerGroupType(groupType) === 'external' ? 'External Group' : 'In-House Group';

const requireGroupTypeSchema = async (connection) => {
  const requirements = [
    ['seller_groups', 'seller_group_type'],
    ['seller_groups', 'seller_group_external_account_user_id'],
    ['seller_group_lot_project_rates', 'commission_structure_type'],
    ['seller_group_lot_project_rates', 'division_manager_rate'],
    ['seller_group_lot_project_rates', 'sales_director_rate'],
    ['seller_group_lot_project_rates', 'unit_manager_rate'],
    ['seller_group_lot_project_rates', 'sales_agent_rate'],
  ];
  for (const [tableName, columnName] of requirements) {
    if (!(await columnExists(connection, tableName, columnName))) {
      throw createValidationError('In-House and External Groups need the latest database migration.');
    }
  }
};

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
        COALESCE(seller.is_system_dummy, 0) AS is_system_dummy,
        group_row.seller_group_type
      FROM users user
      INNER JOIN accredited_sellers seller ON seller.user_id = user.id
      LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
      WHERE user.id = ?
      LIMIT 1
    `,
    [normalizedUserId]
  );
  const head = rows[0];

  if (!head || Number(head.is_system_dummy || 0) === 1) {
    throw createValidationError('The selected Group Head is not an accredited in-house seller.');
  }
  if (!isGroupHeadRole(head.role)) {
    throw createValidationError('Only a Division Manager or Sales Director can be the head of an In-House Group.');
  }
  if (head.user_status !== 'active' || head.accredited_seller_status !== 'active') {
    throw createValidationError('The selected Group Head must be active.');
  }
  if (head.seller_group_type && head.seller_group_type !== 'in_house') {
    throw createValidationError('An External Group account cannot be used as an In-House Group Head.');
  }
  if (head.seller_group_id && Number(head.seller_group_id) !== Number(groupId || 0)) {
    throw createValidationError('The selected Group Head already belongs to another group.');
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
  if (previousHead.role === 'sales_director' && nextHead.role === 'division_manager') return;
  throw createValidationError(
    'This group already has a head whose position cannot report under the selected replacement. Update the current hierarchy first.'
  );
};

const attachAndSyncGroupHead = async (connection, groupId, head, previousHead = null) => {
  validateGroupHeadTransition(previousHead, head);
  if (!head) return;

  await connection.query(
    `UPDATE accredited_sellers
     SET seller_group_id = ?, accredited_seller_reports_under_user_id = NULL
     WHERE accredited_seller_id = ?`,
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
    && previousHead.role === 'sales_director'
    && head.role === 'division_manager'
  ) {
    await connection.query(
      `UPDATE accredited_sellers
       SET accredited_seller_reports_under_user_id = ?
       WHERE accredited_seller_id = ?`,
      [head.user_id, previousHead.accredited_seller_id]
    );
    if (await tableExists(connection, 'accredited_seller_managed_sellers')) {
      await connection.query(
        `DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?`,
        [previousHead.accredited_seller_id]
      );
      await connection.query(
        `INSERT INTO accredited_seller_managed_sellers (
           manager_accredited_seller_id, managed_accredited_seller_id
         ) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE updated_at = NOW()`,
        [head.accredited_seller_id, previousHead.accredited_seller_id]
      );
    }
  }
};

export const assignTopLevelSellerAsGroupHead = async (connection, groupId, userId) => {
  const [groupRows] = await connection.query(
    `SELECT seller_group_type FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
    [groupId]
  );
  if (normalizeSellerGroupType(groupRows[0]?.seller_group_type) !== 'in_house') {
    throw createValidationError('External Groups do not use an in-house Group Head.');
  }

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

  const [groupRows] = await connection.query(
    `SELECT seller_group_id, seller_group_type, seller_group_head_user_id,
            seller_group_external_account_user_id
     FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
    [groupId]
  );
  const group = groupRows[0];
  if (!group) throw createValidationError('The selected group was not found.');
  const groupType = normalizeSellerGroupType(group.seller_group_type);

  const [rows] = await connection.query(
    `
      SELECT
        seller.accredited_seller_id,
        seller.user_id,
        seller.accredited_seller_reports_under_user_id,
        seller.seller_group_id,
        user.role,
        ${fullNameSql('user')} AS full_name,
        parent_seller.accredited_seller_id AS parent_accredited_seller_id,
        parent_seller.seller_group_id AS parent_group_id,
        parent_user.role AS parent_role
      FROM accredited_sellers seller
      INNER JOIN users user ON user.id = seller.user_id
      LEFT JOIN users parent_user ON parent_user.id = seller.accredited_seller_reports_under_user_id
      LEFT JOIN accredited_sellers parent_seller ON parent_seller.user_id = parent_user.id
      WHERE seller.seller_group_id = ?
        AND COALESCE(seller.is_system_dummy, 0) = 0
      ORDER BY seller.accredited_seller_id ASC
    `,
    [groupId]
  );

  if (groupType === 'external') {
    if (!group.seller_group_external_account_user_id) {
      throw createValidationError('An External Group must have one representative account.');
    }
    const externalRows = rows.filter((row) => isExternalGroupRole(row.role));
    if (externalRows.length !== 1 || rows.length !== 1) {
      throw createValidationError('An External Group must contain exactly one External Group account.');
    }
    const account = externalRows[0];
    if (Number(account.user_id) !== Number(group.seller_group_external_account_user_id)) {
      throw createValidationError('The External Group representative does not match the group account.');
    }
    if (account.accredited_seller_reports_under_user_id) {
      throw createValidationError('An External Group account cannot have a reporting parent.');
    }
    return;
  }

  const headUserId = Number(group.seller_group_head_user_id || 0);
  const topLevelSellers = rows.filter((seller) => !seller.accredited_seller_reports_under_user_id);
  if (headUserId) {
    const head = rows.find((seller) => Number(seller.user_id) === headUserId);
    if (!head) throw createValidationError('The In-House Group Head must belong to the same group.');
    if (!isGroupHeadRole(head.role)) {
      throw createValidationError('Only a Division Manager or Sales Director can be the In-House Group Head.');
    }
    if (head.accredited_seller_reports_under_user_id) {
      throw createValidationError('The In-House Group Head must report directly to the developer.');
    }
  } else if (topLevelSellers.length > 1) {
    throw createValidationError('A headless In-House Group can have only one top-level Division Manager or Sales Director.');
  }

  for (const seller of rows) {
    if (isExternalGroupRole(seller.role)) {
      throw createValidationError('An External Group account cannot be assigned to an In-House Group.');
    }
    const isHead = headUserId && Number(seller.user_id) === headUserId;
    if (!seller.accredited_seller_reports_under_user_id) {
      if (isHead || (!headUserId && isGroupHeadRole(seller.role))) continue;
      const expected = getRequiredParentRole(seller.role);
      throw createValidationError(`${seller.full_name || 'Seller'} must report under a ${SELLER_ROLE_LABELS[expected] || 'valid in-house parent'}.`);
    }
    if (isHead) throw createValidationError('The In-House Group Head cannot have a reporting parent.');
    if (!seller.parent_accredited_seller_id || Number(seller.parent_group_id) !== Number(groupId)) {
      throw createValidationError(`${seller.full_name || 'Seller'} must report under an in-house seller from the same group.`);
    }
    const expectedParentRole = getRequiredParentRole(seller.role);
    if (!expectedParentRole || seller.parent_role !== expectedParentRole) {
      throw createValidationError(
        `${seller.full_name || 'Seller'} is a ${SELLER_ROLE_LABELS[seller.role] || seller.role} and can only report under a ${SELLER_ROLE_LABELS[expectedParentRole] || 'valid parent'}.`
      );
    }
  }
};

const getActiveLotProjects = async (connection = db) => {
  const [projects] = await connection.query(
    `SELECT lot_project_id, lot_project_name, lot_project_slug,
            lot_project_location, lot_project_location_code
     FROM lot_projects
     WHERE lot_project_status = 'active'
     ORDER BY lot_project_name ASC`
  );
  return projects;
};

export const normalizeGroupProjectRates = (
  projectRates = [],
  projects = [],
  { groupHeadRole = 'division_manager', groupType = 'in_house' } = {}
) => {
  if (!Array.isArray(projectRates) || projectRates.length === 0) {
    throw createValidationError(`Select at least one accredited project for this ${groupTypeLabel(groupType)}.`);
  }
  const projectMap = new Map(projects.map((project) => [Number(project.lot_project_id), project]));
  const selectedProjectIds = new Set();
  return projectRates.map((item) => {
    const projectId = Number(item?.lot_project_id);
    const project = projectMap.get(projectId);
    if (!project) throw createValidationError('One or more selected projects are unavailable or inactive.');
    if (selectedProjectIds.has(projectId)) throw createValidationError(`${project.lot_project_name} was selected more than once.`);
    selectedProjectIds.add(projectId);
    const rates = validateGroupFixedRateStructure(item, {
      groupHeadRole,
      projectName: project.lot_project_name,
      groupType,
    });
    return {
      lot_project_id: projectId,
      commission_structure_type: normalizeSellerGroupType(groupType),
      ...rates,
    };
  });
};

const upsertGroupProjectRates = async (connection, groupId, projectRates) => {
  if (!projectRates.length) return;
  await connection.query(
    `
      INSERT INTO seller_group_lot_project_rates (
        seller_group_id, lot_project_id, seller_group_pool_rate,
        division_manager_rate, sales_director_rate, unit_manager_rate,
        sales_agent_rate, commission_structure_type,
        seller_group_lot_project_rate_status
      ) VALUES ${projectRates.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, 'active')").join(', ')}
      ON DUPLICATE KEY UPDATE
        seller_group_pool_rate = VALUES(seller_group_pool_rate),
        division_manager_rate = VALUES(division_manager_rate),
        sales_director_rate = VALUES(sales_director_rate),
        unit_manager_rate = VALUES(unit_manager_rate),
        sales_agent_rate = VALUES(sales_agent_rate),
        commission_structure_type = VALUES(commission_structure_type),
        seller_group_lot_project_rate_status = 'active'
    `,
    projectRates.flatMap((rate) => [
      groupId,
      rate.lot_project_id,
      rate.seller_group_pool_rate,
      rate.division_manager_rate,
      rate.sales_director_rate,
      rate.unit_manager_rate,
      rate.sales_agent_rate,
      rate.commission_structure_type,
    ])
  );
};

const deactivateLegacyIndividualRates = async (connection, groupId) => {
  if (await tableExists(connection, 'accredited_seller_lot_project_rates')) {
    await connection.query(
      `UPDATE accredited_seller_lot_project_rates role_rate
       INNER JOIN accredited_sellers seller ON seller.accredited_seller_id = role_rate.accredited_seller_id
       SET role_rate.accredited_seller_lot_project_rate_status = 'inactive'
       WHERE seller.seller_group_id = ?`,
      [groupId]
    );
  }
  if (await tableExists(connection, 'agent_lot_project_direct_rates')) {
    await connection.query(
      `UPDATE agent_lot_project_direct_rates direct_rate
       INNER JOIN accredited_sellers seller ON seller.accredited_seller_id = direct_rate.accredited_seller_id
       SET direct_rate.direct_rate_status = 'inactive'
       WHERE seller.seller_group_id = ?`,
      [groupId]
    );
  }
  if (await tableExists(connection, 'seller_hierarchy_lot_project_overrides')) {
    await connection.query(
      `UPDATE seller_hierarchy_lot_project_overrides override_row
       INNER JOIN accredited_sellers child ON child.accredited_seller_id = override_row.child_accredited_seller_id
       SET override_row.override_rate_status = 'inactive'
       WHERE child.seller_group_id = ?`,
      [groupId]
    );
  }
};

const syncGroupProjectAccreditations = async (connection, groupId, projectRates) => {
  await upsertGroupProjectRates(connection, groupId, projectRates);
  const selectedIds = projectRates.map((rate) => Number(rate.lot_project_id));
  if (!selectedIds.length) return;
  const placeholders = selectedIds.map(() => '?').join(', ');
  await connection.query(
    `UPDATE seller_group_lot_project_rates
     SET seller_group_lot_project_rate_status = 'inactive'
     WHERE seller_group_id = ? AND lot_project_id NOT IN (${placeholders})`,
    [groupId, ...selectedIds]
  );
  await deactivateLegacyIndividualRates(connection, groupId);
};

const getExternalAccount = async (connection, groupId) => {
  const [rows] = await connection.query(
    `
      SELECT
        u.id AS user_id,
        a.accredited_seller_id,
        ${fullNameSql('u')} AS full_name,
        u.first_name, u.middle_name, u.last_name, u.email,
        u.contact_no, u.tin_no, u.prc_no, u.address,
        u.role, u.status, u.can_login
      FROM seller_groups sg
      LEFT JOIN users u ON u.id = sg.seller_group_external_account_user_id
      LEFT JOIN accredited_sellers a ON a.user_id = u.id
      WHERE sg.seller_group_id = ?
      LIMIT 1
    `,
    [groupId]
  );
  return rows[0]?.user_id ? rows[0] : null;
};

const createExternalAccount = async (connection, groupId, account = {}, status = 'active') => {
  const firstName = String(account.first_name || '').trim();
  const lastName = String(account.last_name || '').trim();
  const email = String(account.email || '').trim().toLowerCase();
  if (!firstName || !lastName || !email) {
    throw createValidationError('External Group representative first name, last name, and email are required.');
  }
  const passwordHash = await bcrypt.hash(String(account.password || randomUUID()), 10);
  const [userResult] = await connection.query(
    `INSERT INTO users (
       first_name, middle_name, last_name, contact_no, tin_no, prc_no, address,
       email, password_hash, role, status, must_change_password, can_login, is_system_account
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    [
      firstName,
      String(account.middle_name || '').trim() || null,
      lastName,
      String(account.contact_no || '').trim() || null,
      String(account.tin_no || '').trim() || null,
      String(account.prc_no || '').trim() || null,
      String(account.address || '').trim() || null,
      email,
      passwordHash,
      EXTERNAL_GROUP_ROLE,
      normalizeStatus(status),
    ]
  );
  const userId = Number(userResult.insertId);
  const [sellerResult] = await connection.query(
    `INSERT INTO accredited_sellers (
       user_id, seller_group_id, accredited_seller_reports_under_user_id,
       accredited_seller_accreditation_date, accredited_seller_status
     ) VALUES (?, ?, NULL, CURRENT_DATE, ?)`,
    [userId, groupId, normalizeStatus(status)]
  );
  await connection.query(
    `UPDATE seller_groups SET seller_group_external_account_user_id = ? WHERE seller_group_id = ?`,
    [userId, groupId]
  );
  return { userId, accreditedSellerId: Number(sellerResult.insertId) };
};

const updateExternalAccount = async (connection, groupId, account = {}, status = 'active') => {
  const current = await getExternalAccount(connection, groupId);
  if (!current) throw createValidationError('The External Group account was not found.');
  const firstName = String(account.first_name || current.first_name || '').trim();
  const lastName = String(account.last_name || current.last_name || '').trim();
  const email = String(account.email || current.email || '').trim().toLowerCase();
  if (!firstName || !lastName || !email) {
    throw createValidationError('External Group representative first name, last name, and email are required.');
  }
  await connection.query(
    `UPDATE users SET
       first_name = ?, middle_name = ?, last_name = ?, email = ?,
       contact_no = ?, tin_no = ?, prc_no = ?, address = ?,
       role = ?, status = ?, can_login = 0, is_system_account = 0
     WHERE id = ?`,
    [
      firstName,
      String(account.middle_name ?? current.middle_name ?? '').trim() || null,
      lastName,
      email,
      String(account.contact_no ?? current.contact_no ?? '').trim() || null,
      String(account.tin_no ?? current.tin_no ?? '').trim() || null,
      String(account.prc_no ?? current.prc_no ?? '').trim() || null,
      String(account.address ?? current.address ?? '').trim() || null,
      EXTERNAL_GROUP_ROLE,
      normalizeStatus(status),
      current.user_id,
    ]
  );
  await connection.query(
    `UPDATE accredited_sellers SET
       seller_group_id = ?, accredited_seller_reports_under_user_id = NULL,
       accredited_seller_status = ?
     WHERE accredited_seller_id = ?`,
    [groupId, normalizeStatus(status), current.accredited_seller_id]
  );
};

const hydrateGroupRates = async (groups, connection = db) => {
  const groupIds = groups.map((group) => Number(group.seller_group_id)).filter(Boolean);
  if (!groupIds.length) return groups.map((group) => ({ ...group, project_rates: [] }));
  const placeholders = groupIds.map(() => '?').join(', ');
  const [rateRows] = await connection.query(
    `
      SELECT
        sgr.seller_group_id, sgr.lot_project_id,
        lp.lot_project_name, lp.lot_project_slug, lp.lot_project_location_code,
        sgr.seller_group_pool_rate, sgr.division_manager_rate,
        sgr.sales_director_rate, sgr.unit_manager_rate, sgr.sales_agent_rate,
        sgr.commission_structure_type,
        CASE WHEN sgr.commission_structure_type = 'external'
          THEN sgr.seller_group_pool_rate
          ELSE ROUND(sgr.division_manager_rate + sgr.sales_director_rate + sgr.unit_manager_rate + sgr.sales_agent_rate, 2)
        END AS allocated_rate,
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
    const groupId = Number(rate.seller_group_id);
    if (!rateMap.has(groupId)) rateMap.set(groupId, []);
    rateMap.get(groupId).push({
      ...rate,
      lot_project_id: Number(rate.lot_project_id),
      seller_group_pool_rate: Number(rate.seller_group_pool_rate || 0),
      division_manager_rate: Number(rate.division_manager_rate || 0),
      sales_director_rate: Number(rate.sales_director_rate || 0),
      unit_manager_rate: Number(rate.unit_manager_rate || 0),
      sales_agent_rate: Number(rate.sales_agent_rate || 0),
      allocated_rate: Number(rate.allocated_rate || 0),
    });
  });
  return groups.map((group) => ({
    ...group,
    seller_group_id: Number(group.seller_group_id),
    member_count: Number(group.member_count || 0),
    active_member_count: Number(group.active_member_count || 0),
    project_rates: rateMap.get(Number(group.seller_group_id)) || [],
  }));
};

const hydrateMemberRates = async (members) => members.map((member) => ({ ...member, project_rates: [] }));

export const createGroup = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await requireGroupTypeSchema(connection);
    const {
      seller_group_name,
      seller_group_type = 'in_house',
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status = 'active',
      project_rates = [],
      external_account = {},
    } = req.body;
    const groupType = normalizeSellerGroupType(seller_group_type);
    const name = String(seller_group_name || '').trim();
    if (!name) return res.status(400).json({ message: 'Group Name is required.' });

    await connection.beginTransaction();
    const groupHead = groupType === 'in_house'
      ? await validateGroupHead(connection, seller_group_head_user_id)
      : null;
    if (groupType === 'external' && seller_group_head_user_id) {
      throw createValidationError('External Groups do not use an in-house Group Head.');
    }

    const [result] = await connection.query(
      `INSERT INTO seller_groups (
         seller_group_name, seller_group_type, seller_group_head_user_id,
         seller_group_external_account_user_id, seller_group_description, seller_group_status
       ) VALUES (?, ?, ?, NULL, ?, ?)`,
      [name, groupType, groupHead?.user_id || null, String(seller_group_description || '').trim() || null, normalizeStatus(seller_group_status)]
    );
    const groupId = Number(result.insertId);

    if (groupType === 'external') {
      await createExternalAccount(connection, groupId, external_account, seller_group_status);
    } else if (groupHead) {
      await attachAndSyncGroupHead(connection, groupId, groupHead);
    }

    await assertSellerGroupRoleHierarchy(connection, groupId);
    const projects = await getActiveLotProjects(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects, {
      groupHeadRole: groupHead?.role || 'division_manager',
      groupType,
    });
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Groups',
      entityType: 'seller_group',
      entityId: String(groupId),
      entityLabel: name,
      title: `Created ${groupTypeLabel(groupType)}`,
      description: `Created ${groupTypeLabel(groupType)} ${name}.`,
      metadata: { groupType, status: normalizeStatus(seller_group_status), projectRates: normalizedRates },
    });
    await connection.commit();
    return res.status(201).json({ message: `${groupTypeLabel(groupType)} created successfully.`, seller_group_id: groupId });
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
    const projectId = Math.max(Number(req.query.project) || 0, 0);
    const groupType = normalizeSellerGroupType(req.query.groupType || req.query.seller_group_type || 'in_house');
    const where = ['sg.seller_group_type = ?'];
    const params = [groupType];

    if (search) {
      where.push(`(
        sg.seller_group_name LIKE ? OR IFNULL(sg.seller_group_description, '') LIKE ? OR
        ${fullNameSql('head_user')} LIKE ? OR ${fullNameSql('external_user')} LIKE ? OR
        IFNULL(external_user.email, '') LIKE ?
      )`);
      const term = `%${search}%`;
      params.push(term, term, term, term, term);
    }
    if (status === 'active' || status === 'inactive') {
      where.push('sg.seller_group_status = ?');
      params.push(status);
    }
    if (projectId) {
      where.push(`EXISTS (
        SELECT 1 FROM seller_group_lot_project_rates filter_rate
        WHERE filter_rate.seller_group_id = sg.seller_group_id
          AND filter_rate.lot_project_id = ?
          AND filter_rate.seller_group_lot_project_rate_status = 'active'
      )`);
      params.push(projectId);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM seller_groups sg
       LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
       LEFT JOIN users external_user ON external_user.id = sg.seller_group_external_account_user_id
       ${whereSql}`,
      params
    );
    const [rows] = await db.query(
      `
        SELECT
          sg.*,
          ${fullNameSql('head_user')} AS group_head_name,
          head_user.role AS seller_group_head_role,
          ${fullNameSql('external_user')} AS external_account_name,
          external_user.email AS external_account_email,
          external_user.contact_no AS external_account_contact_no,
          external_user.status AS external_account_status,
          external_user.can_login AS external_account_can_login,
          COUNT(DISTINCT CASE WHEN COALESCE(member.is_system_dummy, 0) = 0 THEN member.accredited_seller_id END) AS member_count,
          COUNT(DISTINCT CASE WHEN COALESCE(member.is_system_dummy, 0) = 0 AND member.accredited_seller_status = 'active' THEN member.accredited_seller_id END) AS active_member_count
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        LEFT JOIN users external_user ON external_user.id = sg.seller_group_external_account_user_id
        LEFT JOIN accredited_sellers member ON member.seller_group_id = sg.seller_group_id
        ${whereSql}
        GROUP BY sg.seller_group_id, head_user.id, external_user.id
        ORDER BY sg.seller_group_created_at DESC, sg.seller_group_id DESC
        LIMIT ? OFFSET ?
      `,
      [...params, limit, offset]
    );
    const hydrated = await hydrateGroupRates(rows);

    const [metaRows] = await db.query(
      `
        SELECT
          SUM(sg.seller_group_status = 'active') AS active,
          COUNT(DISTINCT CASE WHEN COALESCE(member.is_system_dummy, 0) = 0 THEN member.accredited_seller_id END) AS total_members,
          COUNT(DISTINCT sg.seller_group_external_account_user_id) AS total_accounts,
          COUNT(DISTINCT CASE WHEN rate.seller_group_lot_project_rate_status = 'active' THEN CONCAT(rate.seller_group_id, ':', rate.lot_project_id) END) AS accredited_projects
        FROM seller_groups sg
        LEFT JOIN accredited_sellers member ON member.seller_group_id = sg.seller_group_id
        LEFT JOIN seller_group_lot_project_rates rate ON rate.seller_group_id = sg.seller_group_id
        WHERE sg.seller_group_type = ?
      `,
      [groupType]
    );
    const total = Number(countRows[0]?.total || 0);
    return res.json({
      data: hydrated,
      pagination: {
        page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1),
        hasNext: page * limit < total, hasPrev: page > 1,
      },
      meta: {
        active: Number(metaRows[0]?.active || 0),
        totalMembers: Number(metaRows[0]?.total_members || 0),
        totalAccounts: Number(metaRows[0]?.total_accounts || 0),
        accreditedProjects: Number(metaRows[0]?.accredited_projects || 0),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const getGroupOptions = async (req, res) => {
  try {
    const groupType = normalizeSellerGroupType(req.query.groupType || req.query.seller_group_type || 'in_house');
    const [rows] = await db.query(
      `SELECT seller_group_id, seller_group_name, seller_group_type,
              seller_group_head_user_id, seller_group_external_account_user_id,
              seller_group_status
       FROM seller_groups
       WHERE seller_group_status = 'active' AND seller_group_type = ?
       ORDER BY seller_group_name ASC`,
      [groupType]
    );
    return res.json({ data: rows });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const editGroup = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await requireGroupTypeSchema(connection);
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid group id.' });
    const [existingRows] = await connection.query(
      `SELECT * FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );
    const existing = existingRows[0];
    if (!existing) return res.status(404).json({ message: 'Group not found.' });

    const requestedType = normalizeSellerGroupType(req.body.seller_group_type || existing.seller_group_type);
    const groupType = normalizeSellerGroupType(existing.seller_group_type);
    if (requestedType !== groupType) throw createValidationError('Group Type cannot be changed after creation.');

    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status = existing.seller_group_status,
      project_rates = [],
      external_account = {},
    } = req.body;
    const name = String(seller_group_name || '').trim();
    if (!name) return res.status(400).json({ message: 'Group Name is required.' });

    await connection.beginTransaction();
    const previousHead = groupType === 'in_house' ? await getCurrentGroupHead(connection, groupId) : null;
    const nextHead = groupType === 'in_house'
      ? await validateGroupHead(connection, seller_group_head_user_id, groupId)
      : null;
    if (groupType === 'external' && seller_group_head_user_id) {
      throw createValidationError('External Groups do not use an in-house Group Head.');
    }

    await connection.query(
      `UPDATE seller_groups SET
         seller_group_name = ?, seller_group_head_user_id = ?,
         seller_group_description = ?, seller_group_status = ?
       WHERE seller_group_id = ?`,
      [name, nextHead?.user_id || null, String(seller_group_description || '').trim() || null, normalizeStatus(seller_group_status), groupId]
    );

    if (groupType === 'external') {
      await updateExternalAccount(connection, groupId, external_account, seller_group_status);
    } else if (nextHead) {
      await attachAndSyncGroupHead(connection, groupId, nextHead, previousHead);
    }

    await assertSellerGroupRoleHierarchy(connection, groupId);
    const projects = await getActiveLotProjects(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects, {
      groupHeadRole: nextHead?.role || 'division_manager',
      groupType,
    });
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates);

    await writeAuditLog(connection, req, {
      action: 'update', module: 'Groups', entityType: 'seller_group', entityId: String(groupId),
      entityLabel: name, title: `Updated ${groupTypeLabel(groupType)}`,
      description: `Updated ${groupTypeLabel(groupType)} ${name}.`,
      metadata: { groupType, status: normalizeStatus(seller_group_status), projectRates: normalizedRates },
    });
    await connection.commit();
    return res.json({ message: `${groupTypeLabel(groupType)} updated successfully.` });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const toggleGroupStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid group id.' });
    const [rows] = await connection.query(
      `SELECT seller_group_status, seller_group_type, seller_group_external_account_user_id
       FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );
    const group = rows[0];
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const nextStatus = normalizeStatus(req.body.status || (group.seller_group_status === 'active' ? 'inactive' : 'active'));
    await connection.beginTransaction();
    await connection.query(`UPDATE seller_groups SET seller_group_status = ? WHERE seller_group_id = ?`, [nextStatus, groupId]);
    if (normalizeSellerGroupType(group.seller_group_type) === 'external' && group.seller_group_external_account_user_id) {
      await connection.query(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, group.seller_group_external_account_user_id]);
      await connection.query(`UPDATE accredited_sellers SET accredited_seller_status = ? WHERE user_id = ?`, [nextStatus, group.seller_group_external_account_user_id]);
    }
    await connection.commit();
    return res.json({ message: `${groupTypeLabel(group.seller_group_type)} is now ${nextStatus}.`, status: nextStatus });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const viewGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid group id.' });
    const [groupRows] = await db.query(
      `
        SELECT sg.*,
          ${fullNameSql('head_user')} AS group_head_name,
          head_user.role AS seller_group_head_role,
          ${fullNameSql('external_user')} AS external_account_name,
          external_user.first_name AS external_first_name,
          external_user.middle_name AS external_middle_name,
          external_user.last_name AS external_last_name,
          external_user.email AS external_account_email,
          external_user.contact_no AS external_account_contact_no,
          external_user.tin_no AS external_account_tin_no,
          external_user.prc_no AS external_account_prc_no,
          external_user.address AS external_account_address,
          external_user.status AS external_account_status,
          external_user.can_login AS external_account_can_login,
          COUNT(DISTINCT CASE WHEN COALESCE(a.is_system_dummy, 0) = 0 THEN a.accredited_seller_id END) AS member_count,
          SUM(CASE WHEN COALESCE(a.is_system_dummy, 0) = 0 AND a.accredited_seller_status = 'active' THEN 1 ELSE 0 END) AS active_member_count
        FROM seller_groups sg
        LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
        LEFT JOIN users external_user ON external_user.id = sg.seller_group_external_account_user_id
        LEFT JOIN accredited_sellers a ON a.seller_group_id = sg.seller_group_id
        WHERE sg.seller_group_id = ?
        GROUP BY sg.seller_group_id, head_user.id, external_user.id
        LIMIT 1
      `,
      [groupId]
    );
    const group = groupRows[0];
    if (!group) return res.status(404).json({ message: 'Group not found.' });
    const groupType = normalizeSellerGroupType(group.seller_group_type);
    const [members] = await db.query(
      `SELECT a.accredited_seller_id, a.user_id, ${fullNameSql('u')} AS full_name,
              u.email, u.contact_no, u.tin_no, u.prc_no, u.address, u.role, u.status AS user_status,
              a.accredited_seller_reports_under_user_id AS reports_under_user_id,
              ${fullNameSql('parent')} AS reports_under_name,
              a.accredited_seller_status
       FROM accredited_sellers a
       INNER JOIN users u ON u.id = a.user_id
       LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
       WHERE a.seller_group_id = ?
       ORDER BY FIELD(u.role, 'division_manager', 'sales_director', 'unit_manager', 'sales_agent', 'external_group'), full_name ASC`,
      [groupId]
    );
    const [hydratedGroup] = await hydrateGroupRates([group]);
    hydratedGroup.external_account = groupType === 'external' ? {
      user_id: hydratedGroup.seller_group_external_account_user_id ? Number(hydratedGroup.seller_group_external_account_user_id) : null,
      full_name: hydratedGroup.external_account_name || null,
      first_name: hydratedGroup.external_first_name || '',
      middle_name: hydratedGroup.external_middle_name || '',
      last_name: hydratedGroup.external_last_name || '',
      email: hydratedGroup.external_account_email || '',
      contact_no: hydratedGroup.external_account_contact_no || '',
      tin_no: hydratedGroup.external_account_tin_no || '',
      prc_no: hydratedGroup.external_account_prc_no || '',
      address: hydratedGroup.external_account_address || '',
      status: hydratedGroup.external_account_status || null,
      can_login: Boolean(Number(hydratedGroup.external_account_can_login || 0)),
    } : null;
    return res.json({ data: { group: hydratedGroup, members: await hydrateMemberRates(members) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

const requireCommissionConfigurationSchema = requireGroupTypeSchema;

const getGroupAndProject = async (connection, groupId, projectId) => {
  const [rows] = await connection.query(
    `
      SELECT
        sg.seller_group_id, sg.seller_group_name, sg.seller_group_type,
        sg.seller_group_head_user_id, sg.seller_group_external_account_user_id,
        sg.seller_group_description, sg.seller_group_status,
        ${fullNameSql('head_user')} AS group_head_name,
        ${fullNameSql('external_user')} AS external_account_name,
        external_user.first_name AS external_first_name,
        external_user.middle_name AS external_middle_name,
        external_user.last_name AS external_last_name,
        external_user.email AS external_account_email,
        external_user.contact_no AS external_account_contact_no,
        external_user.tin_no AS external_account_tin_no,
        external_user.prc_no AS external_account_prc_no,
        external_user.address AS external_account_address,
        external_user.can_login AS external_account_can_login,
        lp.lot_project_id, lp.lot_project_name, lp.lot_project_slug,
        lp.lot_project_location_code, lp.lot_project_status,
        sgr.seller_group_pool_rate, sgr.division_manager_rate,
        sgr.sales_director_rate, sgr.unit_manager_rate, sgr.sales_agent_rate,
        sgr.commission_structure_type,
        sgr.seller_group_lot_project_rate_status AS pool_rate_status
      FROM seller_groups sg
      INNER JOIN seller_group_lot_project_rates sgr
        ON sgr.seller_group_id = sg.seller_group_id
       AND sgr.lot_project_id = ?
       AND sgr.seller_group_lot_project_rate_status = 'active'
      INNER JOIN lot_projects lp ON lp.lot_project_id = sgr.lot_project_id AND lp.lot_project_status = 'active'
      LEFT JOIN users head_user ON head_user.id = sg.seller_group_head_user_id
      LEFT JOIN users external_user ON external_user.id = sg.seller_group_external_account_user_id
      WHERE sg.seller_group_id = ? LIMIT 1
    `,
    [projectId, groupId]
  );
  return rows[0] || null;
};

const loadGroupProjectMembers = async (connection, groupId) => {
  const [rows] = await connection.query(
    `SELECT
       acs.accredited_seller_id, acs.user_id, acs.seller_group_id,
       acs.accredited_seller_reports_under_user_id, acs.accredited_seller_status,
       COALESCE(acs.is_system_dummy, 0) AS is_system_dummy,
       acs.dummy_owner_accredited_seller_id,
       u.first_name, u.middle_name, u.last_name, u.email, u.contact_no,
       u.tin_no, u.prc_no, u.address, u.role, u.status AS user_status,
       acs.accredited_seller_accreditation_date AS accreditation_date,
       ${fullNameSql('u')} AS full_name,
       parent_acs.accredited_seller_id AS parent_accredited_seller_id,
       ${fullNameSql('parent_user')} AS reports_under_name,
       ${fullNameSql('owner_user')} AS owner_name
     FROM accredited_sellers acs
     INNER JOIN users u ON u.id = acs.user_id
     LEFT JOIN accredited_sellers parent_acs ON parent_acs.user_id = acs.accredited_seller_reports_under_user_id
     LEFT JOIN users parent_user ON parent_user.id = parent_acs.user_id
     LEFT JOIN accredited_sellers owner_acs ON owner_acs.accredited_seller_id = acs.dummy_owner_accredited_seller_id
     LEFT JOIN users owner_user ON owner_user.id = owner_acs.user_id
     WHERE acs.seller_group_id = ?
     ORDER BY FIELD(u.role, 'division_manager', 'sales_director', 'unit_manager', 'sales_agent', 'external_group'),
              COALESCE(acs.is_system_dummy, 0), full_name ASC`,
    [groupId]
  );
  return rows.map((row) => ({
    ...row,
    accredited_seller_id: Number(row.accredited_seller_id),
    user_id: Number(row.user_id),
    parent_accredited_seller_id: row.parent_accredited_seller_id ? Number(row.parent_accredited_seller_id) : null,
    is_system_dummy: Boolean(Number(row.is_system_dummy || 0)),
    display_name: Number(row.is_system_dummy || 0) === 1 && row.owner_name ? `${row.owner_name} — Direct Sales Agent` : row.full_name,
  }));
};

export const assertGroupCurrentPathsWithinPools = async (connection, groupId) => {
  if (!groupId) return;
  await requireCommissionConfigurationSchema(connection);
  const [projectRates] = await connection.query(
    `SELECT rate.*, project.lot_project_name, group_row.seller_group_type,
            head_user.role AS group_head_role
     FROM seller_group_lot_project_rates rate
     INNER JOIN seller_groups group_row ON group_row.seller_group_id = rate.seller_group_id
     INNER JOIN lot_projects project ON project.lot_project_id = rate.lot_project_id
     LEFT JOIN users head_user ON head_user.id = group_row.seller_group_head_user_id
     WHERE rate.seller_group_id = ? AND rate.seller_group_lot_project_rate_status = 'active'`,
    [groupId]
  );
  projectRates.forEach((rate) => validateGroupFixedRateStructure(rate, {
    groupHeadRole: rate.group_head_role || 'division_manager',
    projectName: rate.lot_project_name || 'Project',
    groupType: rate.seller_group_type,
  }));
};

export const normalizeGroupAnalyticsRange = (fromValue, toValue) => {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!datePattern.test(String(fromValue || '')) || !datePattern.test(String(toValue || ''))) {
    throw createValidationError('A valid From Date and To Date are required.');
  }
  const from = new Date(`${fromValue}T00:00:00Z`);
  const to = new Date(`${toValue}T00:00:00Z`);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw createValidationError('The selected analytics date range is invalid.');
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
    periods.set(period, { period, salesCount: Number(row.sales_count || 0), salesAmount: Number(row.sales_amount || 0), grossCommission: 0, releasedCommission: 0 });
  });
  commissionRows.forEach((row) => {
    const period = getPeriod(row);
    if (!period) return;
    const current = periods.get(period) || { period, salesCount: 0, salesAmount: 0, grossCommission: 0, releasedCommission: 0 };
    current.grossCommission = Number(row.gross_commission || 0);
    current.releasedCommission = Number(row.released_commission || 0);
    periods.set(period, current);
  });
  return [...periods.values()].sort((a, b) => a.period.localeCompare(b.period));
};

const getGroupAccreditedProjects = async (connection, groupId) => {
  const [rows] = await connection.query(
    `SELECT rate.lot_project_id, project.lot_project_name, project.lot_project_slug,
            project.lot_project_location, project.lot_project_location_code,
            rate.seller_group_pool_rate, rate.division_manager_rate,
            rate.sales_director_rate, rate.unit_manager_rate, rate.sales_agent_rate,
            rate.commission_structure_type, rate.seller_group_lot_project_rate_status
     FROM seller_group_lot_project_rates rate
     INNER JOIN lot_projects project ON project.lot_project_id = rate.lot_project_id AND project.lot_project_status = 'active'
     WHERE rate.seller_group_id = ? AND rate.seller_group_lot_project_rate_status = 'active'
     ORDER BY project.lot_project_name ASC`,
    [groupId]
  );
  return rows.map((row) => ({
    ...row,
    lot_project_id: Number(row.lot_project_id),
    seller_group_pool_rate: Number(row.seller_group_pool_rate || 0),
    division_manager_rate: Number(row.division_manager_rate || 0),
    sales_director_rate: Number(row.sales_director_rate || 0),
    unit_manager_rate: Number(row.unit_manager_rate || 0),
    sales_agent_rate: Number(row.sales_agent_rate || 0),
  }));
};

export const getGroupProjectOptions = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId || 0);
    if (!groupId) return res.status(400).json({ message: 'Invalid group id.' });
    const [groupRows] = await db.query(
      `SELECT seller_group_id, seller_group_name, seller_group_type, seller_group_status
       FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );
    if (!groupRows[0]) return res.status(404).json({ message: 'Group not found.' });
    const projects = await getGroupAccreditedProjects(db, groupId);
    return res.json({
      success: true,
      data: projects,
      group: {
        id: Number(groupRows[0].seller_group_id),
        name: groupRows[0].seller_group_name,
        type: normalizeSellerGroupType(groupRows[0].seller_group_type),
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
    if (!groupId || !projectId) throw createValidationError('Group and project are required.');
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('This group is not accredited to the selected project.');

    const dateFormat = range.dayCount <= 93 ? '%Y-%m-%d' : '%Y-%m';
    const hasSelectedContractTcp = await columnExists(connection, 'lot_project_client_profiles', 'soa_selected_tcp');
    const contractTcpExpr = hasSelectedContractTcp ? 'COALESCE(profile.soa_selected_tcp, listing.lot_project_listing_tcp)' : 'listing.lot_project_listing_tcp';
    const baseSalesWhere = `profile.lot_project_id = ? AND assigned_seller.seller_group_id = ?
      AND profile.lot_project_client_profile_status <> 'cancelled'
      AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?`;

    const [salesSummaryRows] = await connection.query(
      `SELECT COUNT(DISTINCT profile.lot_project_client_profile_id) AS sales_count,
              COALESCE(SUM(${contractTcpExpr}), 0) AS sales_amount,
              COALESCE(AVG(${contractTcpExpr}), 0) AS average_sale_amount
       FROM lot_project_client_profiles profile
       INNER JOIN lot_project_listings listing ON listing.lot_project_listing_id = profile.lot_project_listing_id
       INNER JOIN accredited_sellers assigned_seller ON assigned_seller.accredited_seller_id = profile.assigned_accredited_seller_id
       WHERE ${baseSalesWhere}`,
      [projectId, groupId, range.fromDate, range.toDate]
    );
    const [commissionSummaryRows] = await connection.query(
      `SELECT COALESCE(SUM(commission.gross_commission_amount), 0) AS gross_commission,
              COALESCE(SUM(commission.released_commission_amount), 0) AS released_commission,
              COALESCE(SUM(commission.net_remaining_commission_amount), 0) AS remaining_commission
       FROM lot_project_commissions commission
       INNER JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = commission.lot_project_client_profile_id
       INNER JOIN accredited_sellers recipient ON recipient.accredited_seller_id = commission.accredited_seller_id
       WHERE commission.lot_project_id = ? AND recipient.seller_group_id = ?
         AND commission.commission_status <> 'Cancelled'
         AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?`,
      [projectId, groupId, range.fromDate, range.toDate]
    );
    const [salesTimelineRows] = await connection.query(
      `SELECT DATE_FORMAT(profile.lot_project_client_profile_created_at, ?) AS period_start,
              COUNT(DISTINCT profile.lot_project_client_profile_id) AS sales_count,
              COALESCE(SUM(${contractTcpExpr}), 0) AS sales_amount
       FROM lot_project_client_profiles profile
       INNER JOIN lot_project_listings listing ON listing.lot_project_listing_id = profile.lot_project_listing_id
       INNER JOIN accredited_sellers assigned_seller ON assigned_seller.accredited_seller_id = profile.assigned_accredited_seller_id
       WHERE ${baseSalesWhere}
       GROUP BY period_start ORDER BY period_start ASC`,
      [dateFormat, projectId, groupId, range.fromDate, range.toDate]
    );
    const [commissionTimelineRows] = await connection.query(
      `SELECT DATE_FORMAT(profile.lot_project_client_profile_created_at, ?) AS period_start,
              COALESCE(SUM(commission.gross_commission_amount), 0) AS gross_commission,
              COALESCE(SUM(commission.released_commission_amount), 0) AS released_commission
       FROM lot_project_commissions commission
       INNER JOIN lot_project_client_profiles profile ON profile.lot_project_client_profile_id = commission.lot_project_client_profile_id
       INNER JOIN accredited_sellers recipient ON recipient.accredited_seller_id = commission.accredited_seller_id
       WHERE commission.lot_project_id = ? AND recipient.seller_group_id = ?
         AND commission.commission_status <> 'Cancelled'
         AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
       GROUP BY period_start ORDER BY period_start ASC`,
      [dateFormat, projectId, groupId, range.fromDate, range.toDate]
    );
    const [sellerRows] = await connection.query(
      `SELECT assigned.accredited_seller_id AS seller_id,
              ${fullNameSql('assigned_user')} AS seller_name,
              COUNT(DISTINCT profile.lot_project_client_profile_id) AS sales_count,
              COALESCE(SUM(${contractTcpExpr}), 0) AS sales_amount
       FROM lot_project_client_profiles profile
       INNER JOIN lot_project_listings listing ON listing.lot_project_listing_id = profile.lot_project_listing_id
       INNER JOIN accredited_sellers assigned ON assigned.accredited_seller_id = profile.assigned_accredited_seller_id
       INNER JOIN users assigned_user ON assigned_user.id = assigned.user_id
       WHERE profile.lot_project_id = ? AND assigned.seller_group_id = ?
         AND profile.lot_project_client_profile_status <> 'cancelled'
         AND DATE(profile.lot_project_client_profile_created_at) BETWEEN ? AND ?
       GROUP BY assigned.accredited_seller_id, seller_name
       ORDER BY sales_amount DESC, sales_count DESC, seller_name ASC LIMIT 10`,
      [projectId, groupId, range.fromDate, range.toDate]
    );
    const salesSummary = salesSummaryRows[0] || {};
    const commissionSummary = commissionSummaryRows[0] || {};
    return res.json({
      success: true,
      data: {
        range,
        project: { id: Number(group.lot_project_id), name: group.lot_project_name },
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
          sellerId: Number(row.seller_id || 0), sellerName: row.seller_name || 'Unassigned seller',
          salesCount: Number(row.sales_count || 0), salesAmount: Number(row.sales_amount || 0),
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
    if (!groupId || !projectId) return res.status(400).json({ message: 'Group and project are required.' });
    await requireCommissionConfigurationSchema(connection);
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) return res.status(404).json({ message: 'Group or project not found.' });
    const groupType = normalizeSellerGroupType(group.seller_group_type);
    const members = await loadGroupProjectMembers(connection, groupId);
    const accreditedProjects = await getGroupAccreditedProjects(connection, groupId);
    const fixedRates = validateGroupFixedRateStructure(group, {
      groupHeadRole: members.find((member) => Number(member.user_id) === Number(group.seller_group_head_user_id))?.role || 'division_manager',
      projectName: group.lot_project_name,
      groupType,
    });
    const externalAccount = groupType === 'external' ? {
      userId: group.seller_group_external_account_user_id ? Number(group.seller_group_external_account_user_id) : null,
      fullName: group.external_account_name || null,
      firstName: group.external_first_name || '', middleName: group.external_middle_name || '', lastName: group.external_last_name || '',
      email: group.external_account_email || '', contactNo: group.external_account_contact_no || '',
      tinNo: group.external_account_tin_no || '', prcNo: group.external_account_prc_no || '',
      address: group.external_account_address || '', canLogin: Boolean(Number(group.external_account_can_login || 0)),
    } : null;
    return res.json({
      success: true,
      data: {
        group: {
          id: Number(group.seller_group_id), name: group.seller_group_name, type: groupType,
          headUserId: group.seller_group_head_user_id ? Number(group.seller_group_head_user_id) : null,
          headRole: members.find((member) => Number(member.user_id) === Number(group.seller_group_head_user_id))?.role || null,
          headName: group.group_head_name || null,
          externalAccountUserId: group.seller_group_external_account_user_id ? Number(group.seller_group_external_account_user_id) : null,
          externalAccount,
          description: group.seller_group_description, status: group.seller_group_status,
          projectRates: accreditedProjects,
        },
        project: { id: Number(group.lot_project_id), name: group.lot_project_name, slug: group.lot_project_slug, locationCode: group.lot_project_location_code, status: group.lot_project_status },
        poolRate: fixedRates.seller_group_pool_rate,
        poolRateStatus: group.pool_rate_status,
        fixedRates: {
          poolRate: fixedRates.seller_group_pool_rate,
          divisionManagerRate: fixedRates.division_manager_rate,
          salesDirectorRate: fixedRates.sales_director_rate,
          unitManagerRate: fixedRates.unit_manager_rate,
          salesAgentRate: fixedRates.sales_agent_rate,
          allocatedRate: fixedRates.allocated_rate,
          remainingRate: fixedRates.remaining_rate,
        },
        members: groupType === 'external' ? members.filter((member) => member.role === EXTERNAL_GROUP_ROLE) : members,
        accreditedProjects,
        summary: { activeMembers: members.filter((member) => !member.is_system_dummy && member.accredited_seller_status === 'active').length, accreditedProjects: accreditedProjects.length },
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
    if (!groupId || !projectId) throw createValidationError('Group and project are required.');
    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('Group or project not found.');
    const groupType = normalizeSellerGroupType(group.seller_group_type);
    const [headRows] = await connection.query(`SELECT role FROM users WHERE id = ? LIMIT 1`, [group.seller_group_head_user_id || 0]);
    const rates = validateGroupFixedRateStructure({
      seller_group_pool_rate: req.body.poolRate ?? req.body.seller_group_pool_rate,
      division_manager_rate: req.body.divisionManagerRate ?? req.body.division_manager_rate ?? 0,
      sales_director_rate: req.body.salesDirectorRate ?? req.body.sales_director_rate ?? 0,
      unit_manager_rate: req.body.unitManagerRate ?? req.body.unit_manager_rate ?? 0,
      sales_agent_rate: req.body.salesAgentRate ?? req.body.sales_agent_rate ?? 0,
    }, {
      groupHeadRole: headRows[0]?.role || 'division_manager',
      projectName: group.lot_project_name,
      groupType,
    });
    const status = normalizeStatus(req.body.status);
    await connection.query(
      `UPDATE seller_group_lot_project_rates SET
         seller_group_pool_rate = ?, division_manager_rate = ?, sales_director_rate = ?,
         unit_manager_rate = ?, sales_agent_rate = ?, commission_structure_type = ?,
         seller_group_lot_project_rate_status = ?
       WHERE seller_group_id = ? AND lot_project_id = ?`,
      [rates.seller_group_pool_rate, rates.division_manager_rate, rates.sales_director_rate,
       rates.unit_manager_rate, rates.sales_agent_rate, groupType, status, groupId, projectId]
    );
    await deactivateLegacyIndividualRates(connection, groupId);
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Groups', entityType: 'seller_group_project_rates',
      entityId: `${groupId}:${projectId}`, entityLabel: `${group.seller_group_name} — ${group.lot_project_name}`,
      title: `Updated ${groupType === 'external' ? 'External Group Pool Rate' : 'In-House fixed commission rates'}`,
      description: groupType === 'external'
        ? `Updated the full Pool Rate for ${group.seller_group_name} in ${group.lot_project_name}.`
        : `Updated fixed position rates for ${group.seller_group_name} in ${group.lot_project_name}.`,
      metadata: { groupId, projectId, groupType, ...rates, status },
    });
    await connection.commit();
    return res.json({ message: `${groupType === 'external' ? 'External Group Pool Rate' : 'In-House fixed commission rates'} updated successfully.`, data: rates });
  } catch (error) {
    await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
