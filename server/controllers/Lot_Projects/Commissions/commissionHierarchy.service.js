import { columnExists, tableExists } from '../_shared/lotProject.shared.js';
import { validateSellerReportingChain } from '../../System/sellerHierarchyRules.js';

/**
 * Commission release stages are shared by reservation creation and manual
 * hierarchy recalculation so both workflows always generate identical rows.
 */
export const COMMISSION_RELEASE_STAGES = Object.freeze([
  { stage: '1st Release', trigger: 20, percent: 20 },
  { stage: '2nd Release', trigger: 40, percent: 20 },
  { stage: '3rd Release', trigger: 60, percent: 20 },
  { stage: '4th Release', trigger: 75, percent: 15 },
  { stage: 'Retention', trigger: 100, percent: 25 },
]);

export const roundCommissionMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const sellerSelectSql = ({ hasDummyColumns = false } = {}) => `
  SELECT
    acs.accredited_seller_id,
    acs.user_id,
    acs.seller_group_id,
    acs.accredited_seller_reports_under_user_id,
    acs.accredited_seller_status,
    ${hasDummyColumns ? 'acs.is_system_dummy' : '0'} AS is_system_dummy,
    ${hasDummyColumns ? 'acs.dummy_owner_accredited_seller_id' : 'NULL'} AS dummy_owner_accredited_seller_id,
    u.role,
    u.status AS user_status,
    TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS full_name,
    owner_user.role AS owner_role,
    TRIM(CONCAT_WS(' ', owner_user.first_name, owner_user.middle_name, owner_user.last_name)) AS owner_name,
    sg.seller_group_name
  FROM accredited_sellers acs
  INNER JOIN users u ON u.id = acs.user_id
  LEFT JOIN accredited_sellers owner_acs
    ON owner_acs.accredited_seller_id = ${hasDummyColumns ? 'acs.dummy_owner_accredited_seller_id' : 'NULL'}
  LEFT JOIN users owner_user ON owner_user.id = owner_acs.user_id
  LEFT JOIN seller_groups sg ON sg.seller_group_id = acs.seller_group_id
`;

const loadSellerById = async (connection, accreditedSellerId) => {
  const hasDummyColumns = await columnExists(connection, 'accredited_sellers', 'is_system_dummy');
  const [rows] = await connection.query(
    `${sellerSelectSql({ hasDummyColumns })}
      WHERE acs.accredited_seller_id = ?
      LIMIT 1
    `,
    [accreditedSellerId]
  );

  return rows[0] || null;
};

const loadSellerByUserId = async (connection, userId) => {
  const hasDummyColumns = await columnExists(connection, 'accredited_sellers', 'is_system_dummy');
  const [rows] = await connection.query(
    `${sellerSelectSql({ hasDummyColumns })}
      WHERE acs.user_id = ?
      LIMIT 1
    `,
    [userId]
  );

  return rows[0] || null;
};

const loadGroupHeadSeller = async (connection, sellerGroupId) => {
  if (!sellerGroupId || !(await tableExists(connection, 'seller_groups'))) return null;

  const [rows] = await connection.query(
    `
      SELECT seller_group_head_user_id
      FROM seller_groups
      WHERE seller_group_id = ?
        AND seller_group_status = 'active'
      LIMIT 1
    `,
    [sellerGroupId]
  );

  const headUserId = rows[0]?.seller_group_head_user_id;
  if (!headUserId) return null;

  const headSeller = await loadSellerByUserId(connection, headUserId);
  if (!headSeller) return null;
  if (headSeller.accredited_seller_status !== 'active' || headSeller.user_status !== 'active') return null;

  return { ...headSeller, is_group_head: true };
};

/**
 * Loads the current reporting chain. The first entry is always the assigned
 * agent. Parent sellers follow in reporting order and the group head is added
 * when they are not already part of the explicit reporting chain.
 */
