import { isOwnerAdministrator } from '../../config/permissions.js';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { columnExists, tableExists } from '../Lot_Projects/_shared/lotProject.shared.js';
import { canAccessProject, getAccessibleProjectIds } from '../../services/projectAccess.service.js';
import {
  normalizeSellerGroupType,
  validateGroupFixedRateStructure,
  loadInHousePoolShares,
  loadCompanyProfitPolicy,
  assertCompanyProfitWithinPolicy,
} from './groupFixedCommissionRates.service.js';
import {
  EXTERNAL_GROUP_ROLE,
  getRequiredParentRole,
  isExternalGroupRole,
  isGroupHeadRole,
  SELLER_ROLE_LABELS,
} from './sellerHierarchyRules.js';
import {
  analyzeNetworkMemberImport,
  normalizeNetworkMemberImportEmail,
  sortNetworkMemberImportRows,
} from './networkMemberImport.service.js';
import { loadActiveSellerIdentityMatches } from '../../services/sellerIdentity.service.js';
import {
  assertEntityNotReviewLocked,
  createOperationalReview,
  getOperationalReviewForUpdate,
  getReturnedOperationalReviewForActor,
  resubmitReturnedOperationalReview,
} from '../../services/operationalReview.service.js';
import { authorizeGovernedAction } from '../../services/governedAction.service.js';
import { getPendingAuditCorrectionCase, advanceAuditCaseToRecheck } from '../../services/auditCaseAuthorization.service.js';

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
};

