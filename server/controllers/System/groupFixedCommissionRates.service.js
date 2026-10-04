const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const RATE_FACTOR = 10000;
export const roundCommissionRate = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * RATE_FACTOR) / RATE_FACTOR;

const normalizeRate = (value, label, { min = 0, max = 15 } = {}) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < min || rate > max) {
    throw createValidationError(`${label} must be between ${min}% and ${max}%.`);
  }
  return roundCommissionRate(rate);
};

export const DEFAULT_IN_HOUSE_POOL_SHARES = Object.freeze({
  division_manager: 14.18,
  sales_director: 15.82,
  unit_manager: 20,
  sales_agent: 50,
});

export const normalizeInHousePoolShares = (input = {}) => {
  const shares = {
    division_manager: normalizeRate(
      input.division_manager ?? input.divisionManager ?? input.inHouseDmPoolSharePercent ?? DEFAULT_IN_HOUSE_POOL_SHARES.division_manager,
      'Division Manager pool share',
      { max: 100 }
    ),
    sales_director: normalizeRate(
      input.sales_director ?? input.salesDirector ?? input.inHouseSdPoolSharePercent ?? DEFAULT_IN_HOUSE_POOL_SHARES.sales_director,
      'Sales Director pool share',
      { max: 100 }
    ),
    unit_manager: normalizeRate(
      input.unit_manager ?? input.unitManager ?? input.inHouseUmPoolSharePercent ?? DEFAULT_IN_HOUSE_POOL_SHARES.unit_manager,
      'Unit Manager pool share',
      { max: 100 }
    ),
    sales_agent: normalizeRate(
      input.sales_agent ?? input.salesAgent ?? input.inHouseSaPoolSharePercent ?? DEFAULT_IN_HOUSE_POOL_SHARES.sales_agent,
      'Sales Agent pool share',
      { max: 100 }
    ),
  };

  const total = roundCommissionRate(Object.values(shares).reduce((sum, value) => sum + value, 0));
  if (Math.abs(total - 100) > 0.0001) {
    throw createValidationError(`In-House pool distribution percentages must total exactly 100%. Current total is ${total.toFixed(4)}%.`);
  }
  return shares;
};

export const loadInHousePoolShares = async (connection) => {
  try {
    const [rows] = await connection.query(
      `SELECT
         in_house_dm_pool_share_percent,
         in_house_sd_pool_share_percent,
         in_house_um_pool_share_percent,
         in_house_sa_pool_share_percent
       FROM system_settings
       WHERE system_setting_id = 1
       LIMIT 1`
    );
    const row = rows[0] || {};
    return normalizeInHousePoolShares({
      division_manager: row.in_house_dm_pool_share_percent,
      sales_director: row.in_house_sd_pool_share_percent,
      unit_manager: row.in_house_um_pool_share_percent,
      sales_agent: row.in_house_sa_pool_share_percent,
    });
  } catch (error) {
    // Backward-compatible fallback while the new migration is being deployed.
    if (error?.code === 'ER_BAD_FIELD_ERROR' || error?.code === 'ER_NO_SUCH_TABLE') {
      return { ...DEFAULT_IN_HOUSE_POOL_SHARES };
    }
    throw error;
  }
};

export const normalizeSellerGroupType = (value) =>
  String(value || '').trim().toLowerCase() === 'external' ? 'external' : 'in_house';

export const calculateInHousePoolAllocation = ({
  poolRate,
  companyProfitRate = 0,
  poolShares = DEFAULT_IN_HOUSE_POOL_SHARES,
  projectName = 'Project',
} = {}) => {
  const normalizedPoolRate = normalizeRate(poolRate, `${projectName} pool rate`);
  if (normalizedPoolRate < 6 || normalizedPoolRate > 15) {
    throw createValidationError(`${projectName} pool rate must be between 6% and 15%.`);
  }

  const normalizedCompanyProfitRate = normalizeRate(companyProfitRate, `${projectName} Company Profit rate`);
  if (normalizedCompanyProfitRate >= normalizedPoolRate) {
    throw createValidationError(`${projectName} Company Profit must be lower than the ${normalizedPoolRate.toFixed(4)}% Pool Rate.`);
  }

  const normalizedShares = normalizeInHousePoolShares(poolShares);
  const distributionPoolRate = roundCommissionRate(normalizedPoolRate - normalizedCompanyProfitRate);
  const divisionManagerRate = roundCommissionRate(distributionPoolRate * (normalizedShares.division_manager / 100));
  const salesDirectorRate = roundCommissionRate(distributionPoolRate * (normalizedShares.sales_director / 100));
  const unitManagerRate = roundCommissionRate(distributionPoolRate * (normalizedShares.unit_manager / 100));
  // Put any 0.0001 rounding residual on the Sales Agent so the distributed rates always total the used pool exactly.
  const salesAgentRate = roundCommissionRate(
    distributionPoolRate - divisionManagerRate - salesDirectorRate - unitManagerRate
  );
  const allocatedRate = roundCommissionRate(
    divisionManagerRate + salesDirectorRate + unitManagerRate + salesAgentRate
  );
  const totalAccountedRate = roundCommissionRate(allocatedRate + normalizedCompanyProfitRate);
  const remainingRate = roundCommissionRate(normalizedPoolRate - totalAccountedRate);

  if (Math.abs(remainingRate) > 0.0001) {
    throw createValidationError(`${projectName} commission allocation does not fully account for the Pool Rate.`);
  }

  return {
    seller_group_pool_rate: normalizedPoolRate,
    company_profit_rate: normalizedCompanyProfitRate,
    distribution_pool_rate: distributionPoolRate,
    division_manager_pool_share_percent: normalizedShares.division_manager,
    sales_director_pool_share_percent: normalizedShares.sales_director,
    unit_manager_pool_share_percent: normalizedShares.unit_manager,
    sales_agent_pool_share_percent: normalizedShares.sales_agent,
    division_manager_rate: divisionManagerRate,
    sales_director_rate: salesDirectorRate,
    unit_manager_rate: unitManagerRate,
    sales_agent_rate: salesAgentRate,
    allocated_rate: allocatedRate,
    total_accounted_rate: totalAccountedRate,
    remaining_rate: remainingRate,
  };
};