export const loadCurrentSellerChain = async (connection, accreditedSellerId) => {
  const chain = [];
  const seen = new Set();
  let current = await loadSellerById(connection, accreditedSellerId);
  let terminalSeller = null;

  while (current && !seen.has(Number(current.accredited_seller_id))) {
    seen.add(Number(current.accredited_seller_id));
    chain.push(current);
    terminalSeller = current;

    if (!current.accredited_seller_reports_under_user_id) break;
    current = await loadSellerByUserId(connection, current.accredited_seller_reports_under_user_id);
  }

  const headSeller = await loadGroupHeadSeller(
    connection,
    terminalSeller?.seller_group_id || chain[0]?.seller_group_id
  );

  if (headSeller) {
    const existingHeadIndex = chain.findIndex(
      (seller) => Number(seller.accredited_seller_id) === Number(headSeller.accredited_seller_id)
    );

    if (existingHeadIndex >= 0) {
      chain[existingHeadIndex] = { ...chain[existingHeadIndex], is_group_head: true };
    } else {
      chain.push(headSeller);
    }
  }

  return chain;
};

const loadSellerRateMap = async (connection, lotProjectId, sellerIds = []) => {
  if (!sellerIds.length || !(await tableExists(connection, 'accredited_seller_lot_project_rates'))) {
    return new Map();
  }

  const [rows] = await connection.query(
    `
      SELECT accredited_seller_id, accredited_seller_project_rate
      FROM accredited_seller_lot_project_rates
      WHERE lot_project_id = ?
        AND accredited_seller_lot_project_rate_status = 'active'
        AND accredited_seller_id IN (${sellerIds.map(() => '?').join(',')})
    `,
    [lotProjectId, ...sellerIds]
  );

  return new Map(
    rows.map((row) => [
      Number(row.accredited_seller_id),
      Number(row.accredited_seller_project_rate || 0),
    ])
  );
};

const loadGroupPoolRate = async (
  connection,
  lotProjectId,
  sellerGroupId,
  fallbackRate = 0
) => {
  if (!sellerGroupId || !(await tableExists(connection, 'seller_group_lot_project_rates'))) {
    return fallbackRate;
  }

  const [rows] = await connection.query(
    `
      SELECT seller_group_pool_rate
      FROM seller_group_lot_project_rates
      WHERE seller_group_id = ?
        AND lot_project_id = ?
        AND seller_group_lot_project_rate_status = 'active'
      LIMIT 1
    `,
    [sellerGroupId, lotProjectId]
  );

  return Number(rows[0]?.seller_group_pool_rate || fallbackRate || 0);
};

const overrideKey = (childId, parentId) => `${Number(childId)}:${Number(parentId)}`;

const loadAgentDirectRate = async (connection, lotProjectId, agentId, legacyRateMap) => {
  if (await tableExists(connection, 'agent_lot_project_direct_rates')) {
    const [rows] = await connection.query(
      `
        SELECT direct_rate
        FROM agent_lot_project_direct_rates
        WHERE accredited_seller_id = ?
          AND lot_project_id = ?
          AND direct_rate_status = 'active'
        LIMIT 1
      `,
      [agentId, lotProjectId]
    );

    return Number(rows[0]?.direct_rate || 0);
  }

  return Number(legacyRateMap.get(Number(agentId)) || 0);
};

const loadOverrideRateMap = async (
  connection,
  lotProjectId,
  chain,
  legacyRateMap,
  groupPoolRate
) => {
  const rateMap = new Map();

  if (await tableExists(connection, 'seller_hierarchy_lot_project_overrides')) {
    const sellerIds = chain.map((seller) => Number(seller.accredited_seller_id));
    if (!sellerIds.length) return rateMap;

    const [rows] = await connection.query(
      `
        SELECT
          child_accredited_seller_id,
          parent_accredited_seller_id,
          override_rate
        FROM seller_hierarchy_lot_project_overrides
        WHERE lot_project_id = ?
          AND override_rate_status = 'active'
          AND child_accredited_seller_id IN (${sellerIds.map(() => '?').join(',')})
          AND parent_accredited_seller_id IN (${sellerIds.map(() => '?').join(',')})
      `,
      [lotProjectId, ...sellerIds, ...sellerIds]
    );

    rows.forEach((row) => {
      rateMap.set(
        overrideKey(row.child_accredited_seller_id, row.parent_accredited_seller_id),
        Number(row.override_rate || 0)
      );
    });

    return rateMap;
  }

  // Legacy fallback: old seller rates were cumulative ceilings. Convert each
  // parent-child edge to an incremental override without changing old data.
  for (let index = 1; index < chain.length; index += 1) {
    const child = chain[index - 1];
    const parent = chain[index];
    const childCeiling = Number(legacyRateMap.get(Number(child.accredited_seller_id)) || 0);
    const parentCeiling = parent.role === 'broker_network_manager'
      ? Number(groupPoolRate || legacyRateMap.get(Number(parent.accredited_seller_id)) || 0)
      : Number(legacyRateMap.get(Number(parent.accredited_seller_id)) || 0);

    rateMap.set(
      overrideKey(child.accredited_seller_id, parent.accredited_seller_id),
      Math.max(roundCommissionMoney(parentCeiling - childCeiling), 0)
    );
  }

  return rateMap;
};

