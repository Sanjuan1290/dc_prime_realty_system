import {
  columnExists,
  getComputedSoaTerms,
  getExistingSoaScheduleRows,
  tableExists,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

import { calculateCommissionPaymentProgress } from '../utils/commissionProgress.js';

const toNumber = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

const clean = (value) => String(value ?? '').trim();

export { calculateCommissionPaymentProgress };

const getFreshCommissionContext = async (connection, listing = {}) => {
  const listingId = Number(listing.lot_project_listing_id || listing.listingId || 0);
  const requestedAccountId = Number(listing.lot_project_account_id || listing.accountId || 0);
  if (!listingId) return null;

  const accountJoin = requestedAccountId
    ? 'account.lot_project_account_id = ?'
    : 'account.lot_project_account_id = l.current_account_id';
  const [rows] = await connection.query(
    `
      SELECT
        l.*,
        account.lot_project_account_id,
        account.account_status,
        cp.*
      FROM lot_project_listings l
      INNER JOIN lot_project_accounts account
        ON ${accountJoin}
       AND account.lot_project_listing_id = l.lot_project_listing_id
       AND account.lot_project_id = l.lot_project_id
      INNER JOIN lot_project_client_profiles cp
        ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
      WHERE l.lot_project_listing_id = ?
      LIMIT 1
    `,
    requestedAccountId ? [requestedAccountId, listingId] : [listingId]
  );

  return rows[0] || null;
};

const getDocumentCompletion = async (connection, context = {}) => {
  const listingId = Number(context.lot_project_listing_id || 0);
  const clientProfileId = Number(context.lot_project_client_profile_id || 0);
  if (!listingId || !clientProfileId || !(await tableExists(connection, 'lot_project_listing_documents'))) {
    return { required: 0, completed: 0, complete: true };
  }

  const [requiredRows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM lot_project_listing_documents lpd
      WHERE lpd.lot_project_listing_id = ?
        AND lpd.lot_project_listing_document_status = 'active'
        AND lpd.lot_project_listing_document_is_required = 1
    `,
    [listingId]
  );
  const [completedRows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM lot_project_listing_documents lpd
      INNER JOIN lot_project_client_documents lcd
        ON lcd.lot_project_listing_id = lpd.lot_project_listing_id
       AND lcd.document_id = lpd.document_id
       AND lcd.lot_project_client_profile_id = ?
       AND lcd.lot_project_client_document_status IN ('Submitted', 'Approved')
      WHERE lpd.lot_project_listing_id = ?
        AND lpd.lot_project_listing_document_status = 'active'
        AND lpd.lot_project_listing_document_is_required = 1
    `,
    [clientProfileId, listingId]
  );

  const required = toNumber(requiredRows[0]?.total);
  const completed = toNumber(completedRows[0]?.total);
  return { required, completed, complete: required <= 0 || completed >= required };
};

/**
 * Synchronize stored commission payment progress immediately inside the same
 * transaction that changed the financial inputs. The Commissions page keeps its
 * own read-time synchronization as a fallback, but normal correctness no longer
 * depends on someone opening that page.
 */
export const syncCommissionProgressForListing = async (connection, listing = {}) => {
  if (!connection || !(await tableExists(connection, 'lot_project_commissions'))) {
    return { commissionCount: 0, paymentPercent: null };
  }

  const context = await getFreshCommissionContext(connection, listing);
  if (!context) return { commissionCount: 0, paymentPercent: null };

  const projectId = Number(context.lot_project_id || 0);
  const listingId = Number(context.lot_project_listing_id || 0);
  const clientProfileId = Number(context.lot_project_client_profile_id || 0);
  const accountId = Number(context.lot_project_account_id || 0);

  const schedules = await getExistingSoaScheduleRows(
    connection,
    projectId,
    listingId,
    clientProfileId,
    accountId
  );
  const terms = getComputedSoaTerms(context, schedules);

  const hasPaymentAccountId = await columnExists(connection, 'lot_project_payments', 'lot_project_account_id');
  const paymentAccountPredicate = hasPaymentAccountId && accountId
    ? 'AND lot_project_account_id = ?'
    : '';
  const paymentParams = [projectId, listingId, clientProfileId];
  if (paymentAccountPredicate) paymentParams.push(accountId);

  const [payments] = await connection.query(
    `
      SELECT
        lot_project_payment_amount,
        lot_project_payment_type,
        lot_project_payment_status,
        lot_project_payment_date
      FROM lot_project_payments
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND lot_project_client_profile_id = ?
        ${paymentAccountPredicate}
      ORDER BY lot_project_payment_date ASC, lot_project_payment_id ASC
    `,
    paymentParams
  );

  const progress = calculateCommissionPaymentProgress({
    terms,
    payments,
    forceFullyPaid: clean(context.lot_project_listing_sold_substatus).toLowerCase() === 'fully_paid',
  });

  const hasCommissionAccountId = await columnExists(connection, 'lot_project_commissions', 'lot_project_account_id');
  const commissionScope = hasCommissionAccountId && accountId
    ? `(lot_project_account_id = ? OR (lot_project_account_id IS NULL AND lot_project_client_profile_id = ?))`
    : 'lot_project_client_profile_id = ?';
  const commissionParams = hasCommissionAccountId && accountId
    ? [projectId, listingId, accountId, clientProfileId]
    : [projectId, listingId, clientProfileId];

  const [commissions] = await connection.query(
    `
      SELECT lot_project_commission_id
      FROM lot_project_commissions
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND ${commissionScope}
      ORDER BY lot_project_commission_id ASC
      FOR UPDATE
    `,
    commissionParams
  );

  if (!commissions.length) {
    return { commissionCount: 0, ...progress };
  }

  for (const commission of commissions) {
    await connection.query(
      `
        UPDATE lot_project_commissions
        SET payment_percent = ?
        WHERE lot_project_commission_id = ?
          AND ABS(COALESCE(payment_percent, 0) - ?) > 0.004
      `,
      [progress.paymentPercent, commission.lot_project_commission_id, progress.paymentPercent]
    );
  }

  if (await tableExists(connection, 'lot_project_commission_releases')) {
    const documents = await getDocumentCompletion(connection, context);
    const retentionReady = progress.paymentComplete && documents.complete;

    for (const commission of commissions) {
      await connection.query(
        `
          UPDATE lot_project_commission_releases
          SET release_status = CASE
            WHEN release_status IN ('Released', 'Cancelled', 'Earned on Cancellation', 'Forfeited on Cancellation') THEN release_status
            WHEN release_status = 'On Hold' THEN release_status
            WHEN release_stage = 'Retention' AND ? = 0 THEN 'On Hold'
            WHEN ? >= release_trigger_percent THEN 'Eligible'
            ELSE 'Pending'
          END
          WHERE lot_project_commission_id = ?
        `,
        [retentionReady ? 1 : 0, progress.paymentPercent, commission.lot_project_commission_id]
      );
    }
  }

  return {
    commissionCount: commissions.length,
    ...progress,
  };
};