export const validateGroupFixedRateStructure = (
  input = {},
  {
    projectName = 'Project',
    groupType = input.seller_group_type || input.groupType || 'in_house',
    poolShares = DEFAULT_IN_HOUSE_POOL_SHARES,
  } = {}
) => {
  const normalizedGroupType = normalizeSellerGroupType(groupType);
  const poolRate = normalizeRate(
    input.seller_group_pool_rate ?? input.poolRate,
    `${projectName} pool rate`
  );
  if (poolRate < 6 || poolRate > 15) {
    throw createValidationError(`${projectName} pool rate must be between 6% and 15%.`);
  }

  if (normalizedGroupType === 'external') {
    return {
      seller_group_type: normalizedGroupType,
      seller_group_pool_rate: poolRate,
      company_profit_rate: 0,
      distribution_pool_rate: poolRate,
      division_manager_pool_share_percent: 0,
      sales_director_pool_share_percent: 0,
      unit_manager_pool_share_percent: 0,
      sales_agent_pool_share_percent: 0,
      division_manager_rate: 0,
      sales_director_rate: 0,
      unit_manager_rate: 0,
      sales_agent_rate: 0,
      allocated_rate: poolRate,
      total_accounted_rate: poolRate,
      remaining_rate: 0,
    };
  }

  return {
    seller_group_type: normalizedGroupType,
    ...calculateInHousePoolAllocation({
      poolRate,
      companyProfitRate: input.company_profit_rate ?? input.companyProfitRate ?? 0,
      poolShares,
      projectName,
    }),
  };
};

export const getGroupFixedRateForRole = (role, rates = {}) => {
  const roleRates = {
    division_manager: rates.division_manager_rate ?? rates.divisionManagerRate,
    sales_director: rates.sales_director_rate ?? rates.salesDirectorRate,
    unit_manager: rates.unit_manager_rate ?? rates.unitManagerRate,
    sales_agent: rates.sales_agent_rate ?? rates.salesAgentRate,
    external_group: rates.seller_group_pool_rate ?? rates.poolRate,
  };
  return roundCommissionRate(roleRates[String(role || '')] || 0);
};

export const getPoolShareForRole = (role, shares = {}) => {
  const normalized = normalizeInHousePoolShares(shares);
  return roundCommissionRate(normalized[String(role || '')] || 0);
};

export const loadGroupFixedCommissionRates = async (
  connection,
  sellerGroupId,
  lotProjectId
) => {
  const [rows] = await connection.query(
    `
      SELECT
        rate.seller_group_id,
        rate.lot_project_id,
        rate.seller_group_pool_rate,
        rate.company_profit_rate,
        rate.division_manager_rate,
        rate.sales_director_rate,
        rate.unit_manager_rate,
        rate.sales_agent_rate,
        rate.seller_group_lot_project_rate_status,
        group_row.seller_group_type,
        group_row.seller_group_external_account_user_id,
        head_user.role AS group_head_role
      FROM seller_group_lot_project_rates rate
      INNER JOIN seller_groups group_row
        ON group_row.seller_group_id = rate.seller_group_id
       AND group_row.seller_group_status = 'active'
      LEFT JOIN users head_user
        ON head_user.id = group_row.seller_group_head_user_id
      WHERE rate.seller_group_id = ?
        AND rate.lot_project_id = ?
        AND rate.seller_group_lot_project_rate_status = 'active'
      LIMIT 1
    `,
    [sellerGroupId, lotProjectId]
  );

  const row = rows[0];
  if (!row) return null;

  const groupType = normalizeSellerGroupType(row.seller_group_type);
  const poolShares = groupType === 'in_house'
    ? await loadInHousePoolShares(connection)
    : { division_manager: 0, sales_director: 0, unit_manager: 0, sales_agent: 0 };
  const validated = validateGroupFixedRateStructure(row, {
    projectName: 'Network project',
    groupType,
    poolShares,
  });

  return {
    sellerGroupId: Number(row.seller_group_id),
    lotProjectId: Number(row.lot_project_id),
    groupType,
    externalAccountUserId: row.seller_group_external_account_user_id
      ? Number(row.seller_group_external_account_user_id)
      : null,
    groupHeadRole: row.group_head_role || null,
    poolRate: validated.seller_group_pool_rate,
    companyProfitRate: validated.company_profit_rate,
    distributionPoolRate: validated.distribution_pool_rate,
    poolShares,
    divisionManagerRate: validated.division_manager_rate,
    salesDirectorRate: validated.sales_director_rate,
    unitManagerRate: validated.unit_manager_rate,
    salesAgentRate: validated.sales_agent_rate,
    allocatedRate: validated.allocated_rate,
    totalAccountedRate: validated.total_accounted_rate,
    status: row.seller_group_lot_project_rate_status,
  };
};

export const summarizeGroupFixedRates = (rates = {}, { poolShares = DEFAULT_IN_HOUSE_POOL_SHARES } = {}) => {
  const groupType = normalizeSellerGroupType(rates.seller_group_type ?? rates.groupType);
  return validateGroupFixedRateStructure(rates, {
    groupType,
    poolShares,
    projectName: 'Network project',
  });
};