/**
 * Legacy pure calculation retained for old records and regression tests.
 * Existing seller rates are cumulative ceilings, so each seller receives the
 * difference between their ceiling and the seller below them.
 */
export const buildCommissionDistribution = ({
  chain = [],
  rateMap = new Map(),
  groupPoolRate = 0,
  saleChannel = 'distributed',
} = {}) => {
  const commissionChain = chain.filter(
    (seller) =>
      !seller.is_group_head ||
      Number(rateMap.get(Number(seller.accredited_seller_id)) || 0) > 0
  );

  if (!commissionChain.length) {
    throw new Error('Assigned seller hierarchy could not be loaded.');
  }

  const assignedSeller = commissionChain[0];
  const ceilingRate = (seller) => {
    if (seller.role === 'broker_network_manager') {
      return Number(groupPoolRate || rateMap.get(Number(seller.accredited_seller_id)) || 0);
    }

    return Number(rateMap.get(Number(seller.accredited_seller_id)) || 0);
  };

  if (saleChannel === 'direct_to_developer') {
    const rate = ceilingRate(assignedSeller) || Number(groupPoolRate || 0);
    if (rate <= 0) {
      throw new Error('The assigned seller does not have an active project commission rate.');
    }

    return [{
      seller: assignedSeller,
      rate: roundCommissionMoney(rate),
      sellerType: 'main_seller',
      saleType: 'direct',
    }];
  }

  const commissionRows = [];
  let lowerCeiling = 0;

  for (const seller of commissionChain) {
    const currentCeiling = ceilingRate(seller);

    if (currentCeiling < lowerCeiling) {
      throw new Error(
        `${seller.full_name || 'Parent seller'} rate (${currentCeiling}%) cannot be lower than the seller below them (${lowerCeiling}%). Fix seller rates before recalculating.`
      );
    }

    const earnedRate = roundCommissionMoney(currentCeiling - lowerCeiling);
    if (earnedRate > 0) {
      commissionRows.push({
        seller,
        rate: earnedRate,
        sellerType:
          Number(seller.accredited_seller_id) === Number(assignedSeller.accredited_seller_id)
            ? seller.role === 'agent'
              ? 'selling_agent'
              : 'main_seller'
            : 'hierarchy_seller',
        saleType: 'distributed',
      });
    }

    lowerCeiling = currentCeiling;
  }

  if (groupPoolRate && lowerCeiling > Number(groupPoolRate)) {
    throw new Error(
      `Generated commission rate (${lowerCeiling}%) is higher than the group pool rate (${groupPoolRate}%).`
    );
  }

  if (!commissionRows.length) {
    throw new Error('The current seller hierarchy does not produce any commission.');
  }

  return commissionRows;
};

/**
 * Role-based commission model. Agents receive a sales commission rate. Every parent receives
 * an explicit override for the relationship to the seller directly below them.
 */
