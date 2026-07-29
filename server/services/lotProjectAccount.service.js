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

      await connection.query(
        `
          UPDATE lot_project_commission_releases
          SET release_status = ?,
              scheduled_release_date = CASE WHEN ? = 'Earned on Cancellation' THEN scheduled_release_date ELSE NULL END,
              cancellation_earning_reason = ?,
              cancellation_settled_at = NOW(),
              updated_at = NOW()
          WHERE lot_project_commission_release_id = ?
        `,
        [
          nextStatus,
          nextStatus,
          earned
            ? `Retained commissionable payments reached ${Number(release.release_trigger_percent || 0)}%.`
            : `Retained commissionable payments ended at ${rowPercent}%, below the ${Number(release.release_trigger_percent || 0)}% trigger.`,
          release.lot_project_commission_release_id,
        ]
      );
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
