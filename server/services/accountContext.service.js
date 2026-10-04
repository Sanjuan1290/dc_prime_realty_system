const clean = (value = '') => String(value ?? '').trim().toLowerCase();
const toId = (value) => Number(value || 0) || null;

const pick = (source = {}, keys = [], fallback = null) => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') return source[key];
  }
  return fallback;
};

/**
 * Canonical buyer-account context.
 *
 * These concepts intentionally stay separate:
 * - historical entry: the account was deliberately encoded as a backdated/historical client;
 * - account history: the account is no longer the listing's current buyer account;
 * - cancelled: a business status, not a synonym for either of the above.
 */
export const buildAccountContext = ({ account = {}, listing = {}, readOnly = false } = {}) => {
  const accountId = toId(pick(account, ['lot_project_account_id', 'accountId', 'id']));
  const currentAccountId = toId(
    pick(listing, ['current_account_id', 'currentAccountId'], pick(account, ['current_account_id', 'currentAccountId']))
  );
  const accountStatus = clean(pick(account, ['account_status', 'accountStatus', 'status'], ''));
  const listingStatus = clean(pick(listing, ['lot_project_listing_status', 'rawStatus', 'listing_status', 'status'], ''));
  const soldSubstatus = clean(pick(listing, ['lot_project_listing_sold_substatus', 'soldSubstatus'], ''));
  const historicalFlag = Number(
    pick(account, ['soa_is_historical_entry', 'isHistoricalEntry'], pick(listing, ['soa_is_historical_entry', 'isHistoricalEntry'], 0)) || 0
  ) === 1;

  const isCurrentAccount = Boolean(accountId && currentAccountId && accountId === currentAccountId);
  const isAccountHistory = Boolean(accountId && currentAccountId && accountId !== currentAccountId) || Boolean(readOnly);
  const isCancelled = accountStatus === 'cancelled';
  const isPendingCancellation = accountStatus === 'pending_cancellation' || listingStatus === 'pending_for_cancellation';
  const isFullyPaid = accountStatus === 'closed_fully_paid' || soldSubstatus === 'fully_paid';

  return {
    accountId,
    currentAccountId,
    accountStatus,
    listingStatus,
    isCurrentAccount,
    isHistoricalEntry: historicalFlag,
    isAccountHistory,
    isCancelled,
    isPendingCancellation,
    isFullyPaid,
    isReadOnly: Boolean(readOnly || isAccountHistory),
  };
};

export default buildAccountContext;