export const buildDirectOverrideDistribution = ({
  chain = [],
  directRate = 0,
  overrideRateMap = new Map(),
  groupPoolRate = 0,
  includeZeroRates = true,
  requireGroupHead = false,
} = {}) => {
  validateSellerReportingChain(chain, { requireGroupHead });

  const normalizedDirectRate = roundCommissionMoney(directRate);
  if (normalizedDirectRate <= 0) {
    throw new Error('The assigned sales agent does not have an active sales commission rate for this project.');
  }

  const rows = [{
    seller: chain[0],
    childSeller: null,
    rate: normalizedDirectRate,
    rateType: 'direct',
    sellerType: 'selling_agent',
    saleType: 'distributed',
  }];

  for (let index = 1; index < chain.length; index += 1) {
    const childSeller = chain[index - 1];
    const parentSeller = chain[index];
    const rate = roundCommissionMoney(
      overrideRateMap.get(overrideKey(childSeller.accredited_seller_id, parentSeller.accredited_seller_id)) || 0
    );

    if (rate > 0 || includeZeroRates) {
      rows.push({
        seller: parentSeller,
        childSeller,
        rate,
        rateType: 'override',
        sellerType: 'hierarchy_seller',
        saleType: 'distributed',
      });
    }
  }

  const allocatedRate = roundCommissionMoney(rows.reduce((sum, row) => sum + Number(row.rate || 0), 0));
  if (groupPoolRate > 0 && allocatedRate > Number(groupPoolRate) + 0.0001) {
    throw new Error(
      `Commission allocation (${allocatedRate}%) exceeds the group project pool (${Number(groupPoolRate)}%).`
    );
  }

  return rows;
};

/**
 * Loads the same hierarchy and rates used by reservation saving. The client
 * preview therefore cannot drift from the commission rows created later.
 */
export const getReservationCommissionPreview = async (
  connection,
  projectId,
  listing,
  assignedSellerId
) => {
  const baseAmount = roundCommissionMoney(
    listing?.lot_project_listing_net_selling_price ||
      listing?.lot_project_listing_tcp ||
      listing?.commissionBase ||
      0
  );

  if (baseAmount <= 0) throw new Error('The listing does not have a valid commission base amount.');

  const chain = await loadCurrentSellerChain(connection, assignedSellerId);
  if (!chain.length) throw new Error('Assigned seller hierarchy could not be loaded.');

  const assignedSeller = chain[0];
  if (
    assignedSeller.role !== 'agent' ||
    assignedSeller.accredited_seller_status !== 'active' ||
    assignedSeller.user_status !== 'active'
  ) {
    throw new Error('Only active sales agents can be assigned to a reservation.');
  }

  const sellerIds = chain.map((seller) => Number(seller.accredited_seller_id));
  const legacyRateMap = await loadSellerRateMap(connection, projectId, sellerIds);
  const directRate = await loadAgentDirectRate(
    connection,
    projectId,
    assignedSeller.accredited_seller_id,
    legacyRateMap
  );
  const groupPoolRate = await loadGroupPoolRate(
    connection,
    projectId,
    assignedSeller.seller_group_id,
    directRate
  );
  const overrideRateMap = await loadOverrideRateMap(
    connection,
    projectId,
    chain,
    legacyRateMap,
    groupPoolRate
  );

  const hierarchyRows = buildDirectOverrideDistribution({
    chain,
    directRate,
    overrideRateMap,
    groupPoolRate,
    includeZeroRates: true,
    requireGroupHead: true,
  });

  const allocatedRate = roundCommissionMoney(
    hierarchyRows.reduce((sum, row) => sum + Number(row.rate || 0), 0)
  );
  const normalizedPoolRate = Number(groupPoolRate || 0);
  const unallocatedRate = roundCommissionMoney(Math.max(normalizedPoolRate - allocatedRate, 0));
  const allocationDifference = roundCommissionMoney(Math.abs(normalizedPoolRate - allocatedRate));
  const allocationWarnings = hierarchyRows
    .filter((row) => row.rateType === 'override' && Number(row.rate || 0) <= 0)
    .map((row) => `${row.seller.full_name || 'Parent seller'} has no active override for this reporting relationship.`);

  if (normalizedPoolRate > 0 && allocationDifference > 0.0001) {
    allocationWarnings.push(
      allocatedRate < normalizedPoolRate
        ? `${unallocatedRate.toFixed(2)}% of the group pool is still unallocated.`
        : `The hierarchy exceeds the group pool by ${roundCommissionMoney(allocatedRate - normalizedPoolRate).toFixed(2)}%.`
    );
  }

  return {
    commissionBase: baseAmount,
    poolRate: normalizedPoolRate,
    allocatedRate,
    unallocatedRate,
    estimatedTotal: roundCommissionMoney(baseAmount * (allocatedRate / 100)),
    isValid: allocatedRate > 0 && (!normalizedPoolRate || allocationDifference <= 0.0001),
    warnings: allocationWarnings,
    assignedSeller,
    hierarchy: hierarchyRows.map((row, index) => {
      const isDummy = Number(row.seller.is_system_dummy || 0) === 1;
      const displayName = isDummy && row.seller.owner_name
        ? `${row.seller.owner_name} — Direct Sales Agent`
        : row.seller.full_name || 'Unnamed seller';

      return {
        order: index + 1,
        accreditedSellerId: Number(row.seller.accredited_seller_id),
        sellerName: displayName,
        role: row.seller.role,
        commissionType: row.rateType,
        rate: Number(row.rate || 0),
        estimatedAmount: roundCommissionMoney(baseAmount * (Number(row.rate || 0) / 100)),
        childSellerId: row.childSeller ? Number(row.childSeller.accredited_seller_id) : null,
        childSellerName: row.childSeller?.full_name || null,
        isSystemDummy: isDummy,
        beneficiaryName: isDummy ? row.seller.owner_name || null : null,
        groupName: row.seller.seller_group_name || assignedSeller.seller_group_name || '-',
      };
    }),
    rows: hierarchyRows,
  };
};

