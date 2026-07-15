import { tableExists } from '../_shared/lotProject.shared.js';

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

const loadSellerById = async (connection, accreditedSellerId) => {
  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id,
        acs.user_id,
        acs.seller_group_id,
        acs.accredited_seller_reports_under_user_id,
        acs.accredited_seller_status,
        u.role,
        u.status AS user_status,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS full_name
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      WHERE acs.accredited_seller_id = ?
      LIMIT 1
    `,
    [accreditedSellerId]
  );

  return rows[0] || null;
};

const loadSellerByUserId = async (connection, userId) => {
  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id,
        acs.user_id,
        acs.seller_group_id,
        acs.accredited_seller_reports_under_user_id,
        acs.accredited_seller_status,
        u.role,
        u.status AS user_status,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS full_name
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
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
 * Loads the current reporting chain. This intentionally reads the live seller
 * hierarchy instead of the hierarchy that existed when the unit was reserved.
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

  if (headSeller && !seen.has(Number(headSeller.accredited_seller_id))) {
    chain.push(headSeller);
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

/**
 * Pure distribution calculation used by both the API and unit tests.
 * Rates in the database represent each seller's ceiling. The amount earned by
 * each level is the difference between its ceiling and the lower level.
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
 * Replaces every commission row for one unit using the currently configured
 * seller hierarchy. Callers must check release locks before using this for an
 * existing sale.
 */
export const replaceReservationCommissions = async (
  connection,
  projectId,
  listing,
  clientProfileId,
  assignedSellerId,
  saleChannel,
  {
    paymentPercent = 0,
    releaseStateByStage = {},
    commissionStatus = 'Pending',
  } = {}
) => {
  if (!(await tableExists(connection, 'lot_project_commissions'))) return [];
  if (!(await tableExists(connection, 'accredited_sellers'))) return [];

  const baseAmount = roundCommissionMoney(
    listing.lot_project_listing_net_selling_price ||
      listing.lot_project_listing_tcp ||
      0
  );

  if (baseAmount <= 0) {
    throw new Error('The listing does not have a valid commission base amount.');
  }

  const chain = await loadCurrentSellerChain(connection, assignedSellerId);
  if (!chain.length) {
    throw new Error('Assigned seller hierarchy could not be loaded.');
  }

  const sellerIds = chain.map((seller) => Number(seller.accredited_seller_id));
  const rateMap = await loadSellerRateMap(connection, projectId, sellerIds);
  const assignedSeller = chain[0];
  const fallbackRate = Number(
    rateMap.get(Number(assignedSeller.accredited_seller_id)) || 0
  );
  const groupPoolRate = await loadGroupPoolRate(
    connection,
    projectId,
    assignedSeller.seller_group_id,
    fallbackRate
  );

  const commissionRows = buildCommissionDistribution({
    chain,
    rateMap,
    groupPoolRate,
    saleChannel,
  });

  await connection.query(
    `DELETE FROM lot_project_commissions WHERE lot_project_listing_id = ?`,
    [listing.lot_project_listing_id]
  );

  const insertedRows = [];

  for (const item of commissionRows) {
    const gross = roundCommissionMoney(
      baseAmount * (Number(item.rate || 0) / 100)
    );

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_commissions (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          accredited_seller_id,
          commission_role,
          commission_seller_type,
          commission_sale_type,
          commission_base_amount,
          commission_rate,
          gross_commission_amount,
          released_commission_amount,
          net_remaining_commission_amount,
          payment_percent,
          commission_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
      `,
      [
        projectId,
        listing.lot_project_listing_id,
        clientProfileId,
        item.seller.accredited_seller_id,
        item.seller.role,
        item.sellerType,
        item.saleType,
        baseAmount,
        item.rate,
        gross,
        gross,
        Number(paymentPercent || 0),
        commissionStatus,
      ]
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
      grossCommission: gross,
      sellerType: item.sellerType,
      saleType: item.saleType,
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

