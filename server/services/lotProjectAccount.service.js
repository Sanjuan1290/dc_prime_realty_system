import crypto from 'node:crypto';

import { columnExists, tableExists } from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const toMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const createAccountReference = (accountId, createdAt = new Date()) => {
  const year = new Date(createdAt).getFullYear();
  return `ACC-${year}-${String(Number(accountId || 0)).padStart(6, '0')}`;
};

export const getCurrentLotProjectAccount = async (connection, listingId, { forUpdate = false } = {}) => {
  if (!(await tableExists(connection, 'lot_project_accounts'))) return null;

  const [rows] = await connection.query(
    `
      SELECT account.*
      FROM lot_project_listings listing
      LEFT JOIN lot_project_accounts account
        ON account.lot_project_account_id = listing.current_account_id
      WHERE listing.lot_project_listing_id = ?
      LIMIT 1
      ${forUpdate ? 'FOR UPDATE' : ''}
    `,
    [listingId]
  );

  return rows[0]?.lot_project_account_id ? rows[0] : null;
};

export const createLotProjectAccount = async (
  connection,
  {
    projectId,
    listingId,
    clientProfileId,
    reservationHistoryId = null,
    buyerName,
    unitId,
    reservedAt = new Date(),
  }
) => {
  if (!(await tableExists(connection, 'lot_project_accounts'))) {
    return null;
  }

  const temporaryReference = `TMP-${crypto.randomUUID()}`;
  const [result] = await connection.query(
    `
      INSERT INTO lot_project_accounts (
        account_reference,
        lot_project_id,
        lot_project_listing_id,
        lot_project_client_profile_id,
        lot_project_reservation_history_id,
        buyer_name_snapshot,
        unit_id_snapshot,
        account_status,
        reservation_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
    `,
    [
      temporaryReference,
      projectId,
      listingId,
      clientProfileId,
      reservationHistoryId,
      buyerName || null,
      unitId,
      reservedAt,
    ]
  );

  const accountId = Number(result.insertId);
  const accountReference = createAccountReference(accountId, reservedAt);

  await connection.query(
    `UPDATE lot_project_accounts SET account_reference = ? WHERE lot_project_account_id = ?`,
    [accountReference, accountId]
  );

  if (await columnExists(connection, 'lot_project_listings', 'current_account_id')) {
    await connection.query(
      `UPDATE lot_project_listings SET current_account_id = ? WHERE lot_project_listing_id = ?`,
      [accountId, listingId]
    );
  }

  return { accountId, accountReference };
};

export const attachAccountToProfileRecords = async (
  connection,
  { accountId, clientProfileId, reservationHistoryId = null }
) => {
  if (!accountId || !clientProfileId) return;

  const targets = [
    ['lot_project_payments', 'lot_project_client_profile_id'],
    ['lot_project_payment_schedules', 'lot_project_client_profile_id'],
    ['lot_project_client_documents', 'lot_project_client_profile_id'],
    ['lot_project_commissions', 'lot_project_client_profile_id'],
    ['lot_project_commission_receipts', 'lot_project_client_profile_id'],
    ['lot_project_penalty_reliefs', 'lot_project_client_profile_id'],
    ['lot_project_soa_statements', 'lot_project_client_profile_id'],
  ];

  for (const [tableName, profileColumn] of targets) {
    if (
      (await tableExists(connection, tableName)) &&
      (await columnExists(connection, tableName, 'lot_project_account_id'))
    ) {
      await connection.query(
        `UPDATE ${tableName} SET lot_project_account_id = ? WHERE ${profileColumn} = ? AND lot_project_account_id IS NULL`,
        [accountId, clientProfileId]
      );
    }
  }

  if (
    reservationHistoryId &&
    (await tableExists(connection, 'lot_project_reservation_history')) &&
    (await columnExists(connection, 'lot_project_reservation_history', 'lot_project_account_id'))
  ) {
    await connection.query(
      `UPDATE lot_project_reservation_history SET lot_project_account_id = ? WHERE lot_project_reservation_history_id = ?`,
      [accountId, reservationHistoryId]
    );
  }
};

export const calculateCommissionableRetainedPercent = ({ retainedAmount, commissionBase }) => {
  const base = Number(commissionBase || 0);
  if (base <= 0) return 0;
  return Math.min(100, Math.max(0, toMoney((Number(retainedAmount || 0) / base) * 100)));
};

