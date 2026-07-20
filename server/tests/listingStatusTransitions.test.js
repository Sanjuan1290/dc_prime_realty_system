import test from 'node:test';
import assert from 'node:assert/strict';
import {
  LISTING_STATUS_ACTIONS,
  validateListingStatusTransition,
} from '../controllers/Lot_Projects/Listings/listingStatusTransitions.js';

test('editing listing details may keep the current status', () => {
  const result = validateListingStatusTransition({ currentStatus: 'sold', nextStatus: 'sold' });
  assert.equal(result.resetToAvailable, false);
});

test('sold may move only to pending for cancellation through Edit Listing', () => {
  const result = validateListingStatusTransition({
    currentStatus: 'sold',
    nextStatus: 'pending_for_cancellation',
  });
  assert.equal(result.nextStatus, 'pending_for_cancellation');
  assert.equal(result.resetToAvailable, false);
});

test('sold cannot move directly to available', () => {
  assert.throws(
    () => validateListingStatusTransition({ currentStatus: 'sold', nextStatus: 'available' }),
    /cannot be changed directly to available/i
  );
});

test('pending cancellation cannot become cancelled without the Settlement action', () => {
  assert.throws(
    () => validateListingStatusTransition({
      currentStatus: 'pending_for_cancellation',
      nextStatus: 'cancelled',
    }),
    /cannot be changed directly/i
  );
});

test('Settlement may change pending cancellation to cancelled', () => {
  const result = validateListingStatusTransition({
    currentStatus: 'pending_for_cancellation',
    nextStatus: 'cancelled',
    action: LISTING_STATUS_ACTIONS.SETTLE_CANCELLATION,
  });
  assert.equal(result.nextStatus, 'cancelled');
  assert.equal(result.resetToAvailable, false);
});

test('Cancel Cancellation may return pending cancellation to sold active', () => {
  const result = validateListingStatusTransition({
    currentStatus: 'pending_for_cancellation',
    nextStatus: 'sold',
    action: LISTING_STATUS_ACTIONS.CANCEL_CANCELLATION,
  });
  assert.equal(result.nextStatus, 'sold');
  assert.equal(result.resetToAvailable, false);
});

test('pending cancellation cannot return to sold without the Cancel Cancellation action', () => {
  assert.throws(
    () => validateListingStatusTransition({
      currentStatus: 'pending_for_cancellation',
      nextStatus: 'sold',
    }),
    /cannot be changed directly/i
  );
});

test('cancelled cannot reset without the dedicated action and deletion confirmation', () => {
  assert.throws(
    () => validateListingStatusTransition({
      currentStatus: 'cancelled',
      nextStatus: 'available',
      action: LISTING_STATUS_ACTIONS.RESET_TO_AVAILABLE,
    }),
    /Change to Available button/i
  );
});

test('Change to Available may reset a settled cancellation only with explicit confirmation', () => {
  const result = validateListingStatusTransition({
    currentStatus: 'cancelled',
    nextStatus: 'available',
    action: LISTING_STATUS_ACTIONS.RESET_TO_AVAILABLE,
    confirmSaleDataDeletion: true,
  });
  assert.equal(result.resetToAvailable, true);
});

test('available, hold, pending, and cancelled operational transitions are blocked in generic edit', () => {
  const transitions = [
    ['available', 'hold'],
    ['available', 'sold'],
    ['hold', 'available'],
    ['hold', 'sold'],
    ['pending_for_cancellation', 'available'],
    ['cancelled', 'sold'],
  ];

  for (const [currentStatus, nextStatus] of transitions) {
    assert.throws(
      () => validateListingStatusTransition({ currentStatus, nextStatus }),
      /cannot be changed directly/i,
      `${currentStatus} -> ${nextStatus}`
    );
  }
});