const getErrorMessage = (error) => {
  if (error?.statusCode && error?.message) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') {
    if (String(error?.sqlMessage || '').includes('email')) return 'That email address is already in use.';
    return 'A Network with the same unique broker or realty information already exists.';
  }
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) {
    return 'Database operation failed. Apply the latest Network commission migration, then try again.';
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
const groupTypeLabel = (groupType) => normalizeSellerGroupType(groupType) === 'external' ? 'External Network' : 'In-House Network';

const normalizeRateReviewPayload = (rates = []) => rates
  .map((rate) => ({
    projectId: Number(rate.lot_project_id || rate.projectId || 0),
    poolRate: Number(Number(rate.seller_group_pool_rate ?? rate.poolRate ?? 0).toFixed(4)),
    companyProfitRate: Number(Number(rate.company_profit_rate ?? rate.companyProfitRate ?? 0).toFixed(4)),
    divisionManagerRate: Number(Number(rate.division_manager_rate ?? rate.divisionManagerRate ?? 0).toFixed(4)),
    salesDirectorRate: Number(Number(rate.sales_director_rate ?? rate.salesDirectorRate ?? 0).toFixed(4)),
    unitManagerRate: Number(Number(rate.unit_manager_rate ?? rate.unitManagerRate ?? 0).toFixed(4)),
    salesAgentRate: Number(Number(rate.sales_agent_rate ?? rate.salesAgentRate ?? 0).toFixed(4)),
    status: normalizeStatus(rate.seller_group_lot_project_rate_status ?? rate.status ?? 'active'),
  }))
  .filter((rate) => rate.projectId > 0)
  .sort((left, right) => left.projectId - right.projectId);

const rateReviewSignature = (rates = []) => JSON.stringify(normalizeRateReviewPayload(rates));

const buildSingleProjectRateReviewSnapshot = ({ groupId, groupType, project = {}, rate = {} }) => ({
  groupId: Number(groupId || 0),
  groupType: normalizeSellerGroupType(groupType),
  projectId: Number(project.lot_project_id || rate.lot_project_id || rate.projectId || 0),
  projectSlug: project.lot_project_slug || rate.projectSlug || null,
  poolRate: Number(rate.seller_group_pool_rate ?? rate.poolRate ?? 0),
  companyProfitRate: Number(rate.company_profit_rate ?? rate.companyProfitRate ?? 0),
  divisionManagerRate: Number(rate.division_manager_rate ?? rate.divisionManagerRate ?? 0),
  salesDirectorRate: Number(rate.sales_director_rate ?? rate.salesDirectorRate ?? 0),
  unitManagerRate: Number(rate.unit_manager_rate ?? rate.unitManagerRate ?? 0),
  salesAgentRate: Number(rate.sales_agent_rate ?? rate.salesAgentRate ?? 0),
  status: normalizeStatus(rate.seller_group_lot_project_rate_status ?? rate.status ?? 'active'),
});

// A returned Network-rate Review may have been created by the full Network editor
// (entity id = groupId) or by the per-project rate editor
// (entity id = groupId:projectId). Correction links carry reviewId, so validate
// that exact Review belongs to the original Staff user instead of opening a new
// review and leaving the returned one pending.
const getReturnedNetworkRateReviewForActor = async (connection, { actor, groupId, reviewId = null, projectId = null }) => {
  const normalizedGroupId = Number(groupId || 0);
  const normalizedProjectId = Number(projectId || 0);
  if (!actor?.id || !normalizedGroupId) return null;

  if (normalizedProjectId) {
    const exact = await getReturnedOperationalReviewForActor(connection, {
      actor,
      actionKey: 'network.rates.update',
      entityType: 'seller_group_project_rates',
      entityId: `${normalizedGroupId}:${normalizedProjectId}`,
      reviewId,
    });
    if (exact) return exact;
  }

  const bulk = await getReturnedOperationalReviewForActor(connection, {
    actor,
    actionKey: 'network.rates.update',
    entityType: 'seller_group_project_rates',
    entityId: normalizedGroupId,
    reviewId,
  });
  if (bulk || !reviewId) return bulk;

  const candidate = await getOperationalReviewForUpdate(connection, reviewId);
  if (!candidate
    || candidate.status !== 'returned_for_correction'
    || candidate.action_key !== 'network.rates.update'
    || candidate.entity_type !== 'seller_group_project_rates'
    || Number(candidate.initiated_by_user_id || 0) !== Number(actor.id || 0)) return null;

  const [candidateGroup, candidateProject] = String(candidate.entity_id || '').split(':').map(Number);
  if (candidateGroup !== normalizedGroupId) return null;
  if (normalizedProjectId && candidateProject && candidateProject !== normalizedProjectId) return null;
  return candidate;
};

const buildNetworkSnapshot = ({ group = {}, name = null, headUserId = null, description = null, status = null, broker = null } = {}) => ({
  groupId: Number(group.seller_group_id || 0) || null,
  name: String(name ?? group.seller_group_name ?? '').trim(),
  groupType: normalizeSellerGroupType(group.seller_group_type),
  headUserId: toNullableNumber(headUserId ?? group.seller_group_head_user_id),
  description: String(description ?? group.seller_group_description ?? '').trim() || null,
  status: normalizeStatus(status ?? group.seller_group_status),
  // Only the human-entered broker fields belong in a review snapshot; the
  // *_normalized copies are internal matching keys.
  broker: {
    broker_name: (broker || group).broker_name || '',
    broker_license_number: (broker || group).broker_license_number || '',
    realty_name: (broker || group).realty_name || '',
    broker_prc_number: (broker || group).broker_prc_number || '',
  },
});

const normalizeNetworkIdentity = (value) => String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeNetworkBrokerFields = (body = {}) => {
  const brokerName = String(body.broker_name ?? body.brokerName ?? '').trim().replace(/\s+/g, ' ');
  const brokerLicenseNumber = String(body.broker_license_number ?? body.brokerLicenseNumber ?? '').trim().replace(/\s+/g, ' ');
  const realtyName = String(body.realty_name ?? body.realtyName ?? '').trim().replace(/\s+/g, ' ');
  const brokerPrcNumber = String(body.broker_prc_number ?? body.brokerPrcNumber ?? body.prc_number ?? '').trim().replace(/\s+/g, ' ');
  const required = [
    ['Broker Name', brokerName],
    ['Broker License Number', brokerLicenseNumber],
    ['Realty Name', realtyName],
    ['PRC Number', brokerPrcNumber],
  ];
  const missing = required.find(([, value]) => !value);
  if (missing) throw createValidationError(`${missing[0]} is required.`);
  return {
    broker_name: brokerName,
    broker_license_number: brokerLicenseNumber,
    realty_name: realtyName,
    broker_prc_number: brokerPrcNumber,
    broker_name_normalized: normalizeNetworkIdentity(brokerName),
    broker_license_number_normalized: normalizeNetworkIdentity(brokerLicenseNumber),
    realty_name_normalized: normalizeNetworkIdentity(realtyName),
    broker_prc_number_normalized: normalizeNetworkIdentity(brokerPrcNumber),
  };
};

// Broker License No., Realty Name and PRC No. are unique across all Networks
// (In-House and External). Broker Name may repeat because two different
// brokers can share a name, so a matching Broker Name only returns a warning.
const assertUniqueNetworkBrokerIdentity = async (connection, broker, excludeGroupId = null) => {
  const [rows] = await connection.query(
    `SELECT seller_group_id, seller_group_name,
            broker_license_number_normalized,
            realty_name_normalized, broker_prc_number_normalized
     FROM seller_groups
     WHERE (? IS NULL OR seller_group_id <> ?)
       AND (
         broker_license_number_normalized = ? OR
         realty_name_normalized = ? OR
         broker_prc_number_normalized = ?
       )
     LIMIT 1`,
    [
      excludeGroupId, excludeGroupId,
      broker.broker_license_number_normalized,
      broker.realty_name_normalized,
      broker.broker_prc_number_normalized,
    ]
  );
  const existing = rows[0];
  if (existing) {
    const conflicts = [];
    if (existing.broker_license_number_normalized === broker.broker_license_number_normalized) conflicts.push('Broker License Number');
    if (existing.realty_name_normalized === broker.realty_name_normalized) conflicts.push('Realty Name');
    if (existing.broker_prc_number_normalized === broker.broker_prc_number_normalized) conflicts.push('PRC Number');
    throw createValidationError(`${conflicts.join(', ')} already ${conflicts.length === 1 ? 'exists' : 'exist'} in another Network (${existing.seller_group_name}).`);
  }

  const nameRows = await findBrokerNameMatches(connection, broker.broker_name_normalized, excludeGroupId);
  return nameRows.map((row) => brokerNameWarning(broker.broker_name, row));
};

const brokerNameWarning = (brokerName, row) =>
  `${brokerName} is already the broker of ${row.seller_group_name}${row.realty_name ? ` (${row.realty_name})` : ''}. Check that this is a different broker.`;

const findBrokerNameMatches = async (connection, brokerNameNormalized, excludeGroupId = null) => {
  const normalized = normalizeNetworkIdentity(brokerNameNormalized);
  if (!normalized) return [];
  const [rows] = await connection.query(
    `SELECT seller_group_id, seller_group_name, seller_group_type, seller_group_status, realty_name, broker_name
     FROM seller_groups
     WHERE (? IS NULL OR seller_group_id <> ?)
       AND broker_name_normalized = ?
     ORDER BY seller_group_id ASC
     LIMIT 5`,
    [excludeGroupId, excludeGroupId, normalized]
  );
  return rows;
};

const isTruthyFlag = (value) => value === true || ['1', 'true', 'yes'].includes(String(value || '').toLowerCase());

// A shared Broker Name is allowed (two brokers can have the same name), but it
// must never be saved silently. The user has to see the matching Networks and
// confirm that this is a different broker.
const assertDuplicateBrokerNameConfirmed = async (connection, broker, body = {}, { excludeGroupId = null, previousNormalized = null } = {}) => {
  if (previousNormalized && previousNormalized === broker.broker_name_normalized) return [];
  const matches = await findBrokerNameMatches(connection, broker.broker_name_normalized, excludeGroupId);
  if (!matches.length || isTruthyFlag(body.confirm_duplicate_broker ?? body.confirmDuplicateBroker)) return matches;
  throw Object.assign(
    new Error(`${broker.broker_name} is already the broker of ${matches.map((row) => row.seller_group_name).join(', ')}. Confirm that this is a different broker before saving.`),
    {
      statusCode: 409,
      code: 'DUPLICATE_BROKER_NAME',
      details: { matches: matches.map((row) => ({ ...row, warning: brokerNameWarning(broker.broker_name, row) })) },
    }
  );
};

export const checkNetworkBrokerName = async (req, res) => {
  try {
    const brokerName = String(req.query.broker_name || req.query.brokerName || '').trim().replace(/\s+/g, ' ');
    const excludeGroupId = Number(req.query.excludeGroupId || req.query.exclude || 0) || null;
    if (!brokerName) return res.json({ data: { matches: [] } });
    const matches = await findBrokerNameMatches(db, brokerName, excludeGroupId);
    return res.json({ data: { matches: matches.map((row) => ({ ...row, warning: brokerNameWarning(brokerName, row) })) } });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

const requireGroupTypeSchema = async (connection) => {
  const requirements = [
    ['seller_groups', 'seller_group_type'],
    ['seller_groups', 'seller_group_external_account_user_id'],
    ['seller_groups', 'broker_name'],
    ['seller_groups', 'broker_license_number'],
    ['seller_groups', 'realty_name'],
    ['seller_groups', 'broker_prc_number'],
    ['seller_groups', 'broker_name_normalized'],
    ['seller_groups', 'broker_license_number_normalized'],
    ['seller_groups', 'realty_name_normalized'],
    ['seller_groups', 'broker_prc_number_normalized'],
    ['seller_group_lot_project_rates', 'commission_structure_type'],
    ['seller_group_lot_project_rates', 'company_profit_rate'],
    ['seller_group_lot_project_rates', 'division_manager_rate'],
    ['seller_group_lot_project_rates', 'sales_director_rate'],
    ['seller_group_lot_project_rates', 'unit_manager_rate'],
    ['seller_group_lot_project_rates', 'sales_agent_rate'],
  ];
  for (const [tableName, columnName] of requirements) {
    if (!(await columnExists(connection, tableName, columnName))) {
      throw createValidationError('Networks need the latest database migration.');
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
    throw createValidationError('The selected Network Hierarchy Head is not an accredited in-house seller.');
  }
  if (head.role !== 'division_manager') {
    throw createValidationError('The Internal Hierarchy Head must be a Division Manager so the fixed DM/SD/UM/SA Network distribution has a recipient at every level.');
  }
  if (head.user_status !== 'active' || head.accredited_seller_status !== 'active') {
    throw createValidationError('The selected Network Hierarchy Head must be active.');
  }
  if (head.seller_group_type && head.seller_group_type !== 'in_house') {
    throw createValidationError('An External Network account cannot be used as an In-House Network Hierarchy Head.');
  }
  if (head.seller_group_id && Number(head.seller_group_id) !== Number(groupId || 0)) {
    throw createValidationError('The selected Network Hierarchy Head already belongs to another Network.');
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
    throw createValidationError('External Networks do not use an in-house Network Hierarchy Head.');
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
  if (!group) throw createValidationError('The selected Network was not found.');
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
      throw createValidationError('An External Network must have one representative account.');
    }
    const externalRows = rows.filter((row) => isExternalGroupRole(row.role));
    if (externalRows.length !== 1 || rows.length !== 1) {
      throw createValidationError('An External Network must contain exactly one External Network account.');
    }
    const account = externalRows[0];
    if (Number(account.user_id) !== Number(group.seller_group_external_account_user_id)) {
      throw createValidationError('The External Network representative does not match the group account.');
    }
    if (account.accredited_seller_reports_under_user_id) {
      throw createValidationError('An External Network account cannot have a reporting parent.');
    }
    return;
  }

  const headUserId = Number(group.seller_group_head_user_id || 0);
  const topLevelSellers = rows.filter((seller) => !seller.accredited_seller_reports_under_user_id);
  if (headUserId) {
    const head = rows.find((seller) => Number(seller.user_id) === headUserId);
    if (!head) throw createValidationError('The In-House Network Hierarchy Head must belong to the same Network.');
    if (!isGroupHeadRole(head.role)) {
      throw createValidationError('Only a Division Manager or Sales Director can be the In-House Network Hierarchy Head.');
    }
    if (head.accredited_seller_reports_under_user_id) {
      throw createValidationError('The In-House Network Hierarchy Head must report directly to the developer.');
    }
  } else if (topLevelSellers.length > 1) {
    throw createValidationError('A headless In-House Network can have only one top-level Division Manager or Sales Director.');
  }

  for (const seller of rows) {
    if (isExternalGroupRole(seller.role)) {
      throw createValidationError('An External Network account cannot be assigned to an In-House Network.');
    }
    const isHead = headUserId && Number(seller.user_id) === headUserId;
    if (!seller.accredited_seller_reports_under_user_id) {
      if (isHead || (!headUserId && isGroupHeadRole(seller.role))) continue;
      const expected = getRequiredParentRole(seller.role);
      throw createValidationError(`${seller.full_name || 'Seller'} must report under a ${SELLER_ROLE_LABELS[expected] || 'valid in-house parent'}.`);
    }
    if (isHead) throw createValidationError('The In-House Network Hierarchy Head cannot have a reporting parent.');
    if (!seller.parent_accredited_seller_id || Number(seller.parent_group_id) !== Number(groupId)) {
      throw createValidationError(`${seller.full_name || 'Seller'} must report under an in-house seller from the same Network.`);
    }
    const expectedParentRole = getRequiredParentRole(seller.role);
    if (!expectedParentRole || seller.parent_role !== expectedParentRole) {
      throw createValidationError(
        `${seller.full_name || 'Seller'} is a ${SELLER_ROLE_LABELS[seller.role] || seller.role} and can only report under a ${SELLER_ROLE_LABELS[expectedParentRole] || 'valid parent'}.`
      );
    }
  }
};

const getActiveLotProjects = async (connection = db, user = null) => {
  const accessibleProjectIds = user ? await getAccessibleProjectIds(user, connection) : null;
  const accessSql = accessibleProjectIds === null
    ? ''
    : accessibleProjectIds.length
      ? ` AND lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
      : ' AND 1 = 0';
  const [projects] = await connection.query(
    `SELECT lot_project_id, lot_project_name, lot_project_slug,
            lot_project_location, lot_project_location_code
     FROM lot_projects
     WHERE lot_project_status = 'active'${accessSql}
     ORDER BY lot_project_name ASC`,
    accessibleProjectIds === null ? [] : accessibleProjectIds
  );
  return projects;
};

const assertCanMutateWholeGroup = async (connection, user, groupId) => {
  const accessibleProjectIds = await getAccessibleProjectIds(user, connection);
  if (accessibleProjectIds === null) return;
  if (!accessibleProjectIds.length) {
    const error = new Error('You do not have project access for this seller Network.');
    error.statusCode = 403;
    throw error;
  }

  const placeholders = accessibleProjectIds.map(() => '?').join(', ');
  const [[outsideRows], [insideRows]] = await Promise.all([
    connection.query(
      `SELECT lot_project_id
       FROM seller_group_lot_project_rates
       WHERE seller_group_id = ?
         AND seller_group_lot_project_rate_status = 'active'
         AND lot_project_id NOT IN (${placeholders})
       LIMIT 1`,
      [groupId, ...accessibleProjectIds]
    ),
    connection.query(
      `SELECT lot_project_id
       FROM seller_group_lot_project_rates
       WHERE seller_group_id = ?
         AND seller_group_lot_project_rate_status = 'active'
         AND lot_project_id IN (${placeholders})
       LIMIT 1`,
      [groupId, ...accessibleProjectIds]
    ),
  ]);

  if (!insideRows.length) {
    const error = new Error('You do not have access to any active project for this seller Network.');
    error.statusCode = 403;
    throw error;
  }
  if (outsideRows.length) {
    const error = new Error('This seller Network is also accredited to projects outside your Admin access. Network-wide changes require the Super Admin or an Admin with access to all of the Network projects. Use the project-specific commission configuration for your assigned projects.');
    error.statusCode = 403;
    throw error;
  }
};

export const normalizeGroupProjectRates = (
  projectRates = [],
  projects = [],
  { groupHeadRole = 'division_manager', groupType = 'in_house', poolShares } = {}
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
    const {
      seller_group_type: _sellerGroupType,
      ...rates
    } = validateGroupFixedRateStructure(item, {
      groupHeadRole,
      projectName: project.lot_project_name,
      groupType,
      poolShares,
    });
    return {
      lot_project_id: projectId,
      ...rates,
    };
  });
};

const assertGroupRatesWithinCompanyProfitPolicy = async (connection, normalizedRates, projects, groupType) => {
  if (normalizeSellerGroupType(groupType) === 'external') return;
  const policy = await loadCompanyProfitPolicy(connection);
  const projectNames = new Map(projects.map((project) => [Number(project.lot_project_id), project.lot_project_name]));
  normalizedRates.forEach((rate) => assertCompanyProfitWithinPolicy(rate, {
    maxPercentOfPool: policy.maxPercentOfPool,
    projectName: projectNames.get(Number(rate.lot_project_id)) || 'Project',
    groupType,
  }));
};

const upsertGroupProjectRates = async (connection, groupId, projectRates, groupType) => {
  if (!projectRates.length) return;
  await connection.query(
    `
      INSERT INTO seller_group_lot_project_rates (
        seller_group_id, lot_project_id, seller_group_pool_rate, company_profit_rate,
        division_manager_rate, sales_director_rate, unit_manager_rate,
        sales_agent_rate, commission_structure_type,
        seller_group_lot_project_rate_status
      ) VALUES ${projectRates.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')").join(', ')}
      ON DUPLICATE KEY UPDATE
        seller_group_pool_rate = VALUES(seller_group_pool_rate),
        company_profit_rate = VALUES(company_profit_rate),
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
      rate.company_profit_rate,
      rate.division_manager_rate,
      rate.sales_director_rate,
      rate.unit_manager_rate,
      rate.sales_agent_rate,
      normalizeSellerGroupType(groupType),
    ])
  );
};

const deactivateLegacyIndividualRates = async (connection, groupId, projectScopeIds = null) => {
  if (Array.isArray(projectScopeIds) && !projectScopeIds.length) return;
  const scopeFor = (alias) => projectScopeIds === null
    ? { sql: '', params: [] }
    : {
        sql: ` AND ${alias}.lot_project_id IN (${projectScopeIds.map(() => '?').join(', ')})`,
        params: projectScopeIds,
      };

  if (await tableExists(connection, 'accredited_seller_lot_project_rates')) {
    const scope = scopeFor('role_rate');
    await connection.query(
      `UPDATE accredited_seller_lot_project_rates role_rate
       INNER JOIN accredited_sellers seller ON seller.accredited_seller_id = role_rate.accredited_seller_id
       SET role_rate.accredited_seller_lot_project_rate_status = 'inactive'
       WHERE seller.seller_group_id = ?${scope.sql}`,
      [groupId, ...scope.params]
    );
  }
  if (await tableExists(connection, 'agent_lot_project_direct_rates')) {
    const scope = scopeFor('direct_rate');
    await connection.query(
      `UPDATE agent_lot_project_direct_rates direct_rate
       INNER JOIN accredited_sellers seller ON seller.accredited_seller_id = direct_rate.accredited_seller_id
       SET direct_rate.direct_rate_status = 'inactive'
       WHERE seller.seller_group_id = ?${scope.sql}`,
      [groupId, ...scope.params]
    );
  }
  if (await tableExists(connection, 'seller_hierarchy_lot_project_overrides')) {
    const scope = scopeFor('override_row');
    await connection.query(
      `UPDATE seller_hierarchy_lot_project_overrides override_row
       INNER JOIN accredited_sellers child ON child.accredited_seller_id = override_row.child_accredited_seller_id
       SET override_row.override_rate_status = 'inactive'
       WHERE child.seller_group_id = ?${scope.sql}`,
      [groupId, ...scope.params]
    );
  }
};

const syncGroupProjectAccreditations = async (connection, groupId, projectRates, groupType, accessibleProjectIds = null) => {
  await upsertGroupProjectRates(connection, groupId, projectRates, groupType);
  const selectedIds = projectRates.map((rate) => Number(rate.lot_project_id));
  if (!selectedIds.length) return;
  const placeholders = selectedIds.map(() => '?').join(', ');
  const scopeSql = accessibleProjectIds === null
    ? ''
    : accessibleProjectIds.length
      ? ` AND lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
      : ' AND 1 = 0';
  await connection.query(
    `UPDATE seller_group_lot_project_rates
     SET seller_group_lot_project_rate_status = 'inactive'
     WHERE seller_group_id = ? AND lot_project_id NOT IN (${placeholders})${scopeSql}`,
    [groupId, ...selectedIds, ...(accessibleProjectIds === null ? [] : accessibleProjectIds)]
  );
  await deactivateLegacyIndividualRates(connection, groupId, accessibleProjectIds);
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
    throw createValidationError('External Network representative first name, last name, and email are required.');
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
  if (!current) throw createValidationError('The External Network account was not found.');
  const firstName = String(account.first_name || current.first_name || '').trim();
  const lastName = String(account.last_name || current.last_name || '').trim();
  const email = String(account.email || current.email || '').trim().toLowerCase();
  if (!firstName || !lastName || !email) {
    throw createValidationError('External Network representative first name, last name, and email are required.');
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

const hydrateGroupRates = async (groups, connection = db, accessibleProjectIds = null) => {
  const groupIds = groups.map((group) => Number(group.seller_group_id)).filter(Boolean);
  if (!groupIds.length) return groups.map((group) => ({ ...group, project_rates: [] }));
  const placeholders = groupIds.map(() => '?').join(', ');
  const [rateRows] = await connection.query(
    `
      SELECT
        sgr.seller_group_id, sgr.lot_project_id,
        lp.lot_project_name, lp.lot_project_slug, lp.lot_project_location_code,
        sgr.seller_group_pool_rate, sgr.company_profit_rate, sgr.division_manager_rate,
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
        ${accessibleProjectIds === null ? '' : accessibleProjectIds.length ? `AND sgr.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})` : 'AND 1 = 0'}
      ORDER BY lp.lot_project_name ASC
    `,
    accessibleProjectIds === null ? groupIds : [...groupIds, ...accessibleProjectIds]
  );
  const poolShares = await loadInHousePoolShares(connection);
  const rateMap = new Map();
  rateRows.forEach((rate) => {
    const derived = validateGroupFixedRateStructure(rate, {
      groupType: rate.commission_structure_type,
      projectName: rate.lot_project_name || 'Project',
      poolShares,
    });
    const groupId = Number(rate.seller_group_id);
    if (!rateMap.has(groupId)) rateMap.set(groupId, []);
    rateMap.get(groupId).push({
      ...rate,
      lot_project_id: Number(rate.lot_project_id),
      seller_group_pool_rate: derived.seller_group_pool_rate,
      company_profit_rate: derived.company_profit_rate,
      distribution_pool_rate: derived.distribution_pool_rate,
      division_manager_rate: derived.division_manager_rate,
      sales_director_rate: derived.sales_director_rate,
      unit_manager_rate: derived.unit_manager_rate,
      sales_agent_rate: derived.sales_agent_rate,
      allocated_rate: derived.allocated_rate,
      pool_shares: poolShares,
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
    if (!name) return res.status(400).json({ message: 'Network Name is required.' });
    const broker = normalizeNetworkBrokerFields(req.body);

    await connection.beginTransaction();
    const brokerWarnings = await assertUniqueNetworkBrokerIdentity(connection, broker);
    await assertDuplicateBrokerNameConfirmed(connection, broker, req.body);
    const groupHead = groupType === 'in_house'
      ? await validateGroupHead(connection, seller_group_head_user_id)
      : null;
    if (groupType === 'external' && seller_group_head_user_id) {
      throw createValidationError('External Networks do not use an in-house Network Hierarchy Head.');
    }

    // Network project rates are a post-action review. Staff saves once; the
    // rates are applied in this transaction and the Marketing Head reviews the
    // resulting Operational Review afterward.
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser, connection);
    const projects = await getActiveLotProjects(connection, req.authUser);
    const poolShares = await loadInHousePoolShares(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects, {
      groupHeadRole: groupHead?.role || 'division_manager',
      groupType,
      poolShares,
    });
    await assertGroupRatesWithinCompanyProfitPolicy(connection, normalizedRates, projects, groupType);

    let ratesGovernance = null;
    if (normalizedRates.length) {
      const provisionalEntityId = `new:${broker.broker_license_number_normalized || broker.realty_name_normalized || name.toLowerCase()}`;
      ratesGovernance = await authorizeGovernedAction(connection, {
        actor: req.authUser,
        actionKey: 'network.rates.update',
        projectId: null,
        entityId: provisionalEntityId,
        entityLabel: `${name} project rates`,
        payload: { groupType, network: name, rates: normalizeRateReviewPayload(normalizedRates) },
        reason: req.body?.rateChangeReason || `Initial project rates for ${name}`,
      });
    }

    const [result] = await connection.query(
      `INSERT INTO seller_groups (
         seller_group_name, seller_group_type, seller_group_head_user_id,
         seller_group_external_account_user_id, seller_group_description, seller_group_status,
         broker_name, broker_license_number, realty_name, broker_prc_number,
         broker_name_normalized, broker_license_number_normalized, realty_name_normalized, broker_prc_number_normalized
       ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, groupType, groupHead?.user_id || null, String(seller_group_description || '').trim() || null, normalizeStatus(seller_group_status),
       broker.broker_name, broker.broker_license_number, broker.realty_name, broker.broker_prc_number,
       broker.broker_name_normalized, broker.broker_license_number_normalized, broker.realty_name_normalized, broker.broker_prc_number_normalized]
    );
    const groupId = Number(result.insertId);

    if (groupType === 'external') {
      await createExternalAccount(connection, groupId, external_account, seller_group_status);
    } else if (groupHead) {
      await attachAndSyncGroupHead(connection, groupId, groupHead);
    }

    await assertSellerGroupRoleHierarchy(connection, groupId);
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates, groupType, accessibleProjectIds);

    const afterSnapshot = {
      ...buildNetworkSnapshot({
        group: { seller_group_id: groupId, seller_group_type: groupType },
        name,
        headUserId: groupHead?.user_id || null,
        description: seller_group_description,
        status: seller_group_status,
        broker,
      }),
      rates: normalizeRateReviewPayload(normalizedRates),
    };

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Groups',
      entityType: 'seller_group',
      entityId: String(groupId),
      entityLabel: name,
      title: `Created ${groupTypeLabel(groupType)}`,
      description: `Created ${groupTypeLabel(groupType)} ${name}.`,
      metadata: { groupType, status: normalizeStatus(seller_group_status), broker, projectRates: normalizedRates },
    });

    const networkReview = await createOperationalReview(connection, {
      actor: req.authUser,
      actionKey: 'network.create',
      department: 'marketing',
      projectId: null,
      entityType: 'seller_group',
      entityId: groupId,
      entityLabel: name,
      beforeSnapshot: null,
      afterSnapshot,
    });

    let rateReview = null;
    if (normalizedRates.length) {
      rateReview = await createOperationalReview(connection, {
        actor: req.authUser,
        actionKey: 'network.rates.update',
        department: 'marketing',
        projectId: null,
        entityType: 'seller_group_project_rates',
        entityId: groupId,
        entityLabel: `${name} project rates`,
        beforeSnapshot: { groupId, groupType, rates: [] },
        afterSnapshot: { groupId, groupType, rates: normalizeRateReviewPayload(normalizedRates) },
        headPreApprovedByUserId: ratesGovernance.headPreApprovedByUserId,
      });
    }

    await connection.commit();
    return res.status(201).json({
      message: `${groupTypeLabel(groupType)} created successfully.`,
      seller_group_id: groupId,
      warnings: brokerWarnings,
      review: networkReview,
      rate_review: rateReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error), ...(error?.details ? { details: error.details } : {}) });
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
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    if (projectId && accessibleProjectIds !== null && !accessibleProjectIds.includes(projectId)) {
      return res.status(403).json({ message: 'You do not have access to the selected project.' });
    }
    const where = ['sg.seller_group_type = ?'];
    const params = [groupType];
    if (accessibleProjectIds !== null) {
      if (!accessibleProjectIds.length) {
        where.push('1 = 0');
      } else {
        where.push(`EXISTS (
          SELECT 1 FROM seller_group_lot_project_rates access_rate
          WHERE access_rate.seller_group_id = sg.seller_group_id
            AND access_rate.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})
            AND access_rate.seller_group_lot_project_rate_status = 'active'
        )`);
        params.push(...accessibleProjectIds);
      }
    }

    if (search) {
      where.push(`(
        sg.seller_group_name LIKE ? OR IFNULL(sg.seller_group_description, '') LIKE ? OR
        ${fullNameSql('head_user')} LIKE ? OR ${fullNameSql('external_user')} LIKE ? OR
        IFNULL(external_user.email, '') LIKE ? OR
        IFNULL(sg.broker_name, '') LIKE ? OR IFNULL(sg.broker_license_number, '') LIKE ? OR
        IFNULL(sg.realty_name, '') LIKE ? OR IFNULL(sg.broker_prc_number, '') LIKE ?
      )`);
      const term = `%${search}%`;
      params.push(term, term, term, term, term, term, term, term, term);
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
    const hydratedRows = await hydrateGroupRates(rows, db, accessibleProjectIds);
    const deletion = await getNetworkDeletionStatus(db, rows);
    const hydrated = hydratedRows.map((row) => ({ ...row, deletion: deletion.get(Number(row.seller_group_id)) || { canDelete: false, reason: '' } }));

    const metaAccessSql = accessibleProjectIds === null
      ? ''
      : accessibleProjectIds.length
        ? ` AND EXISTS (
            SELECT 1 FROM seller_group_lot_project_rates meta_access_rate
            WHERE meta_access_rate.seller_group_id = sg.seller_group_id
              AND meta_access_rate.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})
              AND meta_access_rate.seller_group_lot_project_rate_status = 'active'
          )`
        : ' AND 1 = 0';
    const metaRateCondition = accessibleProjectIds === null
      ? `rate.seller_group_lot_project_rate_status = 'active'`
      : accessibleProjectIds.length
        ? `rate.seller_group_lot_project_rate_status = 'active' AND rate.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})`
        : '1 = 0';
    const [metaRows] = await db.query(
      `
        SELECT
          COUNT(DISTINCT CASE WHEN sg.seller_group_status = 'active' THEN sg.seller_group_id END) AS active,
          COUNT(DISTINCT CASE WHEN COALESCE(member.is_system_dummy, 0) = 0 THEN member.accredited_seller_id END) AS total_members,
          COUNT(DISTINCT sg.seller_group_external_account_user_id) AS total_accounts,
          COUNT(DISTINCT CASE WHEN ${metaRateCondition} THEN CONCAT(rate.seller_group_id, ':', rate.lot_project_id) END) AS accredited_projects
        FROM seller_groups sg
        LEFT JOIN accredited_sellers member ON member.seller_group_id = sg.seller_group_id
        LEFT JOIN seller_group_lot_project_rates rate ON rate.seller_group_id = sg.seller_group_id
        WHERE sg.seller_group_type = ?${metaAccessSql}
      `,
      [
        ...(accessibleProjectIds === null || !accessibleProjectIds.length ? [] : accessibleProjectIds),
        groupType,
        ...(accessibleProjectIds === null || !accessibleProjectIds.length ? [] : accessibleProjectIds),
      ]
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

export const getNetworkPoolShares = async (_req, res) => {
  try {
    const poolShares = await loadInHousePoolShares(db);
    const companyProfitPolicy = await loadCompanyProfitPolicy(db);
    return res.json({
      success: true,
      data: { ...poolShares, max_company_profit_percent_of_pool: companyProfitPolicy.maxPercentOfPool },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  }
};

export const getGroupOptions = async (req, res) => {
  try {
    const groupType = normalizeSellerGroupType(req.query.groupType || req.query.seller_group_type || 'in_house');
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    const accessSql = accessibleProjectIds === null
      ? ''
      : accessibleProjectIds.length
        ? ` AND EXISTS (
            SELECT 1 FROM seller_group_lot_project_rates access_rate
            WHERE access_rate.seller_group_id = seller_groups.seller_group_id
              AND access_rate.lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})
              AND access_rate.seller_group_lot_project_rate_status = 'active'
          )`
        : ' AND 1 = 0';
    const [rows] = await db.query(
      `SELECT seller_group_id, seller_group_name, seller_group_type,
              seller_group_head_user_id, seller_group_external_account_user_id,
              broker_name, broker_license_number, realty_name, broker_prc_number,
              seller_group_status
       FROM seller_groups
       WHERE seller_group_status = 'active' AND seller_group_type = ?${accessSql}
       ORDER BY seller_group_name ASC`,
      [groupType, ...(accessibleProjectIds === null ? [] : accessibleProjectIds)]
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
    if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });

    await connection.beginTransaction();
    const [existingRows] = await connection.query(
      `SELECT * FROM seller_groups WHERE seller_group_id = ? LIMIT 1 FOR UPDATE`,
      [groupId]
    );
    const existing = existingRows[0];
    if (!existing) { await connection.rollback(); return res.status(404).json({ message: 'Network not found.' }); }
    await assertCanMutateWholeGroup(connection, req.authUser, groupId);

    const requestedType = normalizeSellerGroupType(req.body.seller_group_type || existing.seller_group_type);
    const groupType = normalizeSellerGroupType(existing.seller_group_type);
    if (requestedType !== groupType) throw createValidationError('Network Type cannot be changed after creation.');

    const {
      seller_group_name,
      seller_group_head_user_id,
      seller_group_description,
      seller_group_status = existing.seller_group_status,
      project_rates = [],
      external_account = {},
    } = req.body;
    const name = String(seller_group_name || '').trim();
    if (!name) throw createValidationError('Network Name is required.');
    const broker = normalizeNetworkBrokerFields(req.body);
    const brokerWarnings = await assertUniqueNetworkBrokerIdentity(connection, broker, groupId);
    await assertDuplicateBrokerNameConfirmed(connection, broker, req.body, {
      excludeGroupId: groupId,
      previousNormalized: existing.broker_name_normalized || normalizeNetworkIdentity(existing.broker_name),
    });
    const previousHead = groupType === 'in_house' ? await getCurrentGroupHead(connection, groupId) : null;
    const nextHead = groupType === 'in_house'
      ? await validateGroupHead(connection, seller_group_head_user_id, groupId)
      : null;
    if (groupType === 'external' && seller_group_head_user_id) {
      throw createValidationError('External Networks do not use an in-house Network Hierarchy Head.');
    }

    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser, connection);
    const projects = await getActiveLotProjects(connection, req.authUser);
    const poolShares = await loadInHousePoolShares(connection);
    const normalizedRates = normalizeGroupProjectRates(project_rates, projects, {
      groupHeadRole: nextHead?.role || 'division_manager',
      groupType,
      poolShares,
    });
    await assertGroupRatesWithinCompanyProfitPolicy(connection, normalizedRates, projects, groupType);

    const [existingRateRows] = await connection.query(
      `SELECT seller_group_id, lot_project_id, seller_group_pool_rate, company_profit_rate,
              division_manager_rate, sales_director_rate, unit_manager_rate, sales_agent_rate,
              seller_group_lot_project_rate_status
       FROM seller_group_lot_project_rates
       WHERE seller_group_id = ?
       ORDER BY lot_project_id`,
      [groupId]
    );
    const ratesChanged = rateReviewSignature(existingRateRows) !== rateReviewSignature(normalizedRates);
    const beforeNetwork = buildNetworkSnapshot({ group: existing });
    const afterNetwork = buildNetworkSnapshot({
      group: existing,
      name,
      headUserId: nextHead?.user_id || null,
      description: seller_group_description,
      status: seller_group_status,
      broker,
    });

    let networkAuditCase = null;
    let rateAuditCase = null;
    let returnedReview = null;
    let rateReturnedReview = null;
    if ((isOwnerAdministrator(req.authUser) && Number(req.body?.auditCaseId || req.body?.audit_case_id || 0) > 0)) {
      networkAuditCase = await getPendingAuditCorrectionCase(connection, {
        actor: req.authUser,
        auditCaseId: req.body?.auditCaseId,
        entityType: 'seller_group',
        entityId: groupId,
      });
      if (!networkAuditCase) {
        rateAuditCase = await getPendingAuditCorrectionCase(connection, {
          actor: req.authUser,
          auditCaseId: req.body?.auditCaseId,
          entityType: 'seller_group_project_rates',
          entityId: groupId,
        });
      }
      if (!networkAuditCase && !rateAuditCase) {
        throw Object.assign(new Error('This administrative Network edit requires an Auditor-approved correction case.'), { statusCode: 403, code: 'AUDIT_CORRECTION_REQUIRED' });
      }
      if (rateAuditCase && JSON.stringify(beforeNetwork) !== JSON.stringify(afterNetwork)) {
        throw Object.assign(new Error('This Audit Case is limited to Network project rates. Leave the Network identity/status fields unchanged.'), { statusCode: 409, code: 'AUDIT_CORRECTION_SCOPE_MISMATCH' });
      }
      if (networkAuditCase && ratesChanged) {
        throw Object.assign(new Error('This Audit Case is limited to the Network record. Project-rate corrections require the rate Audit Case.'), { statusCode: 409, code: 'AUDIT_CORRECTION_SCOPE_MISMATCH' });
      }
    } else {
      returnedReview = await getReturnedOperationalReviewForActor(connection, {
        actor: req.authUser,
        actionKey: 'network.edit',
        entityType: 'seller_group',
        entityId: groupId,
        reviewId: req.body?.reviewId,
      });
      if (!returnedReview && req.body?.reviewId) {
        for (const actionKey of ['network.create', 'network.status']) {
          returnedReview = await getReturnedOperationalReviewForActor(connection, {
            actor: req.authUser,
            actionKey,
            entityType: 'seller_group',
            entityId: groupId,
            reviewId: req.body.reviewId,
          });
          if (returnedReview) break;
        }
      }
      if (!returnedReview && req.body?.reviewId) {
        rateReturnedReview = await getReturnedNetworkRateReviewForActor(connection, {
          actor: req.authUser,
          groupId,
          reviewId: req.body.reviewId,
        });
      }
      if (rateReturnedReview && JSON.stringify(beforeNetwork) !== JSON.stringify(afterNetwork)) {
        throw Object.assign(new Error('This returned Review is limited to Network project rates. Leave the Network identity/status fields unchanged and correct only the requested rates.'), { statusCode: 409, code: 'RETURNED_REVIEW_SCOPE_MISMATCH' });
      }
    }

    await assertEntityNotReviewLocked(connection, {
      actor: req.authUser,
      entityType: 'seller_group',
      entityId: groupId,
      allowReviewId: networkAuditCase?.operational_review_id || returnedReview?.operational_review_id || null,
    });

    let ratesGovernance = null;
    if (ratesChanged) {
      const returnedRateEntityId = rateReturnedReview?.entity_id ? String(rateReturnedReview.entity_id) : String(groupId);
      const returnedRateProjectId = Number(returnedRateEntityId.split(':')[1] || 0);
      if (rateReturnedReview && returnedRateProjectId) {
        const beforeOther = normalizeRateReviewPayload(existingRateRows).filter((rate) => rate.projectId !== returnedRateProjectId);
        const afterOther = normalizeRateReviewPayload(normalizedRates).filter((rate) => rate.projectId !== returnedRateProjectId);
        if (JSON.stringify(beforeOther) !== JSON.stringify(afterOther)) {
          throw Object.assign(new Error('This returned Review applies to one project rate only. Correct that project without changing rates for other projects.'), { statusCode: 409, code: 'RETURNED_REVIEW_SCOPE_MISMATCH' });
        }
      }
      await assertEntityNotReviewLocked(connection, {
        actor: req.authUser,
        entityType: 'seller_group_project_rates',
        entityId: returnedRateEntityId,
        allowReviewId: rateAuditCase?.operational_review_id || rateReturnedReview?.operational_review_id || null,
      });
      if (!rateAuditCase && !rateReturnedReview) {
        ratesGovernance = await authorizeGovernedAction(connection, {
          actor: req.authUser,
          actionKey: 'network.rates.update',
          projectId: null,
          entityId: groupId,
          entityLabel: `${name} project rates`,
          payload: { groupId, rates: normalizeRateReviewPayload(normalizedRates) },
          reason: req.body?.rateChangeReason || `Update project rates for ${name}`,
        });
      }
    }

    await connection.query(
      `UPDATE seller_groups SET
         seller_group_name = ?, seller_group_head_user_id = ?,
         seller_group_description = ?, seller_group_status = ?,
         broker_name = ?, broker_license_number = ?, realty_name = ?, broker_prc_number = ?,
         broker_name_normalized = ?, broker_license_number_normalized = ?, realty_name_normalized = ?, broker_prc_number_normalized = ?
       WHERE seller_group_id = ?`,
      [name, nextHead?.user_id || null, String(seller_group_description || '').trim() || null, normalizeStatus(seller_group_status),
       broker.broker_name, broker.broker_license_number, broker.realty_name, broker.broker_prc_number,
       broker.broker_name_normalized, broker.broker_license_number_normalized, broker.realty_name_normalized, broker.broker_prc_number_normalized, groupId]
    );

    if (groupType === 'external') {
      await updateExternalAccount(connection, groupId, external_account, seller_group_status);
    } else if (nextHead) {
      await attachAndSyncGroupHead(connection, groupId, nextHead, previousHead);
    }

    await assertSellerGroupRoleHierarchy(connection, groupId);
    await syncGroupProjectAccreditations(connection, groupId, normalizedRates, groupType, accessibleProjectIds);

    await writeAuditLog(connection, req, {
      action: 'update', module: 'Groups', entityType: 'seller_group', entityId: String(groupId),
      entityLabel: name, title: `Updated ${groupTypeLabel(groupType)}`,
      description: `Updated ${groupTypeLabel(groupType)} ${name}.`,
      metadata: { groupType, status: normalizeStatus(seller_group_status), broker, projectRates: normalizedRates },
    });

    let networkReview = null;
    if (networkAuditCase) {
      networkReview = await advanceAuditCaseToRecheck(connection, {
        auditCase: networkAuditCase,
        actor: req.authUser,
        correctionSummary: String(req.body?.correctionSummary || 'Corrected Network details from the Audit Case.').trim(),
        afterSnapshot: { ...afterNetwork, rates: normalizeRateReviewPayload(normalizedRates) },
        metadata: { actionKey: 'network.edit' },
      });
    } else if (returnedReview) {
      networkReview = await resubmitReturnedOperationalReview(connection, {
        review: returnedReview,
        actor: req.authUser,
        department: 'marketing',
        projectId: null,
        entityLabel: name,
        beforeSnapshot: beforeNetwork,
        afterSnapshot: { ...afterNetwork, rates: normalizeRateReviewPayload(normalizedRates) },
      });
    } else {
      networkReview = await createOperationalReview(connection, {
        actor: req.authUser,
        actionKey: 'network.edit',
        department: 'marketing',
        projectId: null,
        entityType: 'seller_group',
        entityId: groupId,
        entityLabel: name,
        beforeSnapshot: beforeNetwork,
        afterSnapshot: { ...afterNetwork, rates: normalizeRateReviewPayload(normalizedRates) },
      });
    }

    let rateReview = null;
    if (ratesChanged) {
      const returnedRateProjectId = Number(String(rateReturnedReview?.entity_id || '').split(':')[1] || 0);
      const returnedRateProject = returnedRateProjectId
        ? projects.find((project) => Number(project.lot_project_id) === returnedRateProjectId) || {}
        : null;
      const beforeRateRecord = returnedRateProjectId
        ? existingRateRows.find((rate) => Number(rate.lot_project_id) === returnedRateProjectId) || {}
        : null;
      const afterRateRecord = returnedRateProjectId
        ? normalizedRates.find((rate) => Number(rate.lot_project_id || rate.projectId) === returnedRateProjectId) || {}
        : null;
      const beforeRates = returnedRateProjectId
        ? buildSingleProjectRateReviewSnapshot({ groupId, groupType, project: returnedRateProject, rate: beforeRateRecord })
        : { groupId, groupType, rates: normalizeRateReviewPayload(existingRateRows) };
      const afterRates = returnedRateProjectId
        ? buildSingleProjectRateReviewSnapshot({ groupId, groupType, project: returnedRateProject, rate: afterRateRecord })
        : { groupId, groupType, rates: normalizeRateReviewPayload(normalizedRates) };
      if (rateAuditCase) {
        rateReview = await advanceAuditCaseToRecheck(connection, {
          auditCase: rateAuditCase,
          actor: req.authUser,
          correctionSummary: String(req.body?.correctionSummary || 'Corrected Network project rates from the Audit Case.').trim(),
          afterSnapshot: afterRates,
          metadata: { actionKey: 'network.rates.update' },
        });
      } else if (rateReturnedReview) {
        rateReview = await resubmitReturnedOperationalReview(connection, {
          review: rateReturnedReview,
          actor: req.authUser,
          department: 'marketing',
          projectId: returnedRateProjectId || null,
          entityLabel: rateReturnedReview.entity_label || `${name} project rates`,
          beforeSnapshot: beforeRates,
          afterSnapshot: afterRates,
          message: 'Network project rates corrected and resubmitted for Marketing Head review.',
        });
      } else {
        rateReview = await createOperationalReview(connection, {
          actor: req.authUser,
          actionKey: 'network.rates.update',
          department: 'marketing',
          projectId: null,
          entityType: 'seller_group_project_rates',
          entityId: groupId,
          entityLabel: `${name} project rates`,
          beforeSnapshot: beforeRates,
          afterSnapshot: afterRates,
          headPreApprovedByUserId: ratesGovernance?.headPreApprovedByUserId || null,
        });
      }
    }

    await connection.commit();
    return res.json({
      message: `${groupTypeLabel(groupType)} updated successfully.`,
      warnings: brokerWarnings,
      review: networkReview,
      rate_review: rateReview,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error), ...(error?.details ? { details: error.details } : {}) });
  } finally {
    connection.release();
  }
};

export const toggleGroupStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });

    await connection.beginTransaction();
    const [rows] = await connection.query(
      `SELECT seller_group_id, seller_group_name, seller_group_status, seller_group_type, seller_group_external_account_user_id
       FROM seller_groups WHERE seller_group_id = ? LIMIT 1 FOR UPDATE`,
      [groupId]
    );
    const group = rows[0];
    if (!group) { await connection.rollback(); return res.status(404).json({ message: 'Network not found.' }); }
    await assertCanMutateWholeGroup(connection, req.authUser, groupId);
    const nextStatus = normalizeStatus(req.body.status || (group.seller_group_status === 'active' ? 'inactive' : 'active'));

    let auditCase = null;
    let returnedReview = null;
    if ((isOwnerAdministrator(req.authUser) && Number(req.body?.auditCaseId || req.body?.audit_case_id || 0) > 0)) {
      auditCase = await getPendingAuditCorrectionCase(connection, {
        actor: req.authUser,
        auditCaseId: req.body?.auditCaseId,
        entityType: 'seller_group',
        entityId: groupId,
      });
      if (!auditCase) {
        throw Object.assign(new Error('This administrative Network status change requires an Auditor-approved correction case.'), { statusCode: 403, code: 'AUDIT_CORRECTION_REQUIRED' });
      }
    } else {
      returnedReview = await getReturnedOperationalReviewForActor(connection, {
        actor: req.authUser,
        actionKey: 'network.status',
        entityType: 'seller_group',
        entityId: groupId,
        reviewId: req.body?.reviewId,
      });
    }
    await assertEntityNotReviewLocked(connection, {
      actor: req.authUser,
      entityType: 'seller_group',
      entityId: groupId,
      allowReviewId: auditCase?.operational_review_id || returnedReview?.operational_review_id || null,
    });

    await connection.query(`UPDATE seller_groups SET seller_group_status = ? WHERE seller_group_id = ?`, [nextStatus, groupId]);
    if (normalizeSellerGroupType(group.seller_group_type) === 'external' && group.seller_group_external_account_user_id) {
      await connection.query(`UPDATE users SET status = ? WHERE id = ?`, [nextStatus, group.seller_group_external_account_user_id]);
      await connection.query(`UPDATE accredited_sellers SET accredited_seller_status = ? WHERE user_id = ?`, [nextStatus, group.seller_group_external_account_user_id]);
    }

    const beforeSnapshot = { groupId, name: group.seller_group_name, status: group.seller_group_status };
    const afterSnapshot = { groupId, name: group.seller_group_name, status: nextStatus };
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Groups', entityType: 'seller_group', entityId: String(groupId),
      entityLabel: group.seller_group_name, title: 'Updated Network status',
      description: `${group.seller_group_name} is now ${nextStatus}.`,
      metadata: { before: beforeSnapshot, after: afterSnapshot },
    });

    let workflow = null;
    if (auditCase) {
      workflow = await advanceAuditCaseToRecheck(connection, {
        auditCase,
        actor: req.authUser,
        correctionSummary: String(req.body?.correctionSummary || 'Corrected Network status from the Audit Case.').trim(),
        afterSnapshot,
        metadata: { actionKey: 'network.status' },
      });
    } else if (returnedReview) {
      workflow = await resubmitReturnedOperationalReview(connection, {
        review: returnedReview,
        actor: req.authUser,
        department: 'marketing',
        projectId: null,
        entityLabel: group.seller_group_name,
        beforeSnapshot,
        afterSnapshot,
      });
    } else {
      workflow = await createOperationalReview(connection, {
        actor: req.authUser,
        actionKey: 'network.status',
        department: 'marketing',
        projectId: null,
        entityType: 'seller_group',
        entityId: groupId,
        entityLabel: group.seller_group_name,
        beforeSnapshot,
        afterSnapshot,
      });
    }

    await connection.commit();
    return res.json({ message: `${groupTypeLabel(group.seller_group_type)} is now ${nextStatus}.`, status: nextStatus, review: workflow });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