export const settleCancellationCommissionStages = async (
  connection,
  { listingId, clientProfileId, retainedAmount }
) => {
  if (
    !(await tableExists(connection, 'lot_project_commissions')) ||
    !(await tableExists(connection, 'lot_project_commission_releases'))
  ) {
    return { retainedPercent: 0, earnedStages: 0, forfeitedStages: 0 };
  }

  const [commissionRows] = await connection.query(
    `
      SELECT lot_project_commission_id, commission_base_amount
      FROM lot_project_commissions
      WHERE lot_project_listing_id = ?
        AND lot_project_client_profile_id = ?
      ORDER BY lot_project_commission_id
      FOR UPDATE
    `,
    [listingId, clientProfileId]
  );

  let retainedPercent = 0;
  let earnedStages = 0;
  let forfeitedStages = 0;

  for (const commission of commissionRows) {
    const rowPercent = calculateCommissionableRetainedPercent({
      retainedAmount,
      commissionBase: commission.commission_base_amount,
    });
    retainedPercent = Math.max(retainedPercent, rowPercent);

    const [releaseRows] = await connection.query(
      `
        SELECT lot_project_commission_release_id, release_trigger_percent, release_status, net_release_amount
        FROM lot_project_commission_releases
        WHERE lot_project_commission_id = ?
        ORDER BY lot_project_commission_release_id
        FOR UPDATE
      `,
      [commission.lot_project_commission_id]
    );

    for (const release of releaseRows) {
      if (release.release_status === 'Released') continue;

      const earned = rowPercent >= Number(release.release_trigger_percent || 0);
      const nextStatus = earned ? 'Earned on Cancellation' : 'Forfeited on Cancellation';
      if (earned) earnedStages += 1;
      else forfeitedStages += 1;

      const [releaseUpdate] = await connection.query(
        `
          UPDATE lot_project_commission_releases
          SET release_status = ?,
              scheduled_release_date = CASE WHEN ? = 'Earned on Cancellation' THEN scheduled_release_date ELSE NULL END,
              cancellation_earning_reason = ?,
              cancellation_settled_at = NOW(),
              updated_at = NOW()
          WHERE lot_project_commission_release_id = ?
            AND release_status = ?
        `,
        [
          nextStatus,
          nextStatus,
          earned
            ? `Retained commissionable payments reached ${Number(release.release_trigger_percent || 0)}%.`
            : `Retained commissionable payments ended at ${rowPercent}%, below the ${Number(release.release_trigger_percent || 0)}% trigger.`,
          release.lot_project_commission_release_id,
          release.release_status,
        ]
      );
      if (releaseUpdate.affectedRows !== 1) {
        throw Object.assign(new Error('Commission release changed while cancellation was being settled. Please retry.'), { statusCode: 409 });
      }
    }

    const [[summary]] = await connection.query(
      `
        SELECT
          COALESCE(SUM(CASE WHEN release_status = 'Released' THEN net_release_amount ELSE 0 END), 0) AS released_amount,
          COALESCE(SUM(CASE WHEN release_status = 'Earned on Cancellation' THEN net_release_amount ELSE 0 END), 0) AS earned_unreleased_amount,
          SUM(release_status = 'Earned on Cancellation') AS earned_count
        FROM lot_project_commission_releases
        WHERE lot_project_commission_id = ?
      `,
      [commission.lot_project_commission_id]
    );

    const releasedAmount = toMoney(summary?.released_amount);
    const earnedUnreleased = toMoney(summary?.earned_unreleased_amount);
    const status = releasedAmount > 0 || Number(summary?.earned_count || 0) > 0
      ? 'Partially Released'
      : 'Cancelled';

    await connection.query(
      `
        UPDATE lot_project_commissions
        SET released_commission_amount = ?,
            net_remaining_commission_amount = ?,
            payment_percent = ?,
            commission_status = ?,
            updated_at = NOW()
        WHERE lot_project_commission_id = ?
      `,
      [releasedAmount, earnedUnreleased, rowPercent, status, commission.lot_project_commission_id]
    );
  }

  return { retainedPercent, earnedStages, forfeitedStages };
};

