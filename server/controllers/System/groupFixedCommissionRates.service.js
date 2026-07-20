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

export const validateGroupFixedRateStructure = (
  input = {},
  { groupHeadRole = 'broker_network_manager', projectName = 'Project' } = {}
) => {
  const poolRate = normalizeRate(
    input.seller_group_pool_rate ?? input.poolRate,
    `${projectName} pool rate`
  );
  if (poolRate < 6 || poolRate > 15) {
    throw createValidationError(`${projectName} pool rate must be between 6% and 15%.`);
  }

  const bnmOverrideRate = normalizeRate(
    input.bnm_override_rate ?? input.bnmOverrideRate ?? 0,
    'BNM override rate'
  );
  const brokerOverrideRate = normalizeRate(
    input.broker_override_rate ?? input.brokerOverrideRate ?? 0,
    'Broker override rate'
  );
  const managerOverrideRate = normalizeRate(
    input.manager_override_rate ?? input.managerOverrideRate ?? 0,
    'Manager override rate'
  );
  const agentRate = normalizeRate(
    input.agent_rate ?? input.agentRate ?? 0,
    'Agent sales rate'
  );

  if (brokerOverrideRate <= 0) {
    throw createValidationError('Broker override rate must be greater than 0%.');
  }
  if (managerOverrideRate <= 0) {
    throw createValidationError('Manager override rate must be greater than 0%.');
  }
  if (agentRate <= 0) {
    throw createValidationError('Agent sales rate must be greater than 0%.');
  }

  if (groupHeadRole === 'broker') {
    if (bnmOverrideRate !== 0) {
      throw createValidationError('BNM override must be 0% when the Realty head is a Broker.');
    }
  } else if (bnmOverrideRate <= 0) {
    throw createValidationError('BNM override rate must be greater than 0%.');
  }

  const allocatedRate = roundRate(
    bnmOverrideRate + brokerOverrideRate + managerOverrideRate + agentRate
  );
  const difference = roundRate(poolRate - allocatedRate);

  if (Math.abs(difference) > 0.0001) {
    const direction = difference > 0 ? 'under' : 'over';
    throw createValidationError(
      `${projectName} fixed rates total ${allocatedRate.toFixed(2)}%, which is ${Math.abs(difference).toFixed(2)}% ${direction} the ${poolRate.toFixed(2)}% pool.`
    );
  }

  return {
    seller_group_pool_rate: poolRate,
    bnm_override_rate: bnmOverrideRate,
    broker_override_rate: brokerOverrideRate,
    manager_override_rate: managerOverrideRate,
    agent_rate: agentRate,
    allocated_rate: allocatedRate,
    remaining_rate: difference,
  };
};

export const getGroupFixedRateForRole = (role, rates = {}) => {
  const roleRates = {
    broker_network_manager: rates.bnm_override_rate ?? rates.bnmOverrideRate,
    broker: rates.broker_override_rate ?? rates.brokerOverrideRate,
    manager: rates.manager_override_rate ?? rates.managerOverrideRate,
    agent: rates.agent_rate ?? rates.agentRate,
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
        rate.bnm_override_rate,
        rate.broker_override_rate,
        rate.manager_override_rate,
        rate.agent_rate,
        rate.seller_group_lot_project_rate_status,
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

  const validated = validateGroupFixedRateStructure(row, {
    groupHeadRole: row.group_head_role || 'broker_network_manager',
    projectName: 'Group project',
  });

  return {
    sellerGroupId: Number(row.seller_group_id),
    lotProjectId: Number(row.lot_project_id),
    groupHeadRole: row.group_head_role || null,
    poolRate: validated.seller_group_pool_rate,
    bnmOverrideRate: validated.bnm_override_rate,
    brokerOverrideRate: validated.broker_override_rate,
    managerOverrideRate: validated.manager_override_rate,
    agentRate: validated.agent_rate,
    allocatedRate: validated.allocated_rate,
    status: row.seller_group_lot_project_rate_status,
  };
};

export const summarizeGroupFixedRates = (rates = {}) => ({
  poolRate: roundRate(rates.seller_group_pool_rate ?? rates.poolRate),
  bnmOverrideRate: roundRate(rates.bnm_override_rate ?? rates.bnmOverrideRate),
  brokerOverrideRate: roundRate(rates.broker_override_rate ?? rates.brokerOverrideRate),
  managerOverrideRate: roundRate(rates.manager_override_rate ?? rates.managerOverrideRate),
  agentRate: roundRate(rates.agent_rate ?? rates.agentRate),
  allocatedRate: roundRate(
    Number(rates.bnm_override_rate ?? rates.bnmOverrideRate ?? 0)
      + Number(rates.broker_override_rate ?? rates.brokerOverrideRate ?? 0)
      + Number(rates.manager_override_rate ?? rates.managerOverrideRate ?? 0)
      + Number(rates.agent_rate ?? rates.agentRate ?? 0)
  ),
});