// A Network can be permanently deleted only while it is still empty: no
// members (other than an External Network's own representative account) and
// no sale or commission ever linked to it. Anything else must be deactivated so
// history stays intact.
const getNetworkDeletionStatus = async (connection, groups = []) => {
  const list = groups.filter((group) => Number(group?.seller_group_id || 0) > 0);
  const result = new Map();
  if (!list.length) return result;
  const ids = list.map((group) => Number(group.seller_group_id));
  const placeholders = ids.map(() => '?').join(',');
  const externalAccountIds = new Map(list.map((group) => [Number(group.seller_group_id), Number(group.seller_group_external_account_user_id || 0)]));

  const [memberRows] = await connection.query(
    `SELECT seller_group_id, user_id, accredited_seller_id FROM accredited_sellers WHERE seller_group_id IN (${placeholders})`,
    ids
  );
  const [saleRows] = await connection.query(
    `SELECT member.seller_group_id, COUNT(DISTINCT profile.lot_project_client_profile_id) total
     FROM accredited_sellers member
     INNER JOIN lot_project_client_profiles profile ON profile.assigned_accredited_seller_id = member.accredited_seller_id
     WHERE member.seller_group_id IN (${placeholders})
     GROUP BY member.seller_group_id`,
    ids
  ).catch(() => [[]]);
  const [commissionRows] = await connection.query(
    `SELECT member.seller_group_id, COUNT(DISTINCT commission.lot_project_commission_id) total
     FROM accredited_sellers member
     INNER JOIN lot_project_commissions commission
       ON commission.accredited_seller_id = member.accredited_seller_id
       OR commission.sale_origin_accredited_seller_id = member.accredited_seller_id
       OR commission.sale_owner_accredited_seller_id = member.accredited_seller_id
     WHERE member.seller_group_id IN (${placeholders})
     GROUP BY member.seller_group_id`,
    ids
  ).catch(() => [[]]);
  const names = list.map((group) => String(group.seller_group_name || '')).filter(Boolean);
  const [snapshotRows] = names.length
    ? await connection.query(
      `SELECT seller_group_name_snapshot name, COUNT(*) total FROM lot_project_commissions
       WHERE seller_group_name_snapshot IN (${names.map(() => '?').join(',')}) GROUP BY seller_group_name_snapshot`,
      names
    ).catch(() => [[]])
    : [[]];

  const count = (rows, groupId) => Number((rows || []).find((row) => Number(row.seller_group_id) === groupId)?.total || 0);
  for (const group of list) {
    const groupId = Number(group.seller_group_id);
    const externalUserId = externalAccountIds.get(groupId) || 0;
    const memberCount = memberRows.filter((row) => Number(row.seller_group_id) === groupId && Number(row.user_id) !== externalUserId).length;
    const salesCount = count(saleRows, groupId);
    const commissionCount = count(commissionRows, groupId)
      + Number((snapshotRows || []).find((row) => row.name === group.seller_group_name)?.total || 0);
    const reasons = [];
    if (memberCount) reasons.push(`${memberCount} member${memberCount === 1 ? '' : 's'}`);
    if (salesCount) reasons.push(`${salesCount} sale${salesCount === 1 ? '' : 's'}`);
    if (!salesCount && commissionCount) reasons.push('commission history');
    result.set(groupId, {
      canDelete: reasons.length === 0,
      memberCount,
      salesCount,
      commissionCount,
      reason: reasons.length ? `This Network already has ${reasons.join(' and ')}. Deactivate it instead so history is kept.` : '',
    });
  }
  return result;
};

