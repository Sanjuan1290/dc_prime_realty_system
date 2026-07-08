import { db } from '../db/connect.js';
import {
  applyPaymentToSchedules,
  columnExists,
  recomputeListingScheduleBalances,
  tableExists,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';

const resetListingSchedules = async (connection, listing) => {
  const resetColumns = [
    'amount_paid = 0',
    'date_paid = NULL',
    'reference_id = NULL',
    "schedule_status = 'Unpaid'",
  ];

  if (await columnExists(connection, 'lot_project_payment_schedules', 'paid_penalty_amount')) {
    resetColumns.push('paid_penalty_amount = 0');
  }
  if (await columnExists(connection, 'lot_project_payment_schedules', 'paid_interest_amount')) {
    resetColumns.push('paid_interest_amount = 0');
  }
  if (await columnExists(connection, 'lot_project_payment_schedules', 'paid_principal_amount')) {
    resetColumns.push('paid_principal_amount = 0');
  }

  await connection.query(
    `
      UPDATE lot_project_payment_schedules
      SET ${resetColumns.join(', ')}
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
    `,
    [listing.lot_project_id, listing.lot_project_listing_id]
  );
};

const getVerifiedPayments = async (connection, listing) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payments
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND lot_project_payment_status = 'Verified'
      ORDER BY lot_project_payment_date ASC, lot_project_payment_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id]
  );

  return rows;
};

const run = async () => {
  const connection = await db.getConnection();

  try {
    if (!(await tableExists(connection, 'lot_project_payment_schedules'))) {
      throw new Error('lot_project_payment_schedules table does not exist.');
    }
    if (!(await tableExists(connection, 'lot_project_payment_allocations'))) {
      throw new Error('lot_project_payment_allocations table does not exist.');
    }
    if (!(await tableExists(connection, 'lot_project_payments'))) {
      throw new Error('lot_project_payments table does not exist.');
    }

    await connection.beginTransaction();

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET due_date = NULL
        WHERE LOWER(description) LIKE '%legal%'
           OR LOWER(description) LIKE '%misc%'
           OR LOWER(description) LIKE '%lmf%'
      `
    );

    const [listings] = await connection.query(
      `
        SELECT l.*, cp.*
        FROM lot_project_listings l
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id
      `
    );

    for (const listing of listings) {
      await connection.query(
        `
          DELETE pa
          FROM lot_project_payment_allocations pa
          INNER JOIN lot_project_payments p
            ON p.lot_project_payment_id = pa.lot_project_payment_id
          WHERE p.lot_project_id = ?
            AND p.lot_project_listing_id = ?
        `,
        [listing.lot_project_id, listing.lot_project_listing_id]
      );

      await resetListingSchedules(connection, listing);

      const payments = await getVerifiedPayments(connection, listing);
      for (const payment of payments) {
        await applyPaymentToSchedules(
          connection,
          listing,
          payment.lot_project_payment_id,
          payment.lot_project_payment_schedule_id,
          payment.lot_project_payment_amount,
          payment.lot_project_payment_date,
          payment.lot_project_payment_reference_id,
          payment.lot_project_payment_type
        );
      }

      await recomputeListingScheduleBalances(connection, listing);
      console.log(`Repaired ${listing.lot_project_listing_unit_id}: replayed ${payments.length} verified payment(s).`);
    }

    await connection.commit();
    console.log('Schedule repair complete.');
  } catch (error) {
    await connection.rollback();
    console.error('Schedule repair failed:', error.message);
    process.exitCode = 1;
  } finally {
    connection.release();
    await db.end();
  }
};

run();
