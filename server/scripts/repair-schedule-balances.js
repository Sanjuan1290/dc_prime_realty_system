import { db } from '../db/connect.js';
import {
  applyPaymentToSchedules,
  columnExists,
  createComputedSoaRows,
  getComputedSoaTerms,
  recomputeComputedSoaBalances,
  recomputeListingScheduleBalances,
  tableExists,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';


const rebuildListingSchedules = async (connection, listing) => {
  await connection.query(
    `DELETE FROM lot_project_payment_schedules WHERE lot_project_id = ? AND lot_project_listing_id = ?`,
    [listing.lot_project_id, listing.lot_project_listing_id]
  );

  const terms = getComputedSoaTerms(listing, []);
  const computedRows = createComputedSoaRows(terms);
  const scheduleRows = recomputeComputedSoaBalances(computedRows, terms);

  if (!scheduleRows.length) return;

  const baseColumns = [
    'lot_project_id',
    'lot_project_listing_id',
    'lot_project_client_profile_id',
    'due_date',
    'description',
    'beginning_balance',
    'due_amount',
    'penalty_amount',
    'amount_paid',
    'date_paid',
    'reference_id',
    'ending_balance',
    'schedule_status',
  ];
  const optionalColumns = [];

  for (const column of [
    'interest_amount',
    'discount_amount',
    'principal_amount',
    'monthly_amortization_amount',
    'paid_interest_amount',
    'paid_principal_amount',
    'paid_penalty_amount',
  ]) {
    if (await columnExists(connection, 'lot_project_payment_schedules', column)) optionalColumns.push(column);
  }

  const columns = [...baseColumns, ...optionalColumns];
  const values = scheduleRows.flatMap((row) => {
    const baseValues = [
      listing.lot_project_id,
      listing.lot_project_listing_id,
      listing.lot_project_client_profile_id,
      row.dueDate,
      row.description,
      Number(row.beginningBalance || 0),
      Number(row.dueAmount || 0),
      Number(row.penalty || 0),
      0,
      null,
      null,
      Number(row.endingBalance || 0),
      'Unpaid',
    ];

    const optionalValues = optionalColumns.map((column) => {
      if (column === 'interest_amount') return Number(row.interest || 0);
      if (column === 'discount_amount') return Number(row.discountAmount || row.discount_amount || 0);
      if (column === 'principal_amount') return Number(row.principalAmount || row.principal_amount || 0);
      if (column === 'monthly_amortization_amount') return Number(row.monthlyAmortizationAmount || row.dueAmount || 0);
      if (column === 'paid_interest_amount') return Number(row.paidInterestAmount || 0);
      if (column === 'paid_principal_amount') return Number(row.paidPrincipalAmount || 0);
      if (column === 'paid_penalty_amount') return Number(row.paidPenaltyAmount || 0);
      return 0;
    });

    return [...baseValues, ...optionalValues];
  });

  await connection.query(
    `
      INSERT INTO lot_project_payment_schedules (
        ${columns.join(',\n        ')}
      ) VALUES ${scheduleRows.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ')}
    `,
    values
  );
};

const syncFullyPaidSubstatus = async (connection, listing) => {
  const [rows] = await connection.query(
    `
      SELECT COALESCE(MAX(ending_balance), 0) AS remaining_balance
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
        AND LOWER(description) NOT LIKE '%legal%'
        AND LOWER(description) NOT LIKE '%misc%'
        AND LOWER(description) NOT LIKE '%lmf%'
    `,
    [listing.lot_project_id, listing.lot_project_listing_id]
  );

  if (Number(rows[0]?.remaining_balance || 0) <= 0.009) {
    await connection.query(
      `
        UPDATE lot_project_listings
        SET lot_project_listing_sold_substatus = 'fully_paid'
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_listing_status = 'sold'
      `,
      [listing.lot_project_id, listing.lot_project_listing_id]
    );
  }
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
        WHERE lot_project_payment_schedule_id > 0
          AND (
            LOWER(description) LIKE '%legal%'
            OR LOWER(description) LIKE '%misc%'
            OR LOWER(description) LIKE '%lmf%'
          )
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

      await rebuildListingSchedules(connection, listing);

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
      await syncFullyPaidSubstatus(connection, listing);
      console.log(`Repaired ${listing.lot_project_listing_unit_id}: rebuilt schedule and replayed ${payments.length} verified payment(s).`);
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

