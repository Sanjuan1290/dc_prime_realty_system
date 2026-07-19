const supportedStatuses = new Set([
  'available',
  'hold',
  'sold',
  'pending_for_cancellation',
  'cancelled',
]);

const normalizeStatus = (value) => String(value || '').trim().toLowerCase();

const transitionError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

export const LISTING_STATUS_ACTIONS = Object.freeze({
  SETTLE_CANCELLATION: 'settle_cancellation',
  CANCEL_CANCELLATION: 'cancel_cancellation',
  RESET_TO_AVAILABLE: 'reset_to_available',
});

export const validateListingStatusTransition = ({
  currentStatus,
  nextStatus,
  action = '',
  confirmSaleDataDeletion = false,
} = {}) => {
  const current = normalizeStatus(currentStatus);
  const next = normalizeStatus(nextStatus);
  const transitionAction = normalizeStatus(action);

  if (!supportedStatuses.has(current) || !supportedStatuses.has(next)) {
    throw transitionError('Invalid listing status transition.');
  }

  if (current === next) {
    return { currentStatus: current, nextStatus: next, resetToAvailable: false };
  }

  // Edit Listing may only start the cancellation process for an existing sale.
  if (current === 'sold' && next === 'pending_for_cancellation') {
    return { currentStatus: current, nextStatus: next, resetToAvailable: false };
  }

  // Pending cancellation can only be completed through the Settlement button.
  if (
    current === 'pending_for_cancellation' &&
    next === 'cancelled' &&
    transitionAction === LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION
  ) {
    return { currentStatus: current, nextStatus: next, resetToAvailable: false };
  }

  // A mistaken or withdrawn cancellation request may be reversed without
  // removing any buyer, payment, document, SOA, or commission records.
  if (
    current === 'pending_for_cancellation' &&
    next === 'sold' &&
    transitionAction === LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION
  ) {
    return { currentStatus: current, nextStatus: next, resetToAvailable: false };
  }

  // Sale data may only be deleted after cancellation has been settled and the
  // dedicated Change to Available action sends an explicit confirmation flag.
  if (current === 'cancelled' && next === 'available') {
    if (
      transitionAction !== LISTING_STATUS_ACTIONS.RESET_TO_AVAILABLE ||
      confirmSaleDataDeletion !== true
    ) {
      throw transitionError(
        'Use the Change to Available button after Settlement and confirm the permanent removal of the previous sale data.'
      );
    }

    return { currentStatus: current, nextStatus: next, resetToAvailable: true };
  }

  if (current === 'sold' && next === 'available') {
    throw transitionError(
      'A sold listing cannot be changed directly to available. Change it to Pending for Cancellation, complete Settlement, then use Change to Available.'
    );
  }

  throw transitionError(
    `Listing status cannot be changed directly from ${current.replaceAll('_', ' ')} to ${next.replaceAll('_', ' ')}.`
  );
};

