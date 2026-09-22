const RATE_EPSILON = 0.0001;

const roundRate = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const finiteRate = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? roundRate(parsed) : Number.NaN;
};

const validationError = (message) => Object.assign(new Error(message), { statusCode: 400 });

export const normalizeUnitCommissionAdjustment = ({
  groupRate,
  rates = [],
  currentRows = [],
  minimumGroupRate = 6,
  maximumGroupRate = 15,
} = {}) => {
  const normalizedGroupRate = finiteRate(groupRate);
  if (!Number.isFinite(normalizedGroupRate)) throw validationError('Unit Group Rate is required.');
  if (normalizedGroupRate < minimumGroupRate || normalizedGroupRate > maximumGroupRate) {
    throw validationError(`Unit Group Rate must be between ${minimumGroupRate}% and ${maximumGroupRate}%.`);
  }

  const savedRows = Array.isArray(currentRows) ? currentRows : [];
  if (!savedRows.length) {
    throw validationError('This reservation does not have a saved commission distribution to adjust.');
  }

  const requestedRates = Array.isArray(rates) ? rates : [];
  if (requestedRates.length !== savedRows.length) {
    throw validationError('Every saved commission recipient must have exactly one adjusted rate.');
  }

  const currentById = new Map();
  for (const row of savedRows) {
    const commissionId = Number(row?.commissionId ?? row?.lot_project_commission_id ?? 0);
    if (!commissionId) throw validationError('A saved commission row is missing its commission id.');
    currentById.set(commissionId, row);
  }

  const seen = new Set();
  const normalizedRates = requestedRates.map((entry) => {
    const commissionId = Number(entry?.commissionId ?? entry?.lot_project_commission_id ?? 0);
    const current = currentById.get(commissionId);
    if (!current || seen.has(commissionId)) {
      throw validationError('The adjusted commission recipients do not match the saved reservation snapshot.');
    }
    seen.add(commissionId);

    const rate = finiteRate(entry?.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw validationError(`${current.roleLabel || current.commission_role || current.role || 'Each commission role'} rate must be greater than 0%.`);
    }
    if (rate > normalizedGroupRate + RATE_EPSILON) {
      throw validationError(`${current.roleLabel || current.commission_role || current.role || 'A commission role'} rate cannot be greater than the ${normalizedGroupRate.toFixed(2)}% Unit Group Rate.`);
    }

    return {
      commissionId,
      role: current.commission_role || current.role || '',
      rate,
    };
  });

  if (seen.size !== currentById.size) {
    throw validationError('Every saved commission recipient must remain in the adjusted distribution.');
  }

  const allocatedRate = roundRate(normalizedRates.reduce((sum, row) => sum + row.rate, 0));
  const unallocatedRate = roundRate(normalizedGroupRate - allocatedRate);

  if (Math.abs(unallocatedRate) > RATE_EPSILON) {
    if (unallocatedRate > 0) {
      throw validationError(
        `Allocated commission is ${allocatedRate.toFixed(2)}%. Allocate the remaining ${unallocatedRate.toFixed(2)}% before saving.`
      );
    }
    throw validationError(
      `Allocated commission is ${allocatedRate.toFixed(2)}%, which exceeds the ${normalizedGroupRate.toFixed(2)}% Unit Group Rate by ${Math.abs(unallocatedRate).toFixed(2)}%.`
    );
  }

  return {
    groupRate: normalizedGroupRate,
    allocatedRate,
    unallocatedRate: 0,
    rates: normalizedRates.sort((left, right) => left.commissionId - right.commissionId),
  };
};

export const buildUnitCommissionAdjustmentPayload = ({
  listingId,
  accountId,
  clientProfileId,
  groupRate,
  rates = [],
  reason,
  userId,
} = {}) => ({
  listingId: Number(listingId || 0),
  accountId: Number(accountId || 0),
  clientProfileId: Number(clientProfileId || 0),
  groupRate: roundRate(groupRate),
  rates: [...(Array.isArray(rates) ? rates : [])]
    .map((row) => ({ commissionId: Number(row.commissionId || 0), rate: roundRate(row.rate) }))
    .sort((left, right) => left.commissionId - right.commissionId),
  reason: String(reason || '').trim(),
  userId: Number(userId || 0),
});

export const UNIT_COMMISSION_RATE_EPSILON = RATE_EPSILON;