const normalizePreservedReleaseState = (stage, paymentPercent, releaseStateByStage = {}) => {
  const preserved = releaseStateByStage?.[stage.stage] || null;
  const allowedPreservedStatuses = new Set(['Pending', 'Eligible', 'On Hold', 'Cancelled']);

  if (preserved && allowedPreservedStatuses.has(preserved.status)) {
    return {
      status: preserved.status,
      scheduledReleaseDate: preserved.scheduledReleaseDate || null,
    };
  }

  const status =
    stage.stage === 'Retention'
      ? 'On Hold'
      : Number(paymentPercent || 0) >= stage.trigger
        ? 'Eligible'
        : 'Pending';

  return { status, scheduledReleaseDate: null };
};

const insertCommissionReleaseRows = async (
  connection,
  commissionId,
  grossCommission,
  {
    paymentPercent = 0,
    releaseStateByStage = {},
  } = {}
) => {
  if (!(await tableExists(connection, 'lot_project_commission_releases'))) return;

  await connection.query(
    `DELETE FROM lot_project_commission_releases WHERE lot_project_commission_id = ?`,
    [commissionId]
  );

  await connection.query(
    `
      INSERT INTO lot_project_commission_releases (
        lot_project_commission_id,
        release_stage,
        release_trigger_percent,
        release_percent,
        gross_release_amount,
        deduction_amount,
        net_release_amount,
        release_status,
        scheduled_release_date
      ) VALUES ${COMMISSION_RELEASE_STAGES.map(() => '(?, ?, ?, ?, ?, 0, ?, ?, ?)').join(', ')}
    `,
    COMMISSION_RELEASE_STAGES.flatMap((stage) => {
      const gross = roundCommissionMoney(grossCommission * (stage.percent / 100));
      const preserved = normalizePreservedReleaseState(
        stage,
        paymentPercent,
        releaseStateByStage
      );

      return [
        commissionId,
        stage.stage,
        stage.trigger,
        stage.percent,
        gross,
        gross,
        preserved.status,
        preserved.scheduledReleaseDate,
      ];
    })
  );
};

/**
 * Replaces every commission row for one unit using the current direct-agent
 * rate and relationship overrides. Historical released rows remain protected
 * by the caller's recalculation lock.
 */