export const closeCancelledAccountAndReleaseListing = async (
  connection,
  {
    projectId,
    listingId,
    closedByUserId = null,
  }
) => {
  const account = await getCurrentLotProjectAccount(connection, listingId, { forUpdate: true });
  if (!account) {
    const error = new Error('No current buyer account is linked to this listing.');
    error.statusCode = 400;
    throw error;
  }

  if (account.account_status !== 'cancelled') {
    const error = new Error('Complete cancellation settlement before returning the unit to Available.');
    error.statusCode = 400;
    throw error;
  }

  await connection.query(
    `
      UPDATE lot_project_accounts
      SET closed_at = COALESCE(closed_at, NOW()), updated_at = NOW()
      WHERE lot_project_account_id = ?
    `,
    [account.lot_project_account_id]
  );

  await connection.query(
    `
      UPDATE lot_project_client_profiles
      SET lot_project_client_profile_status = 'cancelled',
          lot_project_client_profile_updated_at = NOW()
      WHERE lot_project_client_profile_id = ?
    `,
    [account.lot_project_client_profile_id]
  );

  if (await tableExists(connection, 'lot_project_payment_schedules')) {
    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET schedule_status = CASE WHEN schedule_status = 'Paid' THEN 'Paid' ELSE 'Cancelled' END,
            updated_at = NOW()
        WHERE lot_project_client_profile_id = ?
      `,
      [account.lot_project_client_profile_id]
    );
  }

  await connection.query(
    `
      UPDATE lot_project_listings
      SET current_account_id = NULL,
          lot_project_listing_status = 'available',
          lot_project_listing_sold_substatus = NULL,
          lot_project_listing_cancellation_type = NULL,
          pending_buyer_form_submission_id = NULL,
          buyer_form_generation = buyer_form_generation + 1,
          lot_project_listing_updated_at = NOW()
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
    `,
    [projectId, listingId]
  );

  return {
    accountId: Number(account.lot_project_account_id),
    accountReference: account.account_reference,
    clientProfileId: Number(account.lot_project_client_profile_id),
    closedByUserId,
  };
};




const executeDeleteIfTableExists = async (connection, counts, tableName, sql, params = []) => {
  if (!(await tableExists(connection, tableName))) return;
  const [result] = await connection.query(sql, params);
  counts[tableName] = Number(result.affectedRows || 0);
};

/**
 * Permanently voids the current reservation without creating Buyer Account History.
 * This path is intentionally limited to accounts with no payment records, no
 * uploaded buyer files, and no released commission. The surrounding controller
 * transaction provides rollback protection for every database deletion.
 */
export const voidUnpaidLotProjectAccount = async (
  connection,
  {
    projectId,
    listingId,
  }
) => {
  const account = await getCurrentLotProjectAccount(connection, listingId, { forUpdate: true });
  if (!account) {
    throw Object.assign(new Error('No current buyer account is linked to this listing.'), { statusCode: 400 });
  }

  if (!['active', 'pending_cancellation'].includes(String(account.account_status || ''))) {
    throw Object.assign(
      new Error('Only an active or pending-cancellation buyer account can be voided without Account History.'),
      { statusCode: 409 }
    );
  }

  const accountId = Number(account.lot_project_account_id || 0);
  const profileId = Number(account.lot_project_client_profile_id || 0);

  if (await tableExists(connection, 'lot_project_payments')) {
    const hasPaymentAccountId = await columnExists(connection, 'lot_project_payments', 'lot_project_account_id');
    const paymentScope = hasPaymentAccountId && accountId
      ? { sql: 'lot_project_account_id = ?', value: accountId }
      : { sql: 'lot_project_client_profile_id = ?', value: profileId };
    const [[paymentSummary]] = await connection.query(
      `
        SELECT
          COUNT(*) AS payment_count,
          COALESCE(SUM(CASE WHEN lot_project_payment_status = 'Verified' THEN lot_project_payment_amount ELSE 0 END), 0) AS verified_total
        FROM lot_project_payments
        WHERE ${paymentScope.sql}
      `,
      [paymentScope.value]
    );

    if (Number(paymentSummary?.payment_count || 0) > 0 || Number(paymentSummary?.verified_total || 0) > 0) {
      throw Object.assign(
        new Error('This buyer account already has a payment record. Use the normal settlement option and keep it in Buyer Account History.'),
        { statusCode: 409 }
      );
    }
  }

  if (
    await tableExists(connection, 'lot_project_commission_releases') &&
    await tableExists(connection, 'lot_project_commissions')
  ) {
    const [[commissionSummary]] = await connection.query(
      `
        SELECT
          COUNT(CASE WHEN release_row.release_status = 'Released' THEN 1 END) AS released_count,
          COALESCE(SUM(CASE WHEN release_row.release_status = 'Released' THEN release_row.net_release_amount ELSE 0 END), 0) AS released_total
        FROM lot_project_commission_releases release_row
        INNER JOIN lot_project_commissions commission
          ON commission.lot_project_commission_id = release_row.lot_project_commission_id
        WHERE commission.lot_project_client_profile_id = ?
      `,
      [profileId]
    );

    if (Number(commissionSummary?.released_count || 0) > 0 || Number(commissionSummary?.released_total || 0) > 0) {
      throw Object.assign(
        new Error('Commission has already been released for this buyer account. Use the normal settlement option and keep Account History.'),
        { statusCode: 409 }
      );
    }
  }

  let uploadedFileCount = 0;
  if (await tableExists(connection, 'lot_project_client_document_files')) {
    const [[fileSummary]] = await connection.query(
      `
        SELECT COUNT(*) AS uploaded_file_count
        FROM lot_project_client_document_files
        WHERE lot_project_account_id = ?
          AND file_status <> 'removed'
      `,
      [accountId]
    );
    uploadedFileCount += Number(fileSummary?.uploaded_file_count || 0);
  }
  if (await tableExists(connection, 'lot_project_client_documents')) {
    const [[legacyFileSummary]] = await connection.query(
      `
        SELECT COUNT(*) AS uploaded_file_count
        FROM lot_project_client_documents
        WHERE lot_project_client_profile_id = ?
          AND NULLIF(TRIM(COALESCE(lot_project_client_document_file_url, '')), '') IS NOT NULL
      `,
      [profileId]
    );
    uploadedFileCount += Number(legacyFileSummary?.uploaded_file_count || 0);
  }

  if (uploadedFileCount > 0) {
    throw Object.assign(
      new Error('Uploaded buyer documents exist. Use the normal settlement option so the files remain in Buyer Account History.'),
      { statusCode: 409 }
    );
  }

  const counts = {};

  if (await tableExists(connection, 'lot_project_commission_receipt_items')) {
    await executeDeleteIfTableExists(
      connection,
      counts,
      'lot_project_commission_receipt_items',
      `DELETE item
       FROM lot_project_commission_receipt_items item
       INNER JOIN lot_project_commission_receipts receipt
         ON receipt.lot_project_commission_receipt_id = item.lot_project_commission_receipt_id
       WHERE receipt.lot_project_client_profile_id = ?`,
      [profileId]
    );
  }
  await executeDeleteIfTableExists(connection, counts, 'lot_project_commission_receipts', 'DELETE FROM lot_project_commission_receipts WHERE lot_project_client_profile_id = ?', [profileId]);
  if (await tableExists(connection, 'lot_project_commission_releases')) {
    await executeDeleteIfTableExists(
      connection,
      counts,
      'lot_project_commission_releases',
      `DELETE release_row
       FROM lot_project_commission_releases release_row
       INNER JOIN lot_project_commissions commission
         ON commission.lot_project_commission_id = release_row.lot_project_commission_id
       WHERE commission.lot_project_client_profile_id = ?`,
      [profileId]
    );
  }
  await executeDeleteIfTableExists(connection, counts, 'lot_project_commissions', 'DELETE FROM lot_project_commissions WHERE lot_project_client_profile_id = ?', [profileId]);

  await executeDeleteIfTableExists(connection, counts, 'lot_project_payment_proofs', 'DELETE FROM lot_project_payment_proofs WHERE lot_project_client_profile_id = ?', [profileId]);
  if (await tableExists(connection, 'lot_project_payment_allocations')) {
    await executeDeleteIfTableExists(
      connection,
      counts,
      'lot_project_payment_allocations',
      `DELETE allocation
       FROM lot_project_payment_allocations allocation
       LEFT JOIN lot_project_payments payment
         ON payment.lot_project_payment_id = allocation.lot_project_payment_id
       LEFT JOIN lot_project_payment_schedules schedule_row
         ON schedule_row.lot_project_payment_schedule_id = allocation.lot_project_payment_schedule_id
       WHERE payment.lot_project_client_profile_id = ?
          OR schedule_row.lot_project_client_profile_id = ?`,
      [profileId, profileId]
    );
  }
  if (await tableExists(connection, 'lot_project_payment_logs')) {
    await executeDeleteIfTableExists(
      connection,
      counts,
      'lot_project_payment_logs',
      `DELETE payment_log
       FROM lot_project_payment_logs payment_log
       INNER JOIN lot_project_payments payment
         ON payment.lot_project_payment_id = payment_log.lot_project_payment_id
       WHERE payment.lot_project_client_profile_id = ?`,
      [profileId]
    );
  }
  await executeDeleteIfTableExists(connection, counts, 'lot_project_penalty_reliefs', 'DELETE FROM lot_project_penalty_reliefs WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_notification_logs', 'DELETE FROM lot_project_notification_logs WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_document_notification_logs', 'DELETE FROM lot_project_document_notification_logs WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_soa_statements', 'DELETE FROM lot_project_soa_statements WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_contract_adjustments', 'DELETE FROM lot_project_contract_adjustments WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_payments', 'DELETE FROM lot_project_payments WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_payment_schedules', 'DELETE FROM lot_project_payment_schedules WHERE lot_project_client_profile_id = ?', [profileId]);

  await executeDeleteIfTableExists(connection, counts, 'lot_project_client_document_files', 'DELETE FROM lot_project_client_document_files WHERE lot_project_account_id = ?', [accountId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_client_documents', 'DELETE FROM lot_project_client_documents WHERE lot_project_client_profile_id = ?', [profileId]);

  // Submissions reference links, so remove them before their generated links.
  if ((await tableExists(connection, 'lot_project_buyer_form_submissions')) && (await columnExists(connection, 'lot_project_buyer_form_submissions', 'lot_project_account_id'))) {
    await executeDeleteIfTableExists(connection, counts, 'lot_project_buyer_form_submissions', 'DELETE FROM lot_project_buyer_form_submissions WHERE lot_project_account_id = ?', [accountId]);
  }
  if ((await tableExists(connection, 'lot_project_buyer_form_links')) && (await columnExists(connection, 'lot_project_buyer_form_links', 'lot_project_account_id'))) {
    await executeDeleteIfTableExists(connection, counts, 'lot_project_buyer_form_links', 'DELETE FROM lot_project_buyer_form_links WHERE lot_project_account_id = ?', [accountId]);
  }

  // Break the account-to-profile and account-to-history RESTRICT links after
  // all child records have been removed but before deleting history/profile rows.
  await connection.query(
    `UPDATE lot_project_accounts
     SET lot_project_client_profile_id = NULL,
         lot_project_reservation_history_id = NULL,
         updated_at = NOW()
     WHERE lot_project_account_id = ?`,
    [accountId]
  );

  if ((await tableExists(connection, 'lot_project_archived_commission_releases')) && (await columnExists(connection, 'lot_project_archived_commission_releases', 'lot_project_account_id'))) {
    await executeDeleteIfTableExists(connection, counts, 'lot_project_archived_commission_releases', 'DELETE FROM lot_project_archived_commission_releases WHERE lot_project_account_id = ?', [accountId]);
  }
  if ((await tableExists(connection, 'lot_project_cancelled_sale_archives')) && (await columnExists(connection, 'lot_project_cancelled_sale_archives', 'lot_project_account_id'))) {
    await executeDeleteIfTableExists(connection, counts, 'lot_project_cancelled_sale_archives', 'DELETE FROM lot_project_cancelled_sale_archives WHERE lot_project_account_id = ?', [accountId]);
  }
  if (await tableExists(connection, 'lot_project_reservation_history')) {
    const hasHistoryAccountId = await columnExists(connection, 'lot_project_reservation_history', 'lot_project_account_id');
    await executeDeleteIfTableExists(
      connection,
      counts,
      'lot_project_reservation_history',
      hasHistoryAccountId
        ? 'DELETE FROM lot_project_reservation_history WHERE lot_project_account_id = ?'
        : 'DELETE FROM lot_project_reservation_history WHERE lot_project_client_profile_id = ?',
      [hasHistoryAccountId ? accountId : profileId]
    );
  }

  // Remove the listing's current-account pointer before deleting the account.
  await connection.query(
    `
      UPDATE lot_project_listings
      SET current_account_id = NULL,
          lot_project_listing_status = 'available',
          lot_project_listing_sold_substatus = NULL,
          lot_project_listing_cancellation_type = NULL,
          pending_buyer_form_submission_id = NULL,
          buyer_form_generation = buyer_form_generation + 1,
          lot_project_listing_updated_at = NOW()
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND current_account_id = ?
    `,
    [projectId, listingId, accountId]
  );

  await executeDeleteIfTableExists(connection, counts, 'lot_project_client_profiles', 'DELETE FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ?', [profileId]);
  await executeDeleteIfTableExists(connection, counts, 'lot_project_accounts', 'DELETE FROM lot_project_accounts WHERE lot_project_account_id = ?', [accountId]);

  return {
    accountId,
    accountReference: account.account_reference,
    clientProfileId: profileId,
    deletedRowCounts: counts,
  };
};


