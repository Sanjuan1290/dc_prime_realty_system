const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const roundRate = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeRate = (value, label) => {
  const rate = Number(value);
  if (!Number.isFinite(rate) || rate < 0 || rate > 15) {
    throw createValidationError(`${label} must be between 0% and 15%.`);
  }
  return roundRate(rate);
};

export const normalizeSellerGroupType = (value) =>
  String(value || '').trim().toLowerCase() === 'external' ? 'external' : 'in_house';

export const validateGroupFixedRateStructure = (
  input = {},
  {
    groupHeadRole = 'division_manager',
    projectName = 'Project',
    groupType = input.seller_group_type || input.groupType || 'in_house',
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
    const positionValues = [
      input.division_manager_rate ?? input.divisionManagerRate ?? 0,
      input.sales_director_rate ?? input.salesDirectorRate ?? 0,
      input.unit_manager_rate ?? input.unitManagerRate ?? 0,
      input.sales_agent_rate ?? input.salesAgentRate ?? 0,
    ].map(Number);

    if (positionValues.some((rate) => Number.isFinite(rate) && Math.abs(rate) > 0.0001)) {
      throw createValidationError(
        'External Groups use the full Pool Rate. In-house position rates must be 0%.'
      );
    }

    return {
      seller_group_type: normalizedGroupType,
      seller_group_pool_rate: poolRate,
      division_manager_rate: 0,
      sales_director_rate: 0,
      unit_manager_rate: 0,
      sales_agent_rate: 0,
      allocated_rate: poolRate,
      remaining_rate: 0,
    };
  }

  const divisionManagerRate = normalizeRate(
    input.division_manager_rate ?? input.divisionManagerRate ?? 0,
    'Division Manager rate'
  );
  const salesDirectorRate = normalizeRate(
    input.sales_director_rate ?? input.salesDirectorRate ?? 0,
    'Sales Director rate'
  );
  const unitManagerRate = normalizeRate(
    input.unit_manager_rate ?? input.unitManagerRate ?? 0,
    'Unit Manager rate'
  );
  const salesAgentRate = normalizeRate(
    input.sales_agent_rate ?? input.salesAgentRate ?? 0,
    'Sales Agent rate'
  );

  if (salesDirectorRate <= 0) {
    throw createValidationError('Sales Director rate must be greater than 0%.');
  }
  if (unitManagerRate <= 0) {
    throw createValidationError('Unit Manager rate must be greater than 0%.');
  }
  if (salesAgentRate <= 0) {
    throw createValidationError('Sales Agent rate must be greater than 0%.');
  }

  if (groupHeadRole === 'sales_director') {
    if (divisionManagerRate !== 0) {
      throw createValidationError('Division Manager rate must be 0% when the group head is a Sales Director.');
    }
  } else if (divisionManagerRate <= 0) {
    throw createValidationError('Division Manager rate must be greater than 0%.');
  }

  const allocatedRate = roundRate(
    divisionManagerRate + salesDirectorRate + unitManagerRate + salesAgentRate
  );
  const difference = roundRate(poolRate - allocatedRate);

  if (Math.abs(difference) > 0.0001) {
    const direction = difference > 0 ? 'under' : 'over';
    throw createValidationError(
      `${projectName} fixed rates total ${allocatedRate.toFixed(2)}%, which is ${Math.abs(difference).toFixed(2)}% ${direction} the ${poolRate.toFixed(2)}% pool.`
    );
  }

  return {
    seller_group_type: normalizedGroupType,
    seller_group_pool_rate: poolRate,
    division_manager_rate: divisionManagerRate,
    sales_director_rate: salesDirectorRate,
    unit_manager_rate: unitManagerRate,
    sales_agent_rate: salesAgentRate,
    allocated_rate: allocatedRate,
    remaining_rate: difference,
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
  return roundRate(roleRates[String(role || '')] || 0);
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
  const validated = validateGroupFixedRateStructure(row, {
    groupHeadRole: row.group_head_role || 'division_manager',
    projectName: 'Group project',
    groupType,
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
    divisionManagerRate: validated.division_manager_rate,
    salesDirectorRate: validated.sales_director_rate,
    unitManagerRate: validated.unit_manager_rate,
    salesAgentRate: validated.sales_agent_rate,
    allocatedRate: validated.allocated_rate,
    status: row.seller_group_lot_project_rate_status,
  };
};

export const summarizeGroupFixedRates = (rates = {}) => {
  const groupType = normalizeSellerGroupType(rates.seller_group_type ?? rates.groupType);
  const poolRate = roundRate(rates.seller_group_pool_rate ?? rates.poolRate);
  const divisionManagerRate = roundRate(rates.division_manager_rate ?? rates.divisionManagerRate);
  const salesDirectorRate = roundRate(rates.sales_director_rate ?? rates.salesDirectorRate);
  const unitManagerRate = roundRate(rates.unit_manager_rate ?? rates.unitManagerRate);
  const salesAgentRate = roundRate(rates.sales_agent_rate ?? rates.salesAgentRate);

  return {
    groupType,
    poolRate,
    divisionManagerRate,
    salesDirectorRate,
    unitManagerRate,
    salesAgentRate,
    allocatedRate: groupType === 'external'
      ? poolRate
      : roundRate(divisionManagerRate + salesDirectorRate + unitManagerRate + salesAgentRate),
  };
};