export const replaceReservationCommissions = async (
  connection,
  projectId,
  listing,
  clientProfileId,
  assignedSellerId,
  _saleChannel = 'distributed',
  {
    paymentPercent = 0,
    releaseStateByStage = {},
    commissionStatus = 'Pending',
  } = {}
) => {
  if (!(await tableExists(connection, 'lot_project_commissions'))) return [];
  if (!(await tableExists(connection, 'accredited_sellers'))) return [];

  const preview = await getReservationCommissionPreview(
    connection,
    projectId,
    listing,
    assignedSellerId
  );
  const commissionRows = preview.rows.filter((row) => Number(row.rate || 0) > 0);

  await connection.query(
    `DELETE FROM lot_project_commissions WHERE lot_project_listing_id = ?`,
    [listing.lot_project_listing_id]
  );

  const hasRateType = await columnExists(connection, 'lot_project_commissions', 'commission_rate_type');
  const hasSaleOrigin = await columnExists(connection, 'lot_project_commissions', 'sale_origin_accredited_seller_id');
  const hasSaleOwner = await columnExists(connection, 'lot_project_commissions', 'sale_owner_accredited_seller_id');
  const hasSellerSnapshot = await columnExists(connection, 'lot_project_commissions', 'seller_display_name_snapshot');
  const hasGroupSnapshot = await columnExists(connection, 'lot_project_commissions', 'seller_group_name_snapshot');

  const insertedRows = [];
  const assignedSeller = preview.assignedSeller;
  const saleOwnerId = Number(assignedSeller.dummy_owner_accredited_seller_id || assignedSeller.accredited_seller_id);

  for (const item of commissionRows) {
    const gross = roundCommissionMoney(
      preview.commissionBase * (Number(item.rate || 0) / 100)
    );

    const columns = [
      'lot_project_id',
      'lot_project_listing_id',
      'lot_project_client_profile_id',
      'accredited_seller_id',
      'commission_role',
      'commission_seller_type',
      'commission_sale_type',
    ];
    const values = [
      projectId,
      listing.lot_project_listing_id,
      clientProfileId,
      item.seller.accredited_seller_id,
      item.seller.role,
      item.sellerType,
      'distributed',
    ];

    if (hasRateType) {
      columns.push('commission_rate_type');
      values.push(item.rateType);
    }
    if (hasSaleOrigin) {
      columns.push('sale_origin_accredited_seller_id');
      values.push(assignedSeller.accredited_seller_id);
    }
    if (hasSaleOwner) {
      columns.push('sale_owner_accredited_seller_id');
      values.push(saleOwnerId);
    }
    if (hasSellerSnapshot) {
      columns.push('seller_display_name_snapshot');
      values.push(item.seller.full_name || null);
    }
    if (hasGroupSnapshot) {
      columns.push('seller_group_name_snapshot');
      values.push(item.seller.seller_group_name || assignedSeller.seller_group_name || null);
    }

    columns.push(
      'commission_base_amount',
      'commission_rate',
      'gross_commission_amount',
      'released_commission_amount',
      'net_remaining_commission_amount',
      'payment_percent',
      'commission_status'
    );
    values.push(
      preview.commissionBase,
      item.rate,
      gross,
      0,
      gross,
      Number(paymentPercent || 0),
      commissionStatus
    );

    const [result] = await connection.query(
      `INSERT INTO lot_project_commissions (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`,
      values
    );

    await insertCommissionReleaseRows(connection, result.insertId, gross, {
      paymentPercent,
      releaseStateByStage,
    });

    insertedRows.push({
      commissionId: result.insertId,
      accreditedSellerId: Number(item.seller.accredited_seller_id),
      sellerName: item.seller.full_name || '-',
      role: item.seller.role,
      rate: Number(item.rate || 0),
      rateType: item.rateType,
      grossCommission: gross,
      sellerType: item.sellerType,
      saleType: 'distributed',
    });
  }

  return insertedRows;
};

/**
 * Returns true when recalculation would modify a commission that already has
 * release evidence. Receipt rows are included because they are proof that a
 * release was prepared or issued even if another status was changed manually.
 */
export const hasReleasedCommissionActivity = ({
  releasedAmount = 0,
  releasedCommissionCount = 0,
  releasedStageCount = 0,
  receiptCount = 0,
} = {}) =>
  Number(releasedAmount || 0) > 0 ||
  Number(releasedCommissionCount || 0) > 0 ||
  Number(releasedStageCount || 0) > 0 ||
  Number(receiptCount || 0) > 0;