export const deleteGroup = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });
    await connection.beginTransaction();
    const [rows] = await connection.query(`SELECT * FROM seller_groups WHERE seller_group_id = ? LIMIT 1 FOR UPDATE`, [groupId]);
    const group = rows[0];
    if (!group) { await connection.rollback(); return res.status(404).json({ message: 'Network not found.' }); }
    await assertCanMutateWholeGroup(connection, req.authUser, groupId);
    // A Network inside an active correction cycle stays put until that case is finished.
    await assertEntityNotReviewLocked(connection, { entityType: 'seller_group', entityId: groupId });
    await assertEntityNotReviewLocked(connection, { entityType: 'seller_group_project_rates', entityId: groupId });

    const status = (await getNetworkDeletionStatus(connection, [group])).get(groupId);
    if (!status?.canDelete) {
      throw Object.assign(new Error(status?.reason || 'This Network can no longer be deleted. Deactivate it instead.'), { statusCode: 409, code: 'NETWORK_NOT_DELETABLE' });
    }

    const [rateRows] = await connection.query(
      `SELECT lot_project_id, seller_group_pool_rate, company_profit_rate, division_manager_rate, sales_director_rate,
              unit_manager_rate, sales_agent_rate, seller_group_lot_project_rate_status
       FROM seller_group_lot_project_rates WHERE seller_group_id = ? ORDER BY lot_project_id`,
      [groupId]
    );
    const externalAccount = normalizeSellerGroupType(group.seller_group_type) === 'external'
      ? await getExternalAccount(connection, groupId)
      : null;
    const beforeSnapshot = {
      ...buildNetworkSnapshot({ group }),
      rates: normalizeRateReviewPayload(rateRows),
      ...(externalAccount ? { externalAccount: { name: externalAccount.full_name, email: externalAccount.email } } : {}),
    };

    await connection.query(`DELETE FROM seller_group_lot_project_rates WHERE seller_group_id = ?`, [groupId]);
    if (externalAccount?.user_id) {
      await connection.query(`UPDATE seller_groups SET seller_group_external_account_user_id = NULL WHERE seller_group_id = ?`, [groupId]);
      if (externalAccount.accredited_seller_id) {
        await connection.query(`DELETE FROM accredited_sellers WHERE accredited_seller_id = ?`, [externalAccount.accredited_seller_id]);
      }
      try {
        await connection.query(`DELETE FROM users WHERE id = ? AND role = ?`, [externalAccount.user_id, EXTERNAL_GROUP_ROLE]);
      } catch (error) {
        if (!['ER_ROW_IS_REFERENCED_2', 'ER_ROW_IS_REFERENCED'].includes(error?.code)) throw error;
        // Still referenced elsewhere (audit history): keep the login-disabled
        // account but inactive, and free the email for a corrected Network.
        await connection.query(
          `UPDATE users SET status = 'inactive', can_login = 0, email = LEFT(CONCAT('deleted+', id, '+', email), 150) WHERE id = ?`,
          [externalAccount.user_id]
        );
      }
    }
    await connection.query(`DELETE FROM seller_groups WHERE seller_group_id = ?`, [groupId]);

    await writeAuditLog(connection, req, {
      action: 'delete',
      module: 'Groups',
      entityType: 'seller_group',
      entityId: String(groupId),
      entityLabel: group.seller_group_name,
      title: `Deleted ${groupTypeLabel(group.seller_group_type)}`,
      description: `Deleted empty ${groupTypeLabel(group.seller_group_type)} ${group.seller_group_name}. It had no members and no sales.`,
      metadata: { before: beforeSnapshot, reason: String(req.body?.reason || '').trim() || null },
    });

    const review = await createOperationalReview(connection, {
      actor: req.authUser,
      actionKey: 'network.delete',
      department: 'marketing',
      projectId: null,
      entityType: 'seller_group',
      entityId: groupId,
      entityLabel: group.seller_group_name,
      beforeSnapshot,
      afterSnapshot: { ...beforeSnapshot, status: 'deleted', rates: [] },
    });

    await connection.commit();
    return res.json({ message: `${group.seller_group_name} was deleted.`, review });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const viewGroup = async (req, res) => {
  try {
    const groupId = Number(req.params.id);
    if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });
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
    if (!group) return res.status(404).json({ message: 'Network not found.' });
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    if (accessibleProjectIds !== null) {
      const [accessRows] = accessibleProjectIds.length
        ? await db.query(
            `SELECT 1 FROM seller_group_lot_project_rates
             WHERE seller_group_id = ?
               AND seller_group_lot_project_rate_status = 'active'
               AND lot_project_id IN (${accessibleProjectIds.map(() => '?').join(', ')})
             LIMIT 1`,
            [groupId, ...accessibleProjectIds]
          )
        : [[]];
      if (!accessRows.length) return res.status(403).json({ message: 'You do not have access to this group through any assigned project.' });
    }
    const groupType = normalizeSellerGroupType(group.seller_group_type);
    const [members] = await db.query(
      `SELECT a.accredited_seller_id, a.user_id, ${fullNameSql('u')} AS full_name,
              u.first_name, u.middle_name, u.last_name,
              u.email, u.contact_no, u.tin_no, u.prc_no, u.address, u.role, u.status AS user_status,
              a.accredited_seller_reports_under_user_id AS reports_under_user_id,
              ${fullNameSql('parent')} AS reports_under_name,
              parent.email AS reports_under_email,
              COALESCE(a.is_system_dummy, 0) AS is_system_dummy,
              a.accredited_seller_accreditation_date,
              a.accredited_seller_status
       FROM accredited_sellers a
       INNER JOIN users u ON u.id = a.user_id
       LEFT JOIN users parent ON parent.id = a.accredited_seller_reports_under_user_id
       WHERE a.seller_group_id = ?
       ORDER BY FIELD(u.role, 'division_manager', 'sales_director', 'unit_manager', 'sales_agent', 'external_group'), full_name ASC`,
      [groupId]
    );
    const [hydratedGroup] = await hydrateGroupRates([group], db, accessibleProjectIds);
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
        sg.broker_name, sg.broker_license_number, sg.realty_name, sg.broker_prc_number,
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
        sgr.seller_group_pool_rate, sgr.company_profit_rate, sgr.division_manager_rate,
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
  const poolShares = await loadInHousePoolShares(connection);
  projectRates.forEach((rate) => validateGroupFixedRateStructure(rate, {
    groupHeadRole: rate.group_head_role || 'division_manager',
    projectName: rate.lot_project_name || 'Project',
    groupType: rate.seller_group_type,
    poolShares,
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
            rate.seller_group_pool_rate, rate.company_profit_rate, rate.division_manager_rate,
            rate.sales_director_rate, rate.unit_manager_rate, rate.sales_agent_rate,
            rate.commission_structure_type, rate.seller_group_lot_project_rate_status
     FROM seller_group_lot_project_rates rate
     INNER JOIN lot_projects project ON project.lot_project_id = rate.lot_project_id AND project.lot_project_status = 'active'
     WHERE rate.seller_group_id = ? AND rate.seller_group_lot_project_rate_status = 'active'
     ORDER BY project.lot_project_name ASC`,
    [groupId]
  );
  const poolShares = await loadInHousePoolShares(connection);
  return rows.map((row) => {
    const derived = validateGroupFixedRateStructure(row, {
      groupType: row.commission_structure_type,
      projectName: row.lot_project_name || 'Project',
      poolShares,
    });
    return {
      ...row,
      lot_project_id: Number(row.lot_project_id),
      seller_group_pool_rate: derived.seller_group_pool_rate,
      company_profit_rate: derived.company_profit_rate,
      distribution_pool_rate: derived.distribution_pool_rate,
      division_manager_rate: derived.division_manager_rate,
      sales_director_rate: derived.sales_director_rate,
      unit_manager_rate: derived.unit_manager_rate,
      sales_agent_rate: derived.sales_agent_rate,
      allocated_rate: derived.allocated_rate,
      pool_shares: poolShares,
    };
  });
};

export const getGroupProjectOptions = async (req, res) => {
  try {
    const groupId = Number(req.params.groupId || 0);
    if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });
    const [groupRows] = await db.query(
      `SELECT seller_group_id, seller_group_name, seller_group_type, seller_group_status
       FROM seller_groups WHERE seller_group_id = ? LIMIT 1`,
      [groupId]
    );
    if (!groupRows[0]) return res.status(404).json({ message: 'Network not found.' });
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser);
    const projects = (await getGroupAccreditedProjects(db, groupId)).filter((project) =>
      accessibleProjectIds === null || accessibleProjectIds.includes(Number(project.lot_project_id))
    );
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
    if (!groupId || !projectId) throw createValidationError('Network and project are required.');
    if (!(await canAccessProject(req.authUser, projectId, connection))) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('This Network is not accredited to the selected project.');

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
    const [recentSalesRows] = await connection.query(
      `SELECT
         profile.lot_project_client_profile_id AS profile_id,
         account.lot_project_account_id AS account_id,
         account.account_reference,
         listing.lot_project_listing_id AS listing_id,
         listing.lot_project_listing_unit_id AS unit_id,
         COALESCE(
           NULLIF(TRIM(account.buyer_name_snapshot), ''),
           NULLIF(TRIM(CONCAT_WS(' ', profile.buyer_first_name, profile.buyer_middle_name, profile.buyer_last_name)), ''),
           'Buyer'
         ) AS buyer_name,
         ${fullNameSql('assigned_user')} AS seller_name,
         ${contractTcpExpr} AS contract_price,
         COALESCE(account.account_status, profile.lot_project_client_profile_status) AS sale_status,
         COALESCE(account.reservation_date, profile.lot_project_client_profile_created_at) AS sale_date
       FROM lot_project_client_profiles profile
       INNER JOIN lot_project_listings listing
         ON listing.lot_project_listing_id = profile.lot_project_listing_id
       INNER JOIN accredited_sellers assigned
         ON assigned.accredited_seller_id = profile.assigned_accredited_seller_id
       INNER JOIN users assigned_user ON assigned_user.id = assigned.user_id
       LEFT JOIN lot_project_accounts account
         ON account.lot_project_client_profile_id = profile.lot_project_client_profile_id
       WHERE profile.lot_project_id = ?
         AND assigned.seller_group_id = ?
         AND profile.lot_project_client_profile_status <> 'cancelled'
       ORDER BY
         COALESCE(account.reservation_date, profile.lot_project_client_profile_created_at) DESC,
         profile.lot_project_client_profile_id DESC
       LIMIT 10`,
      [projectId, groupId]
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
        recentSales: recentSalesRows.map((row) => ({
          profileId: Number(row.profile_id || 0),
          accountId: row.account_id ? Number(row.account_id) : null,
          accountReference: row.account_reference || null,
          listingId: Number(row.listing_id || 0),
          unitId: row.unit_id || '-',
          buyerName: row.buyer_name || 'Buyer',
          sellerName: row.seller_name || 'Unassigned seller',
          contractPrice: Number(row.contract_price || 0),
          status: row.sale_status || 'active',
          saleDate: row.sale_date || null,
          projectSlug: group.lot_project_slug || null,
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
    if (!groupId || !projectId) return res.status(400).json({ message: 'Network and project are required.' });
    if (!(await canAccessProject(req.authUser, projectId, connection))) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }
    await requireCommissionConfigurationSchema(connection);
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) return res.status(404).json({ message: 'Network or project not found.' });
    const groupType = normalizeSellerGroupType(group.seller_group_type);
    const members = await loadGroupProjectMembers(connection, groupId);
    const accessibleProjectIds = await getAccessibleProjectIds(req.authUser, connection);
    const accreditedProjects = (await getGroupAccreditedProjects(connection, groupId)).filter((project) =>
      accessibleProjectIds === null || accessibleProjectIds.includes(Number(project.lot_project_id))
    );
    const poolShares = await loadInHousePoolShares(connection);
    const fixedRates = validateGroupFixedRateStructure(group, {
      groupHeadRole: members.find((member) => Number(member.user_id) === Number(group.seller_group_head_user_id))?.role || 'division_manager',
      projectName: group.lot_project_name,
      groupType,
      poolShares,
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
          brokerName: group.broker_name || null,
          brokerLicenseNumber: group.broker_license_number || null,
          realtyName: group.realty_name || null,
          brokerPrcNumber: group.broker_prc_number || null,
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
          companyProfitRate: fixedRates.company_profit_rate,
          distributionPoolRate: fixedRates.distribution_pool_rate,
          poolShares,
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
    if (!groupId || !projectId) throw createValidationError('Network and project are required.');
    if (!(await canAccessProject(req.authUser, projectId, connection))) {
      return res.status(403).json({ message: 'You do not have access to this project.' });
    }
    await requireCommissionConfigurationSchema(connection);
    await connection.beginTransaction();
    const group = await getGroupAndProject(connection, groupId, projectId);
    if (!group) throw createValidationError('Network or project not found.');
    const groupType = normalizeSellerGroupType(group.seller_group_type);
    const [headRows] = await connection.query(`SELECT role FROM users WHERE id = ? LIMIT 1`, [group.seller_group_head_user_id || 0]);
    const poolShares = await loadInHousePoolShares(connection);
    const rates = validateGroupFixedRateStructure({
      seller_group_pool_rate: req.body.poolRate ?? req.body.seller_group_pool_rate,
      company_profit_rate: req.body.companyProfitRate ?? req.body.company_profit_rate ?? 0,
      division_manager_rate: req.body.divisionManagerRate ?? req.body.division_manager_rate ?? 0,
      sales_director_rate: req.body.salesDirectorRate ?? req.body.sales_director_rate ?? 0,
      unit_manager_rate: req.body.unitManagerRate ?? req.body.unit_manager_rate ?? 0,
      sales_agent_rate: req.body.salesAgentRate ?? req.body.sales_agent_rate ?? 0,
    }, {
      groupHeadRole: headRows[0]?.role || 'division_manager',
      projectName: group.lot_project_name,
      groupType,
      poolShares,
    });
    const companyProfitPolicy = await loadCompanyProfitPolicy(connection);
    assertCompanyProfitWithinPolicy(rates, {
      maxPercentOfPool: companyProfitPolicy.maxPercentOfPool,
      projectName: group.lot_project_name,
      groupType,
    });
    const status = normalizeStatus(req.body.status);
    const entityId = `${groupId}:${projectId}`;
    const beforeSnapshot = {
      groupId,
      groupType,
      projectId,
      projectSlug: group.lot_project_slug,
      poolRate: Number(group.seller_group_pool_rate || 0),
      companyProfitRate: Number(group.company_profit_rate || 0),
      divisionManagerRate: Number(group.division_manager_rate || 0),
      salesDirectorRate: Number(group.sales_director_rate || 0),
      unitManagerRate: Number(group.unit_manager_rate || 0),
      salesAgentRate: Number(group.sales_agent_rate || 0),
      status: group.pool_rate_status,
    };
    const afterSnapshot = {
      groupId,
      groupType,
      projectId,
      projectSlug: group.lot_project_slug,
      poolRate: rates.seller_group_pool_rate,
      companyProfitRate: rates.company_profit_rate,
      divisionManagerRate: rates.division_manager_rate,
      salesDirectorRate: rates.sales_director_rate,
      unitManagerRate: rates.unit_manager_rate,
      salesAgentRate: rates.sales_agent_rate,
      status,
    };

    let auditCase = null;
    let returnedReview = null;
    let governance = null;
    if ((isOwnerAdministrator(req.authUser) && Number(req.body?.auditCaseId || req.body?.audit_case_id || 0) > 0)) {
      auditCase = await getPendingAuditCorrectionCase(connection, {
        actor: req.authUser,
        auditCaseId: req.body?.auditCaseId,
        entityType: 'seller_group_project_rates',
        entityId,
      });
      if (!auditCase) {
        throw Object.assign(new Error('This administrative Network rate change requires an Auditor-approved correction case.'), { statusCode: 403, code: 'AUDIT_CORRECTION_REQUIRED' });
      }
    } else {
      returnedReview = await getReturnedNetworkRateReviewForActor(connection, {
        actor: req.authUser,
        groupId,
        projectId,
        reviewId: req.body?.reviewId,
      });
      if (!returnedReview) {
        governance = await authorizeGovernedAction(connection, {
          actor: req.authUser,
          actionKey: 'network.rates.update',
          projectId,
          entityId,
          entityLabel: `${group.seller_group_name} — ${group.lot_project_name}`,
          payload: afterSnapshot,
          reason: req.body?.reason || `Update Network project rates for ${group.seller_group_name}`,
        });
      }
    }

    await assertEntityNotReviewLocked(connection, {
      actor: req.authUser,
      entityType: 'seller_group_project_rates',
      entityId: returnedReview?.entity_id || entityId,
      allowReviewId: auditCase?.operational_review_id || returnedReview?.operational_review_id || null,
    });

    await connection.query(
      `UPDATE seller_group_lot_project_rates SET
         seller_group_pool_rate = ?, company_profit_rate = ?, division_manager_rate = ?, sales_director_rate = ?,
         unit_manager_rate = ?, sales_agent_rate = ?, commission_structure_type = ?,
         seller_group_lot_project_rate_status = ?
       WHERE seller_group_id = ? AND lot_project_id = ?`,
      [rates.seller_group_pool_rate, rates.company_profit_rate, rates.division_manager_rate, rates.sales_director_rate,
       rates.unit_manager_rate, rates.sales_agent_rate, groupType, status, groupId, projectId]
    );
    await deactivateLegacyIndividualRates(connection, groupId, [projectId]);
    await writeAuditLog(connection, req, {
      action: 'update', module: 'Groups', entityType: 'seller_group_project_rates',
      entityId, entityLabel: `${group.seller_group_name} — ${group.lot_project_name}`,
      title: `Updated ${groupType === 'external' ? 'External Network Pool Rate' : 'In-House Network commission allocation'}`,
      description: groupType === 'external'
        ? `Updated the full Pool Rate for ${group.seller_group_name} in ${group.lot_project_name}.`
        : `Updated Pool Rate and Company Profit allocation for ${group.seller_group_name} in ${group.lot_project_name}.`,
      metadata: { groupId, projectId, groupType, ...rates, status },
    });

    const workflow = auditCase
      ? await advanceAuditCaseToRecheck(connection, {
          auditCase,
          actor: req.authUser,
          correctionSummary: String(req.body?.correctionSummary || 'Corrected Network project rates from the Audit Case.').trim(),
          afterSnapshot,
          metadata: { actionKey: 'network.rates.update' },
        })
      : returnedReview
        ? await resubmitReturnedOperationalReview(connection, {
            review: returnedReview,
            actor: req.authUser,
            department: 'marketing',
            projectId,
            entityLabel: returnedReview.entity_label || `${group.seller_group_name} — ${group.lot_project_name}`,
            beforeSnapshot,
            afterSnapshot,
            message: 'Network project rate corrected and resubmitted for Marketing Head review.',
          })
        : await createOperationalReview(connection, {
            actor: req.authUser,
            actionKey: 'network.rates.update',
            department: 'marketing',
            projectId,
            entityType: 'seller_group_project_rates',
            entityId,
            entityLabel: `${group.seller_group_name} — ${group.lot_project_name}`,
            beforeSnapshot,
            afterSnapshot,
            headPreApprovedByUserId: governance?.headPreApprovedByUserId || null,
          });

    await connection.commit();
    return res.json({
      message: `${groupType === 'external' ? 'External Network Pool Rate' : 'In-House Network commission allocation'} updated successfully.`,
      data: rates,
      review: workflow,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error.statusCode || 500).json({ code: error?.code, message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};



const loadNetworkMemberImportContext = async (connection, groupId, rawRows = [], { lock = false } = {}) => {
  const lockSql = lock ? ' FOR UPDATE' : '';
  const [groupRows] = await connection.query(
    `SELECT seller_group_id, seller_group_name, seller_group_type, seller_group_status,
            seller_group_head_user_id
     FROM seller_groups
     WHERE seller_group_id = ?
     LIMIT 1${lockSql}`,
    [groupId]
  );
  const group = groupRows[0] || null;
  if (!group) throw Object.assign(new Error('In-House Network not found.'), { statusCode: 404 });

  const [currentMembers] = await connection.query(
    `SELECT
       seller.accredited_seller_id,
       seller.user_id,
       seller.seller_group_id,
       seller.accredited_seller_reports_under_user_id,
       seller.accredited_seller_status,
       COALESCE(seller.is_system_dummy, 0) AS is_system_dummy,
       user.first_name,
       user.middle_name,
       user.last_name,
       user.email,
       user.contact_no,
       user.tin_no,
       user.prc_no,
       user.role,
       user.status AS user_status,
       ${fullNameSql('user')} AS full_name
     FROM accredited_sellers seller
     INNER JOIN users user ON user.id = seller.user_id
     WHERE seller.seller_group_id = ?
     ORDER BY seller.accredited_seller_id${lock ? ' FOR UPDATE' : ''}`,
    [groupId]
  );

  const emails = [...new Set((Array.isArray(rawRows) ? rawRows : [])
    .map((row) => normalizeNetworkMemberImportEmail(
      row?.email ?? row?.Email ?? row?.email_address ?? row?.emailAddress ?? ''
    ))
    .filter(Boolean))];

  let existingAccounts = [];
  if (emails.length) {
    const placeholders = emails.map(() => '?').join(', ');
    const [accountRows] = await connection.query(
      `SELECT
         user.id AS user_id,
         user.first_name,
         user.middle_name,
         user.last_name,
         user.email,
         user.contact_no,
         user.tin_no,
         user.prc_no,
         user.role,
         user.account_category,
         user.person_key,
         user.role_sequence,
         user.can_login,
         user.is_system_account,
         user.status AS user_status,
         seller.accredited_seller_id,
         seller.seller_group_id,
         seller.accredited_seller_status,
         COALESCE(seller.is_system_dummy, 0) AS is_system_dummy,
         group_row.seller_group_name,
         headed.seller_group_id AS headed_group_id,
         (SELECT COUNT(*)
            FROM accredited_sellers child
           WHERE child.accredited_seller_reports_under_user_id = user.id
             AND COALESCE(child.is_system_dummy, 0) = 0) AS direct_report_count
       FROM users user
       LEFT JOIN accredited_sellers seller ON seller.user_id = user.id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
       LEFT JOIN seller_groups headed ON headed.seller_group_head_user_id = user.id
       WHERE LOWER(TRIM(user.email)) IN (${placeholders})
       ORDER BY user.id${lock ? ' FOR UPDATE' : ''}`,
      emails
    );
    existingAccounts = accountRows;
  }

  // Duplicate-person data: active sellers sharing a PRC/TIN, plus active sellers
  // with the same last name (for the full name + contact number warning).
  const sourceRows = Array.isArray(rawRows) ? rawRows : [];
  const pickValue = (row, keys) => keys.map((key) => row?.[key]).find((value) => value !== undefined && value !== null && value !== '') ?? '';
  const identityMatches = await loadActiveSellerIdentityMatches(connection, {
    prcNumbers: [
      ...sourceRows.map((row) => pickValue(row, ['prc_no', 'prc_number', 'prcNo', 'PRC Number'])),
      ...existingAccounts.map((account) => account.prc_no),
    ],
    tinNumbers: [
      ...sourceRows.map((row) => pickValue(row, ['tin_no', 'tin', 'tinNo', 'TIN'])),
      ...existingAccounts.map((account) => account.tin_no),
    ],
    lock,
  });
  const lastNames = [...new Set(sourceRows
    .map((row) => String(pickValue(row, ['last_name', 'lastName', 'Last Name'])).trim().toLowerCase())
    .filter(Boolean))].slice(0, 2000);
  let nameContactSellers = [];
  if (lastNames.length) {
    const [nameRows] = await connection.query(
      `SELECT user.id AS user_id, user.first_name, user.middle_name, user.last_name, user.email,
              user.contact_no, group_row.seller_group_name
         FROM users user
         INNER JOIN accredited_sellers seller ON seller.user_id = user.id
         LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
        WHERE user.status = 'active'
          AND seller.accredited_seller_status = 'active'
          AND COALESCE(seller.is_system_dummy, 0) = 0
          AND LOWER(TRIM(user.last_name)) IN (${lastNames.map(() => '?').join(', ')})`,
      lastNames
    );
    nameContactSellers = nameRows;
  }

  return { group, currentMembers, existingAccounts, identityMatches, nameContactSellers };
};

const syncImportedManagedSellerLink = async (connection, accreditedSellerId, reportsUnderUserId) => {
  if (!(await tableExists(connection, 'accredited_seller_managed_sellers'))) return;
  await connection.query(
    'DELETE FROM accredited_seller_managed_sellers WHERE managed_accredited_seller_id = ?',
    [accreditedSellerId]
  );
  if (!reportsUnderUserId) return;
  const [parentRows] = await connection.query(
    'SELECT accredited_seller_id FROM accredited_sellers WHERE user_id = ? LIMIT 1',
    [reportsUnderUserId]
  );
  const parentSellerId = Number(parentRows[0]?.accredited_seller_id || 0);
  if (!parentSellerId) throw createValidationError('The selected reporting parent could not be resolved.');
  await connection.query(
    `INSERT INTO accredited_seller_managed_sellers (
       manager_accredited_seller_id, managed_accredited_seller_id
     ) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [parentSellerId, accreditedSellerId]
  );
};

const analyzeNetworkMemberImportFromDatabase = async (connection, groupId, rows, options = {}) => {
  const context = await loadNetworkMemberImportContext(connection, groupId, rows, options);
  return analyzeNetworkMemberImport({ rows, ...context });
};

export const previewNetworkMemberImport = async (req, res) => {
  const groupId = Number(req.params.groupId || 0);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });
  if (!rows.length) return res.status(400).json({ message: 'The Excel file does not contain any member rows.' });

  const connection = await db.getConnection();
  try {
    const preview = await analyzeNetworkMemberImportFromDatabase(connection, groupId, rows);
    return res.json({ success: true, data: preview });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const commitNetworkMemberImport = async (req, res) => {
  const groupId = Number(req.params.groupId || 0);
  const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
  if (!groupId) return res.status(400).json({ message: 'Invalid Network id.' });
  if (!rows.length) return res.status(400).json({ message: 'The Excel file does not contain any member rows.' });

  const connection = await db.getConnection();
  let transactionStarted = false;
  try {
    // First pass keeps expensive password hashing outside the database transaction.
    const initialPreview = await analyzeNetworkMemberImportFromDatabase(connection, groupId, rows);
    if (!initialPreview.canCommit) {
      return res.status(422).json({
        message: 'Fix the Excel import errors before confirming the import.',
        data: initialPreview,
      });
    }

    const createRows = initialPreview.rows.filter((row) => row.action === 'CREATE');
    const passwordHashes = new Map();
    await Promise.all(createRows.map(async (row) => {
      passwordHashes.set(row.email, await bcrypt.hash('password', 10));
    }));

    await connection.beginTransaction();
    transactionStarted = true;

    // Re-check with row locks. A browser preview is never trusted as authority.
    const lockedPreview = await analyzeNetworkMemberImportFromDatabase(connection, groupId, rows, { lock: true });
    if (!lockedPreview.canCommit) {
      await connection.rollback();
      transactionStarted = false;
      return res.status(409).json({
        message: 'The Network changed after Preview. Review the updated import results before confirming again.',
        data: lockedPreview,
      });
    }

    // Existing seller records may be overwritten only when Final Double-Check
    // showed that exact seller. A row that became an existing-seller update after
    // the browser preview (or was never shown) is rejected, never applied.
    const acknowledgedExistingSellerUpdateEmails = new Set(
      (Array.isArray(req.body?.acknowledgedExistingSellerUpdateEmails) ? req.body.acknowledgedExistingSellerUpdateEmails : [])
        .map((email) => normalizeNetworkMemberImportEmail(email))
        .filter(Boolean)
    );
    const newlyUnacknowledgedExistingUpdates = lockedPreview.rows.filter((row) =>
      row.requiresExistingSellerUpdateConfirmation
      && !acknowledgedExistingSellerUpdateEmails.has(normalizeNetworkMemberImportEmail(row.email))
    );
    if (newlyUnacknowledgedExistingUpdates.length) {
      await connection.rollback();
      transactionStarted = false;
      const count = newlyUnacknowledgedExistingUpdates.length;
      return res.status(409).json({
        code: 'EXISTING_SELLER_UPDATE_CONFIRMATION_REQUIRED',
        message: `${count} existing seller record${count === 1 ? '' : 's'} would be updated without being confirmed in Final Double-Check (${newlyUnacknowledgedExistingUpdates.map((row) => `row ${row.sourceRow}`).join(', ')}). Review the updated Preview and confirm again. Nothing was saved.`,
        data: lockedPreview,
      });
    }

    await assertEntityNotReviewLocked(connection, {
      actor: req.authUser,
      entityType: 'seller_group',
      entityId: groupId,
    });

    const sortedRows = sortNetworkMemberImportRows(lockedPreview.rows);
    const userIdByEmail = new Map();
    const existingSellerIdByEmail = new Map();
    const oldGroupIds = new Set();

    lockedPreview.rows.forEach((row) => {
      if (row.existingUserId) userIdByEmail.set(row.email, Number(row.existingUserId));
      if (row.existingAccreditedSellerId) existingSellerIdByEmail.set(row.email, Number(row.existingAccreditedSellerId));
    });
    const lockedContext = await loadNetworkMemberImportContext(connection, groupId, rows, { lock: false });
    lockedContext.currentMembers.forEach((member) => {
      const email = normalizeNetworkMemberImportEmail(member.email);
      if (email) userIdByEmail.set(email, Number(member.user_id));
    });

    const processed = [];
    for (const row of sortedRows) {
      const reportsUnderUserId = row.isCurrentHead
        ? null
        : row.reportsUnderEmail
          ? Number(userIdByEmail.get(row.reportsUnderEmail) || 0)
          : null;

      if (row.reportsUnderEmail && !reportsUnderUserId) {
        throw createValidationError(`Row ${row.sourceRow}: Reports Under Email ${row.reportsUnderEmail} could not be resolved during import.`);
      }

      let userId = Number(row.existingUserId || 0);
      let accreditedSellerId = Number(row.existingAccreditedSellerId || 0);

      if (row.action === 'CREATE') {
        const passwordHash = passwordHashes.get(row.email) || await bcrypt.hash('password', 10);
        const sourcePersonKey = String(row.sourcePersonKey || '').trim() || null;
        let roleSequence = 1;
        if (sourcePersonKey) {
          const [sequenceRows] = await connection.query(
            'SELECT COALESCE(MAX(role_sequence), 0) + 1 AS next_sequence FROM users WHERE person_key = ? AND role = ? FOR UPDATE',
            [sourcePersonKey, row.role]
          );
          roleSequence = Math.max(Number(sequenceRows[0]?.next_sequence || 1), 1);
        }
        const preserveExistingLogin = Boolean(row.sourcePersonUserId);
        const [userResult] = await connection.query(
          `INSERT INTO users (
             account_category, person_key, role_sequence,
             first_name, last_name, middle_name, contact_no, tin_no, prc_no,
             email, password_hash, role, admin_type, admin_all_projects,
             status, must_change_password, can_login, is_system_account
           ) VALUES ('seller', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, 0, 'active', ?, ?, 0)`,
          [
            sourcePersonKey,
            roleSequence,
            row.firstName,
            row.lastName,
            row.middleName || null,
            row.contactNumber || null,
            row.tinNo || null,
            row.prcNo || null,
            row.email,
            passwordHash,
            row.role,
            preserveExistingLogin ? 0 : 1,
            preserveExistingLogin ? 0 : 1,
          ]
        );
        userId = Number(userResult.insertId);
        const [sellerResult] = await connection.query(
          `INSERT INTO accredited_sellers (
             user_id, seller_group_id, accredited_seller_reports_under_user_id,
             accredited_seller_accreditation_date, accredited_seller_status
           ) VALUES (?, ?, ?, CURDATE(), 'active')`,
          [userId, groupId, reportsUnderUserId || null]
        );
        accreditedSellerId = Number(sellerResult.insertId);
        if (await tableExists(connection, 'employees')) {
          await connection.query(
            `UPDATE employees
                SET linked_user_id = COALESCE(linked_user_id, ?)
              WHERE LOWER(TRIM(email)) = LOWER(?)
                AND linked_user_id IS NULL`,
            [row.sourcePersonUserId || userId, row.email]
          );
        }
      } else {
        if (row.existingGroupId && Number(row.existingGroupId) !== groupId) oldGroupIds.add(Number(row.existingGroupId));
        await connection.query(
          `UPDATE users
              SET first_name = ?, last_name = ?, middle_name = ?,
                  contact_no = CASE WHEN ? <> '' THEN ? ELSE contact_no END,
                  tin_no = CASE WHEN ? <> '' THEN ? ELSE tin_no END,
                  prc_no = CASE WHEN ? <> '' THEN ? ELSE prc_no END,
                  status = 'active'
            WHERE id = ?`,
          [
            row.firstName,
            row.lastName,
            row.middleName || null,
            row.contactNumber, row.contactNumber,
            row.tinNo, row.tinNo,
            row.prcNo, row.prcNo,
            userId,
          ]
        );
        if (accreditedSellerId) {
          await connection.query(
            `UPDATE accredited_sellers
                SET seller_group_id = ?,
                    accredited_seller_reports_under_user_id = ?,
                    accredited_seller_status = 'active',
                    accredited_seller_accreditation_date = COALESCE(accredited_seller_accreditation_date, CURDATE())
              WHERE accredited_seller_id = ?`,
            [groupId, reportsUnderUserId || null, accreditedSellerId]
          );
        } else {
          const [sellerResult] = await connection.query(
            `INSERT INTO accredited_sellers (
               user_id, seller_group_id, accredited_seller_reports_under_user_id,
               accredited_seller_accreditation_date, accredited_seller_status
             ) VALUES (?, ?, ?, CURDATE(), 'active')`,
            [userId, groupId, reportsUnderUserId || null]
          );
          accreditedSellerId = Number(sellerResult.insertId);
        }
      }

      userIdByEmail.set(row.email, userId);
      existingSellerIdByEmail.set(row.email, accreditedSellerId);
      await syncImportedManagedSellerLink(connection, accreditedSellerId, reportsUnderUserId || null);
      processed.push({
        row: row.sourceRow,
        email: row.email,
        user_id: userId,
        accredited_seller_id: accreditedSellerId,
        action: row.action,
      });
    }

    await assertSellerGroupRoleHierarchy(connection, groupId);
    await assertGroupCurrentPathsWithinPools(connection, groupId);
    for (const oldGroupId of oldGroupIds) {
      await assertSellerGroupRoleHierarchy(connection, oldGroupId);
      await assertGroupCurrentPathsWithinPools(connection, oldGroupId);
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Accredited Sellers',
      entityType: 'seller_network_member_import',
      entityId: String(groupId),
      entityLabel: lockedPreview.network.name,
      title: 'Imported In-House Network members',
      description: `Imported ${processed.length} member${processed.length === 1 ? '' : 's'} into ${lockedPreview.network.name}.`,
      metadata: {
        seller_group_id: groupId,
        total: lockedPreview.summary.total,
        created: lockedPreview.summary.create,
        updated: lockedPreview.summary.update,
        transferred: lockedPreview.summary.transfer,
        imported_emails: processed.slice(0, 100).map((item) => item.email),
      },
    });

    const workflow = await createOperationalReview(connection, {
      actor: req.authUser,
      actionKey: 'network.members.import',
      department: 'marketing',
      projectId: null,
      entityType: 'seller_group',
      entityId: groupId,
      entityLabel: lockedPreview.network.name,
      beforeSnapshot: {
        groupId,
        networkName: lockedPreview.network.name,
        memberCountBefore: Number(lockedContext.currentMembers?.length || 0),
      },
      afterSnapshot: {
        groupId,
        networkName: lockedPreview.network.name,
        importedCount: processed.length,
        summary: lockedPreview.summary,
        processed: processed.slice(0, 100),
      },
    });

    await connection.commit();
    transactionStarted = false;
    return res.status(201).json({
      success: true,
      message: `${processed.length} Network member${processed.length === 1 ? '' : 's'} imported successfully.`,
      data: {
        network: lockedPreview.network,
        summary: lockedPreview.summary,
        processed,
        review: workflow,
      },
    });
  } catch (error) {
    if (transactionStarted) await connection.rollback();
    return res.status(error.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

