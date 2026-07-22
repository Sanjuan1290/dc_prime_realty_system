import {
  db,
  bcrypt,
  getErrorMessage,
  slugify,
  toNullable,
  toNullableNumber,
  toActiveStatus,
  tableExists,
  columnExists,
  money,
  plainDate,
  formatDateTime,
  toDisplayValue,
  safeDeleteByProjectId,
  normalizeProjectPayload,
  getListingStatusLabel,
  normalizeLotType,
  lotTypeLabel,
  normalizeListingStatusPayload,
  formatDocumentsLabel,
  mapListingRow,
  mapProjectRows,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getProjectCadastralLots,
  getListingLookupWhere,
  computeAgeFromDate,
  getClientCompletionStatus,
  mapClientProfile,
  canEditBuyerProfileForListing,
  mapProfileListing,
  getListingDocuments,
  roundMoneyValue,
  normalizeDateInput,
  addMonthsToDate,
  getOrdinalLabel,
  getScheduleTotalDue,
  appendPaymentReference,
  getPaymentAmountValue,
  createBalloonPrincipalRow,
  getRowSortOrder,
  sortComputedRows,
  getComputedSoaTerms,
  createComputedSoaRows,
  getPaymentTargetRows,
  allocatePaymentsToComputedRows,
  recomputeComputedSoaBalances,
  getExistingSoaScheduleRows,
  getLatestActiveScheduleGenerationPredicate,
  canGenerateListingSoa,
  getListingSoaRows,
  getRequestToken,
  getAuthenticatedUser,
  getUserFullName,
  getListingForPayment,
  normalizePaymentType,
  getPaymentTypeLabel,
  getRemainingUnpaidScheduleBalance,
  getBalloonPrincipalCapacity,
  normalizePaymentMethod,
  getNextCashReference,
  mapPaymentRow,
  getListingPayments,
  recomputeListingScheduleBalances,
  applyPaymentToSchedules,
  reversePaymentAllocations,
  getPaymentById,
  getListingPenaltySnapshots,
  refreshListingPenaltyCache,
  todayDateOnly,
  dateOrNull,
  parseMoneyValue,
  cleanBuyerType,
  cleanSecondBuyerRole,
  addIfColumnExists,
} from '../_shared/lotProject.shared.js';
import { writeAuditLog } from '../../System/auditLogs.controller.js';

const penaltyManagerRoles = new Set(['super_admin', 'admin']);

const createHttpError = (statusCode, message) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const getExactFullPaymentAmount = async (connection, listing) => {
  const [scheduleRows] = await connection.query(
    `
      SELECT s.*
      FROM lot_project_payment_schedules s
      WHERE s.lot_project_id = ?
        AND s.lot_project_listing_id = ?
        AND s.lot_project_client_profile_id = ?
        AND ${getLatestActiveScheduleGenerationPredicate('s')}
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        lot_project_payment_schedule_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
  );

  const [profileRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_client_profiles
      WHERE lot_project_client_profile_id = ?
      LIMIT 1
    `,
    [listing.lot_project_client_profile_id]
  );

  return getRemainingUnpaidScheduleBalance(
    scheduleRows,
    { ...(listing || {}), ...(profileRows[0] || {}) }
  );
};

const validateFullPaymentAmount = async (connection, listing, paymentType, amount) => {
  if (paymentType !== 'full_payment') return;

  const exactAmount = await getExactFullPaymentAmount(connection, listing);
  if (exactAmount <= 0.009) {
    throw createHttpError(400, 'This account has no remaining unpaid SOA balance.');
  }

  if (Math.abs(Number(amount || 0) - exactAmount) > 0.009) {
    throw createHttpError(
      400,
      `Full Payment amount must equal the current unpaid SOA balance of ${money(exactAmount)}.`
    );
  }
};

const validateBalloonPaymentAmount = async (
  connection,
  listing,
  paymentType,
  amount,
  excludePaymentId = 0
) => {
  if (paymentType !== 'balloon') return;

  const availablePrincipal = await getBalloonPrincipalCapacity(connection, listing, {
    excludePaymentId,
  });

  if (availablePrincipal <= 0.009) {
    throw createHttpError(400, 'There is no remaining financed principal available for a balloon payment.');
  }

  if (Number(amount || 0) - availablePrincipal > 0.009) {
    throw createHttpError(
      400,
      `Balloon Payment cannot exceed the remaining financed principal of ${money(availablePrincipal)}.`
    );
  }
};

const requirePenaltyManager = async (req) => {
  const user = await getAuthenticatedUser(req);
  if (!user) throw createHttpError(401, 'Authentication is required.');
  if (!penaltyManagerRoles.has(user.role)) {
    throw createHttpError(403, 'Only an admin or super admin can manage penalty relief.');
  }
  return user;
};

const addDaysToDateOnly = (value, days = 0) => {
  const clean = dateOrNull(value);
  if (!clean) return null;
  const [year, month, day] = clean.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + Number(days || 0))).toISOString().slice(0, 10);
};

const getPenaltyReliefContext = async (connection, project, listing, scheduleId, asOfDate = todayDateOnly()) => {
  if (!(await tableExists(connection, 'lot_project_penalty_reliefs'))) {
    throw createHttpError(500, 'Penalty relief table is missing. Run server/migrations/20260711_add_daily_penalty_reliefs.sql first.');
  }

  const [profileRows] = await connection.query(
    `SELECT * FROM lot_project_client_profiles WHERE lot_project_client_profile_id = ? LIMIT 1`,
    [listing.lot_project_client_profile_id]
  );
  const clientProfile = { ...(listing || {}), ...(profileRows[0] || {}) };
  if (!profileRows[0]) throw createHttpError(404, 'Buyer payment terms were not found.');

  const [scheduleRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_payment_schedule_id = ?
        AND lot_project_id = ?
        AND lot_project_listing_id = ?
        AND lot_project_client_profile_id = ?
      LIMIT 1
    `,
    [scheduleId, project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
  );
  const schedule = scheduleRows[0];
  if (!schedule) throw createHttpError(404, 'SOA row was not found.');

  const snapshots = await getListingPenaltySnapshots(
    connection,
    project.lot_project_id,
    listing.lot_project_listing_id,
    clientProfile,
    [schedule],
    asOfDate
  );
  const snapshot = snapshots.get(Number(scheduleId));
  if (!snapshot) throw createHttpError(500, 'Penalty information could not be calculated.');

  return { clientProfile, schedule, snapshot };
};

export const createLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!(await tableExists(connection, 'lot_project_payments'))) {
      return res.status(500).json({ message: 'lot_project_payments table does not exist.' });
    }

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!listing.lot_project_client_profile_id) {
      return res.status(400).json({ message: 'This listing has no buyer profile yet.' });
    }

    const amount = parseMoneyValue(req.body.amount);
    const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || new Date().toISOString().slice(0, 10);
    const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type);
    const paymentMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || req.body.payment_method);
    const bankName = paymentMethod === 'Cash'
      ? null
      : toNullable(req.body.bankName || req.body.bank_name || req.body.paymentBank || req.body.payment_bank);
    const accountNumber = paymentMethod === 'Cash'
      ? null
      : toNullable(req.body.accountNumber || req.body.account_number || req.body.accountNo || req.body.account_no);
    const requestedScheduleId = req.body.soaRowId ?? req.body.paymentScheduleId ?? req.body.lot_project_payment_schedule_id;
    const scheduleId = paymentType === 'full_payment' || paymentType === 'balloon'
      ? null
      : toNullableNumber(requestedScheduleId);

    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });

    const referenceId = paymentMethod === 'Cash'
      ? await getNextCashReference(connection, listing.lot_project_listing_unit_id)
      : toNullable(req.body.referenceId || req.body.reference_id);

    if (paymentMethod !== 'Cash' && !bankName) {
      return res.status(400).json({ message: 'Bank / payment provider is required for non-cash payments.' });
    }
    if (paymentMethod !== 'Cash' && !accountNumber) {
      return res.status(400).json({ message: 'Account No. / wallet number is required for non-cash payments.' });
    }
    if (paymentMethod !== 'Cash' && !bankName) {
      return res.status(400).json({ message: 'Bank / payment provider is required for non-cash payments.' });
    }
    if (paymentMethod !== 'Cash' && !accountNumber) {
      return res.status(400).json({ message: 'Account No. / wallet number is required for non-cash payments.' });
    }
    if (paymentMethod !== 'Cash' && !referenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    await connection.beginTransaction();

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      await recomputeListingScheduleBalances(connection, listing);
      await refreshListingPenaltyCache(connection, listing, paymentDate);
      await recomputeListingScheduleBalances(connection, listing);
      await validateFullPaymentAmount(connection, listing, paymentType, amount);
      await validateBalloonPaymentAmount(connection, listing, paymentType, amount);
    }

    const [paymentResult] = await connection.query(
      `
        INSERT INTO lot_project_payments (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          lot_project_payment_type,
          lot_project_payment_method,
          lot_project_payment_bank_name,
          lot_project_payment_account_number,
          lot_project_payment_amount,
          lot_project_payment_date,
          lot_project_payment_reference_id,
          lot_project_payment_status,
          lot_project_payment_verified_by_user_id,
          lot_project_payment_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, NOW())
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        paymentType,
        paymentMethod,
        bankName,
        accountNumber,
        amount,
        paymentDate,
        referenceId,
        user?.id || null,
      ]
    );

    const paymentId = paymentResult.insertId;

    await connection.query(
      `
        INSERT INTO lot_project_payment_logs (
          lot_project_payment_id,
          action_type,
          action_description,
          action_by_user_id
        ) VALUES (?, 'created', ?, ?)
      `,
      [paymentId, `${getPaymentTypeLabel(paymentType)} payment created and verified for ${listing.lot_project_listing_unit_id}.`, user?.id || null]
    );

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      await applyPaymentToSchedules(connection, listing, paymentId, scheduleId, amount, paymentDate, referenceId, paymentType);
      await refreshListingPenaltyCache(connection, listing, paymentDate);
      await recomputeListingScheduleBalances(connection, listing);
    }

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_payment',
      entityId: String(paymentId),
      entityLabel: `${referenceId || `Payment #${paymentId}`} — ${listing.buyer_full_name || listing.lot_project_listing_unit_id}`,
      title: 'Recorded SOA payment',
      description: `Recorded ${getPaymentTypeLabel(paymentType)} payment for ${listing.buyer_full_name || listing.lot_project_listing_unit_id}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        unitId: listing.lot_project_listing_unit_id,
        clientName: listing.buyer_full_name || null,
        amount,
        paymentDate,
        paymentType,
        paymentMethod,
        bankName,
        accountNumber,
        referenceId,
        scheduleId,
      },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${getPaymentTypeLabel(paymentType)} payment saved and verified successfully.`,
      payment_id: paymentId,
      reference_id: referenceId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updateLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const existingPayment = await getPaymentById(connection, project, listing, paymentId);
    if (!existingPayment) return res.status(404).json({ message: 'Payment not found.' });

    const amount = parseMoneyValue(req.body.amount);
    const paymentDate = dateOrNull(req.body.paymentDate || req.body.payment_date) || plainDate(existingPayment.lot_project_payment_date);
    const paymentType = normalizePaymentType(req.body.paymentType || req.body.payment_type || existingPayment.lot_project_payment_type);
    const paymentMethod = normalizePaymentMethod(req.body.method || req.body.paymentMethod || req.body.payment_method || existingPayment.lot_project_payment_method);
    const bankName = paymentMethod === 'Cash'
      ? null
      : toNullable(
          req.body.bankName ||
          req.body.bank_name ||
          req.body.paymentBank ||
          req.body.payment_bank ||
          existingPayment.lot_project_payment_bank_name
        );
    const accountNumber = paymentMethod === 'Cash'
      ? null
      : toNullable(
          req.body.accountNumber ||
          req.body.account_number ||
          req.body.accountNo ||
          req.body.account_no ||
          existingPayment.lot_project_payment_account_number
        );
    const requestedScheduleId = req.body.soaRowId ?? req.body.paymentScheduleId ?? req.body.lot_project_payment_schedule_id;
    const scheduleId = paymentType === 'full_payment' || paymentType === 'balloon'
      ? null
      : toNullableNumber(requestedScheduleId ?? existingPayment.lot_project_payment_schedule_id);

    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });

    const referenceId = paymentMethod === 'Cash'
      ? (
          existingPayment.lot_project_payment_method === 'Cash' && existingPayment.lot_project_payment_reference_id
            ? existingPayment.lot_project_payment_reference_id
            : await getNextCashReference(connection, listing.lot_project_listing_unit_id)
        )
      : toNullable(req.body.referenceId || req.body.reference_id);

    if (paymentMethod !== 'Cash' && !referenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    await connection.beginTransaction();

    await reversePaymentAllocations(connection, listing, paymentId);
    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      await refreshListingPenaltyCache(connection, listing, paymentDate);
      await validateFullPaymentAmount(connection, listing, paymentType, amount);
      await validateBalloonPaymentAmount(connection, listing, paymentType, amount, paymentId);
    }

    await connection.query(
      `
        UPDATE lot_project_payments
        SET lot_project_payment_schedule_id = ?,
            lot_project_payment_type = ?,
            lot_project_payment_method = ?,
            lot_project_payment_bank_name = ?,
            lot_project_payment_account_number = ?,
            lot_project_payment_amount = ?,
            lot_project_payment_date = ?,
            lot_project_payment_reference_id = ?,
            lot_project_payment_status = 'Verified',
            lot_project_payment_verified_by_user_id = ?,
            lot_project_payment_verified_at = NOW()
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
      `,
      [
        scheduleId,
        paymentType,
        paymentMethod,
        bankName,
        accountNumber,
        amount,
        paymentDate,
        referenceId,
        user?.id || null,
        paymentId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
      ]
    );

    await connection.query(
      `
        INSERT INTO lot_project_payment_logs (
          lot_project_payment_id,
          action_type,
          action_description,
          action_by_user_id
        ) VALUES (?, 'updated', ?, ?)
      `,
      [paymentId, `${getPaymentTypeLabel(paymentType)} payment updated by ${getUserFullName(user)}.`, user?.id || null]
    );

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      await recomputeListingScheduleBalances(connection, listing);
      await applyPaymentToSchedules(connection, listing, paymentId, scheduleId, amount, paymentDate, referenceId, paymentType);
      await refreshListingPenaltyCache(connection, listing, paymentDate);
      await recomputeListingScheduleBalances(connection, listing);
    }

    await connection.commit();

    return res.json({
      success: true,
      message: `${getPaymentTypeLabel(paymentType)} payment updated successfully.`,
      payment_id: paymentId,
      reference_id: referenceId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


export const updateLotProjectListingSoaTerms = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!user) return res.status(401).json({ message: 'Please login before updating SOA terms.' });
    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });

    const lookup = getListingLookupWhere(listingLookup);

    const [listingRows] = await connection.query(
      `
        SELECT l.*, account.lot_project_account_id, account.account_reference, account.account_status, cp.*
        FROM lot_project_listings l
        INNER JOIN lot_project_accounts account
          ON account.lot_project_account_id = l.current_account_id
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_client_profile_id = account.lot_project_client_profile_id
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Reserved listing not found.' });

    const paymentCount = await tableExists(connection, 'lot_project_payments')
      ? (await connection.query(
          `
            SELECT COUNT(*) AS total
            FROM lot_project_payments
            WHERE lot_project_id = ?
              AND lot_project_listing_id = ?
              AND lot_project_client_profile_id = ?
              AND lot_project_payment_status <> 'Cancelled'
          `,
          [project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
        ))[0][0]?.total
      : 0;

    const dpDiscountPercentage = Number(req.body.dpDiscountPercentage ?? req.body.soa_dp_discount_percentage ?? listing.soa_dp_discount_percentage ?? 0);
    const downpaymentPercentage = Number(req.body.downpaymentPercentage ?? req.body.soa_downpayment_percentage ?? listing.soa_downpayment_percentage ?? 30);
    const downpaymentTerms = Number(req.body.downpaymentTerms ?? req.body.soa_downpayment_terms ?? listing.soa_downpayment_terms ?? 3);
    const monthlyTerms = Number(req.body.monthlyTerms ?? req.body.soa_monthly_terms ?? listing.soa_monthly_terms ?? 36);
    const reservationFeeAppliedToDownpayment = (
      req.body.reservationFeeTreatment === 'apply_to_downpayment' ||
      req.body.reservationFeeAppliedToDownpayment === true ||
      Number(
        req.body.reservationFeeAppliedToDownpayment ??
          req.body.soa_reservation_fee_applied_to_downpayment ??
          listing.soa_reservation_fee_applied_to_downpayment ??
          0
      ) === 1
    );
    const interestRateSource = 'listing';
    const annualInterestRate = Number(listing.annual_interest_rate || 0);
    const firstDueDate = dateOrNull(req.body.firstDueDate || req.body.soa_first_due_date || listing.soa_first_due_date);
    const dailyPenaltyRate = Number(
      req.body.dailyPenaltyRate ??
      req.body.soa_penalty_rate_percent ??
      listing.soa_penalty_rate_percent ??
      0
    );
    const penaltyGraceDays = Number(
      req.body.penaltyGraceDays ??
      req.body.soa_penalty_grace_days ??
      listing.soa_penalty_grace_days ??
      1
    );
    if (dpDiscountPercentage < 0 || dpDiscountPercentage > 100) {
      return res.status(400).json({ message: 'DP Discount % must be between 0 and 100.' });
    }

    if (downpaymentPercentage < 0 || downpaymentPercentage > 100) {
      return res.status(400).json({ message: 'Downpayment % must be between 0 and 100.' });
    }

    if (!Number.isInteger(downpaymentTerms) || downpaymentTerms < 0) {
      return res.status(400).json({ message: 'Downpayment terms must be zero or greater.' });
    }

    if (!Number.isInteger(monthlyTerms) || monthlyTerms < 1) {
      return res.status(400).json({ message: 'Monthly terms must be at least 1.' });
    }

    if (annualInterestRate < 0) {
      return res.status(400).json({ message: 'Annual interest rate cannot be negative.' });
    }

    if (!Number.isFinite(dailyPenaltyRate) || dailyPenaltyRate < 0 || dailyPenaltyRate > 100) {
      return res.status(400).json({ message: 'Daily penalty rate must be between 0 and 100.' });
    }

    if (!Number.isInteger(penaltyGraceDays) || penaltyGraceDays < 0 || penaltyGraceDays > 31) {
      return res.status(400).json({ message: 'Penalty-free grace period must be from 0 to 31 days.' });
    }

    const sameNumber = (left, right) => Math.abs(Number(left || 0) - Number(right || 0)) < 0.000001;
    const currentFirstDueDate = dateOrNull(listing.soa_first_due_date);
    const structuralTermsChanged =
      !sameNumber(dpDiscountPercentage, listing.soa_dp_discount_percentage) ||
      !sameNumber(downpaymentPercentage, listing.soa_downpayment_percentage) ||
      Number(downpaymentTerms) !== Number(listing.soa_downpayment_terms ?? 3) ||
      Number(monthlyTerms) !== Number(listing.soa_monthly_terms ?? 36) ||
      Number(reservationFeeAppliedToDownpayment) !== Number(listing.soa_reservation_fee_applied_to_downpayment || 0) ||
      firstDueDate !== currentFirstDueDate;
    const penaltyTermsChanged =
      !sameNumber(dailyPenaltyRate, listing.soa_penalty_rate_percent) ||
      Number(penaltyGraceDays) !== Number(listing.soa_penalty_grace_days ?? 1) ||
      String(listing.soa_penalty_calculation_method || 'daily').toLowerCase() !== 'daily';

    if (firstDueDate !== currentFirstDueDate) {
      const today = todayDateOnly();
      const startingDate = dateOrNull(listing.soa_starting_date) || today;
      if (!firstDueDate) {
        return res.status(400).json({ message: 'First Due Date is required.' });
      }
      if (firstDueDate < today) {
        return res.status(400).json({ message: 'First Due Date must be today or a future date.' });
      }
      if (firstDueDate < startingDate) {
        return res.status(400).json({ message: 'First Due Date cannot be before the Starting Date.' });
      }
    }

    if (Number(paymentCount || 0) > 0 && structuralTermsChanged) {
      return res.status(400).json({
        message: 'Downpayment and amortization terms cannot be changed after payments are recorded. Penalty rate and grace period can still be updated.',
      });
    }

    const updateColumns = [];
    const updateParams = [];

    const addProfileUpdate = async (column, value) => {
      if (await columnExists(connection, 'lot_project_client_profiles', column)) {
        updateColumns.push(`${column} = ?`);
        updateParams.push(value);
      }
    };

    await addProfileUpdate('soa_dp_discount_percentage', dpDiscountPercentage);
    await addProfileUpdate('soa_downpayment_percentage', downpaymentPercentage);
    await addProfileUpdate('soa_downpayment_terms', downpaymentTerms);
    await addProfileUpdate('soa_reservation_fee_applied_to_downpayment', reservationFeeAppliedToDownpayment ? 1 : 0);
    await addProfileUpdate('soa_monthly_terms', monthlyTerms);
    await addProfileUpdate('soa_annual_interest_rate', annualInterestRate);
    await addProfileUpdate('soa_interest_rate_overridden', 0);
    await addProfileUpdate('soa_first_due_date', firstDueDate);
    await addProfileUpdate('soa_penalty_calculation_method', 'daily');
    await addProfileUpdate('soa_penalty_rate_percent', dailyPenaltyRate);
    await addProfileUpdate('soa_penalty_grace_days', penaltyGraceDays);

    await connection.beginTransaction();

    if (updateColumns.length > 0) {
      await connection.query(
        `
          UPDATE lot_project_client_profiles
          SET ${updateColumns.join(', ')}
          WHERE lot_project_client_profile_id = ?
            AND lot_project_id = ?
            AND lot_project_listing_id = ?
        `,
        [
          ...updateParams,
          listing.lot_project_client_profile_id,
          project.lot_project_id,
          listing.lot_project_listing_id,
        ]
      );
    }

    if (structuralTermsChanged && await tableExists(connection, 'lot_project_payment_schedules')) {
      const updatedListing = {
        ...listing,
        soa_dp_discount_percentage: dpDiscountPercentage,
        soa_downpayment_percentage: downpaymentPercentage,
        soa_downpayment_terms: downpaymentTerms,
        soa_reservation_fee_applied_to_downpayment: reservationFeeAppliedToDownpayment ? 1 : 0,
        soa_monthly_terms: monthlyTerms,
        soa_annual_interest_rate: annualInterestRate,
        soa_interest_rate_overridden: 0,
        soa_first_due_date: firstDueDate,
        soa_penalty_calculation_method: 'daily',
        soa_penalty_rate_percent: dailyPenaltyRate,
        soa_penalty_grace_days: penaltyGraceDays,
      };
      const terms = getComputedSoaTerms(updatedListing, []);
      const computedRows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);

      // Keep the previous zero-payment schedule as account history instead of deleting it.
      await connection.query(
        `
          UPDATE lot_project_payment_schedules
          SET schedule_status = 'Cancelled',
              updated_at = NOW()
          WHERE lot_project_id = ?
            AND lot_project_listing_id = ?
            AND lot_project_client_profile_id = ?
            AND schedule_status <> 'Cancelled'
        `,
        [project.lot_project_id, listing.lot_project_listing_id, listing.lot_project_client_profile_id]
      );

      if (computedRows.length > 0) {
        const baseColumns = [
          'lot_project_id',
          'lot_project_listing_id',
          'lot_project_client_profile_id',
          'lot_project_account_id',
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
        const addOptionalColumn = async (column) => {
          if (await columnExists(connection, 'lot_project_payment_schedules', column)) optionalColumns.push(column);
        };

        await addOptionalColumn('interest_amount');
        await addOptionalColumn('discount_amount');
        await addOptionalColumn('principal_amount');
        await addOptionalColumn('monthly_amortization_amount');
        await addOptionalColumn('paid_interest_amount');
        await addOptionalColumn('paid_principal_amount');
        await addOptionalColumn('paid_penalty_amount');

        const columns = [...baseColumns, ...optionalColumns, 'created_at', 'updated_at'];
        const insertValues = computedRows.flatMap((row) => {
          const baseValues = [
            project.lot_project_id,
            listing.lot_project_listing_id,
            listing.lot_project_client_profile_id,
            listing.lot_project_account_id,
            row.dueDate,
            row.description,
            roundMoneyValue(row.beginningBalance || 0),
            roundMoneyValue(row.dueAmount || 0),
            roundMoneyValue(row.penalty || 0),
            roundMoneyValue(row.amountPaid || 0),
            row.datePaid && row.datePaid !== '-' ? row.datePaid : null,
            row.referenceId && row.referenceId !== '-' ? row.referenceId : null,
            roundMoneyValue(row.endingBalance || 0),
            row.status || 'Unpaid',
          ];
          const optionalValues = optionalColumns.map((column) => {
            if (column === 'interest_amount') return roundMoneyValue(row.interest || 0);
            if (column === 'discount_amount') return roundMoneyValue(row.discountAmount || row.discount_amount || 0);
            if (column === 'principal_amount') return roundMoneyValue(row.principalAmount || row.principal_amount || 0);
            if (column === 'monthly_amortization_amount') return roundMoneyValue(row.monthlyAmortizationAmount || row.dueAmount || 0);
            if (column === 'paid_interest_amount') return roundMoneyValue(row.paidInterestAmount || 0);
            if (column === 'paid_principal_amount') return roundMoneyValue(row.paidPrincipalAmount || 0);
            if (column === 'paid_penalty_amount') return roundMoneyValue(row.paidPenaltyAmount || 0);
            return 0;
          });

          return [...baseValues, ...optionalValues];
        });

        await connection.query(
          `
            INSERT INTO lot_project_payment_schedules (
              ${columns.join(',\n              ')}
            ) VALUES ${computedRows.map(() => `(${columns.map((column) => column === 'created_at' || column === 'updated_at' ? 'NOW()' : '?').join(', ')})`).join(', ')}
          `,
          insertValues
        );
      }
    }

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      const refreshedListing = {
        ...listing,
        soa_penalty_calculation_method: 'daily',
        soa_penalty_rate_percent: dailyPenaltyRate,
        soa_penalty_grace_days: penaltyGraceDays,
      };
      await refreshListingPenaltyCache(connection, refreshedListing, todayDateOnly());
      await recomputeListingScheduleBalances(connection, refreshedListing);
    }

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_listing',
      entityId: String(listing.lot_project_listing_id),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${listing.buyer_full_name || 'Client'}`,
      title: 'Updated SOA terms',
      description: `Updated SOA terms for ${listing.buyer_full_name || listing.lot_project_listing_unit_id}.`,
      metadata: {
        clientProfileId: listing.lot_project_client_profile_id,
        dpDiscountPercentage,
        downpaymentPercentage,
        downpaymentTerms,
        monthlyTerms,
        annualInterestRate,
        firstDueDate,
        dailyPenaltyRate,
        penaltyGraceDays,
        structuralTermsChanged,
        penaltyTermsChanged,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: structuralTermsChanged
        ? 'SOA terms saved and schedule recomputed successfully.'
        : penaltyTermsChanged
          ? 'Penalty settings updated successfully.'
          : 'SOA terms are already up to date.',
      data: {
        dpDiscountPercentage,
        downpaymentPercentage,
        downpaymentTerms,
        monthlyTerms,
        annualInterestRate,
        interestRateSource,
        firstDueDate,
        dailyPenaltyRate,
        penaltyGraceDays,
      },
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


const verifySuperAdminPassword = async (connection, user, password) => {
  if (!password) return { ok: false, message: 'Administrator password is required.' };

  if (['super_admin', 'admin'].includes(user?.role)) {
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash || '');
    return isPasswordCorrect
      ? { ok: true, superAdmin: user }
      : { ok: false, message: 'Administrator password is incorrect.' };
  }

  const [superAdmins] = await connection.query(
    `
      SELECT id, first_name, middle_name, last_name, email, role, password_hash, status
      FROM users
      WHERE role IN ('super_admin', 'admin')
        AND status = 'active'
    `
  );

  for (const superAdmin of superAdmins) {
    if (await bcrypt.compare(password, superAdmin.password_hash || '')) {
      return { ok: true, superAdmin };
    }
  }

  return { ok: false, message: user ? 'Administrator password is incorrect.' : 'Please enter a valid administrator password.' };
};

export const deleteLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);
    const superAdminPassword = String(req.body.superAdminPassword || req.body.password || '').trim();

    const superAdminCheck = await verifySuperAdminPassword(connection, user, superAdminPassword);
    if (!superAdminCheck.ok) {
      return res.status(user ? 403 : 401).json({ message: superAdminCheck.message });
    }
    const actionUser = user || superAdminCheck.superAdmin;

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!paymentId) return res.status(400).json({ message: 'Payment id is required.' });

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });

    const existingPayment = await getPaymentById(connection, project, listing, paymentId);
    if (!existingPayment) return res.status(404).json({ message: 'Payment not found.' });

    await connection.beginTransaction();

    await reversePaymentAllocations(connection, listing, paymentId);

    await connection.query(
      `
        UPDATE lot_project_payments
        SET lot_project_payment_status = 'Cancelled',
            lot_project_payment_updated_at = NOW()
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
      `,
      [
        paymentId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
      ]
    );

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      await recomputeListingScheduleBalances(connection, listing);
      await refreshListingPenaltyCache(connection, listing, todayDateOnly());
      await recomputeListingScheduleBalances(connection, listing);
    }

    await connection.query(
      `
        INSERT INTO lot_project_payment_logs (
          lot_project_payment_id,
          action_type,
          action_description,
          action_by_user_id
        ) VALUES (?, 'deleted', ?, ?)
      `,
      [
        paymentId,
        `Payment ${existingPayment.lot_project_payment_reference_id || paymentId} deleted by ${getUserFullName(actionUser)}.`,
        actionUser?.id || null,
      ]
    );

    await connection.commit();

    return res.json({
      success: true,
      message: `Payment ${existingPayment.lot_project_payment_reference_id || paymentId} deleted successfully.`,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};


export const grantPaymentSchedulePenaltyExtension = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const project = await getProjectBySlug(slug);
    const promisedPaymentDate = dateOrNull(req.body.promisedPaymentDate || req.body.promised_payment_date);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId) throw createHttpError(400, 'SOA row is required.');
    if (!promisedPaymentDate) throw createHttpError(400, 'Promised payment date is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const today = todayDateOnly();
    const maxDate = addDaysToDateOnly(today, 31);
    if (promisedPaymentDate < today) {
      throw createHttpError(400, 'Promised payment date cannot be before today.');
    }
    if (promisedPaymentDate > maxDate) {
      throw createHttpError(400, 'Penalty-free extension cannot exceed 31 days.');
    }

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      today
    );

    const scheduleDueDate = dateOrNull(schedule.due_date);
    if (scheduleDueDate && today < scheduleDueDate) {
      throw createHttpError(400, 'A penalty-free extension can only be granted on or after the SOA due date.');
    }
    if (snapshot.activeExtension?.status === 'active') {
      throw createHttpError(400, 'This SOA row already has an active penalty-free extension. Edit the current extension instead.');
    }
    if (snapshot.unpaidBaseAmount <= 0.009) {
      throw createHttpError(400, 'This SOA row has no unpaid installment balance.');
    }
    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          promised_payment_date,
          relief_amount,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'penalty_free_extension', ?, 0, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        promisedPaymentDate,
        reason,
        internalNotes,
        user.id,
      ]
    );

    await refreshListingPenaltyCache(connection, listing, today);
    await recomputeListingScheduleBalances(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(result.insertId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: 'Granted penalty-free extension',
      description: `Granted a penalty-free extension through ${promisedPaymentDate} for ${schedule.description}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        promisedPaymentDate,
        reason,
      },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `No new penalty will be added through ${promisedPaymentDate}.`,
      penalty_relief_id: result.insertId,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const updatePaymentSchedulePenaltyExtension = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const reliefId = Number(req.params.reliefId || 0);
    const project = await getProjectBySlug(slug);
    const promisedPaymentDate = dateOrNull(req.body.promisedPaymentDate || req.body.promised_payment_date);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId || !reliefId) throw createHttpError(400, 'Active penalty extension is required.');
    if (!promisedPaymentDate) throw createHttpError(400, 'Promised payment date is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const today = todayDateOnly();
    const maxDate = addDaysToDateOnly(today, 31);
    if (promisedPaymentDate < today || promisedPaymentDate > maxDate) {
      throw createHttpError(400, 'Promised payment date must be within the next 31 days.');
    }

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      today
    );
    if (snapshot.activeExtension?.status !== 'active' || Number(snapshot.activeExtension.penaltyReliefId) !== reliefId) {
      throw createHttpError(400, 'Only the current active penalty-free extension can be edited.');
    }

    await connection.beginTransaction();
    const [result] = await connection.query(
      `
        UPDATE lot_project_penalty_reliefs
        SET promised_payment_date = ?,
            reason = ?,
            internal_notes = ?,
            status = 'active',
            updated_at = NOW()
        WHERE penalty_relief_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
          AND lot_project_payment_schedule_id = ?
          AND relief_type = 'penalty_free_extension'
          AND status <> 'cancelled'
      `,
      [
        promisedPaymentDate,
        reason,
        internalNotes,
        reliefId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
      ]
    );
    if (!result.affectedRows) throw createHttpError(404, 'Penalty-free extension was not found.');

    await refreshListingPenaltyCache(connection, listing, today);
    await recomputeListingScheduleBalances(connection, listing);
    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(reliefId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: 'Edited penalty-free extension',
      description: `Updated the penalty-free extension through ${promisedPaymentDate} for ${schedule.description}.`,
      metadata: { listingId: listing.lot_project_listing_id, scheduleId, reliefId, promisedPaymentDate, reason },
    });

    await connection.commit();
    return res.json({ success: true, message: `The penalty-free payment date was updated to ${promisedPaymentDate}.` });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const correctPaymentSchedulePenalty = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    if (!['super_admin', 'admin'].includes(user.role)) {
      throw createHttpError(403, 'Only a full-access administrator can correct a penalty.');
    }

    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const project = await getProjectBySlug(slug);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId) throw createHttpError(400, 'SOA row is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    const today = todayDateOnly();
    await refreshListingPenaltyCache(connection, listing, today);
    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      today
    );
    const correctedAmount = roundMoneyValue(snapshot.calculatedPenaltyAmount || 0);

    await connection.beginTransaction();
    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          relief_amount,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'penalty_correction', ?, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        correctedAmount,
        reason,
        internalNotes,
        user.id,
      ]
    );

    await refreshListingPenaltyCache(connection, listing, today);
    await recomputeListingScheduleBalances(connection, listing);
    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(result.insertId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: 'Reset penalty as a correction',
      description: `Reset the calculated penalty to PHP 0.00 for ${schedule.description}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        correctedAmount,
        reason,
        correctionDate: today,
      },
    });

    await connection.commit();
    return res.status(201).json({
      success: true,
      message: 'The incorrect penalty was cleared and is now ₱0.00.',
      penalty_relief_id: result.insertId,
      corrected_amount: correctedAmount,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const waivePaymentSchedulePenalty = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const scheduleId = Number(req.params.scheduleId || 0);
    const project = await getProjectBySlug(slug);
    const waiverType = String(req.body.waiverType || req.body.waiver_type || 'full').toLowerCase();
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!scheduleId) throw createHttpError(400, 'SOA row is required.');
    if (!['full', 'partial'].includes(waiverType)) {
      throw createHttpError(400, 'Waiver type must be full or partial.');
    }
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');

    await refreshListingPenaltyCache(connection, listing, todayDateOnly());
    const { schedule, snapshot } = await getPenaltyReliefContext(
      connection,
      project,
      listing,
      scheduleId,
      todayDateOnly()
    );

    const outstandingPenalty = roundMoneyValue(snapshot.outstandingPenaltyAmount || 0);
    if (outstandingPenalty <= 0.009) {
      throw createHttpError(400, 'This SOA row has no outstanding penalty to waive.');
    }

    const requestedAmount = waiverType === 'full'
      ? outstandingPenalty
      : parseMoneyValue(req.body.amount || req.body.reliefAmount || req.body.relief_amount);

    if (requestedAmount <= 0) {
      throw createHttpError(400, 'Partial waiver amount must be greater than 0.');
    }
    if (requestedAmount > outstandingPenalty + 0.009) {
      throw createHttpError(400, 'Waiver amount cannot exceed the outstanding penalty.');
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          relief_amount,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        scheduleId,
        waiverType === 'full' ? 'full_waiver' : 'partial_waiver',
        roundMoneyValue(requestedAmount),
        reason,
        internalNotes,
        user.id,
      ]
    );

    await refreshListingPenaltyCache(connection, listing, todayDateOnly());
    await recomputeListingScheduleBalances(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(result.insertId),
      entityLabel: `${schedule.description} — ${listing.lot_project_listing_unit_id}`,
      title: waiverType === 'full' ? 'Waived penalty in full' : 'Partially waived penalty',
      description: `${waiverType === 'full' ? 'Fully waived' : 'Partially waived'} ${money(requestedAmount)} penalty for ${schedule.description}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId,
        waiverType,
        amount: roundMoneyValue(requestedAmount),
        reason,
      },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${waiverType === 'full' ? 'Full' : 'Partial'} penalty reduction saved.`,
      penalty_relief_id: result.insertId,
      waived_amount: roundMoneyValue(requestedAmount),
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};

export const restorePaymentSchedulePenaltyWaiver = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await requirePenaltyManager(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const reliefId = Number(req.params.reliefId || 0);
    const project = await getProjectBySlug(slug);
    const reason = String(req.body.reason || '').trim();
    const internalNotes = toNullable(req.body.internalNotes || req.body.internal_notes);

    if (!project) throw createHttpError(404, 'Lot project not found.');
    if (!reliefId) throw createHttpError(400, 'Penalty waiver is required.');
    if (!reason) throw createHttpError(400, 'Reason is required.');

    const listing = await getListingForPayment(connection, project, listingLookup);
    if (!listing) throw createHttpError(404, 'Listing not found.');
    if (!(await tableExists(connection, 'lot_project_penalty_reliefs'))) {
      throw createHttpError(500, 'Penalty relief table is missing. Run the penalty relief migration first.');
    }

    const [reliefRows] = await connection.query(
      `
        SELECT *
        FROM lot_project_penalty_reliefs
        WHERE penalty_relief_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
          AND lot_project_client_profile_id = ?
          AND lot_project_account_id = ?
          AND relief_type IN ('full_waiver', 'partial_waiver', 'penalty_correction')
        LIMIT 1
      `,
      [
        reliefId,
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
      ]
    );
    const relief = reliefRows[0];
    if (!relief) throw createHttpError(404, 'Penalty relief record was not found.');

    const isCorrection = relief.relief_type === 'penalty_correction';
    if (isCorrection && !['super_admin', 'admin'].includes(user.role)) {
      throw createHttpError(403, 'Only a full-access administrator can recalculate a corrected penalty.');
    }

    const [restorationRows] = await connection.query(
      `
        SELECT COUNT(*) AS restoration_count, COALESCE(SUM(relief_amount), 0) AS restored_amount
        FROM lot_project_penalty_reliefs
        WHERE restores_penalty_relief_id = ?
          AND relief_type = 'restoration'
          AND status <> 'cancelled'
      `,
      [reliefId]
    );
    const restorationCount = Number(restorationRows[0]?.restoration_count || 0);
    const alreadyRestored = roundMoneyValue(restorationRows[0]?.restored_amount || 0);
    const restorableAmount = isCorrection
      ? roundMoneyValue(relief.relief_amount || 0)
      : roundMoneyValue(Math.max(Number(relief.relief_amount || 0) - alreadyRestored, 0));
    const requestedAmount = isCorrection
      ? restorableAmount
      : req.body.amount === undefined || req.body.amount === null || req.body.amount === ''
        ? restorableAmount
        : parseMoneyValue(req.body.amount);

    if (isCorrection && (restorationCount > 0 || relief.status === 'restored')) {
      throw createHttpError(400, 'This penalty correction has already been restored.');
    }
    if (!isCorrection && restorableAmount <= 0.009) {
      throw createHttpError(400, 'This penalty waiver has already been fully restored.');
    }
    if (!isCorrection && (requestedAmount <= 0 || requestedAmount > restorableAmount + 0.009)) {
      throw createHttpError(400, 'Restore amount must be greater than 0 and cannot exceed the remaining waived amount.');
    }

    await connection.beginTransaction();

    const [result] = await connection.query(
      `
        INSERT INTO lot_project_penalty_reliefs (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_account_id,
          lot_project_payment_schedule_id,
          relief_type,
          relief_amount,
          restores_penalty_relief_id,
          status,
          reason,
          internal_notes,
          approved_by_user_id
        ) VALUES (?, ?, ?, ?, ?, 'restoration', ?, ?, 'active', ?, ?, ?)
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        listing.lot_project_account_id,
        relief.lot_project_payment_schedule_id,
        roundMoneyValue(requestedAmount),
        reliefId,
        reason,
        internalNotes,
        user.id,
      ]
    );

    const totalRestored = roundMoneyValue(alreadyRestored + requestedAmount);
    if (isCorrection || totalRestored + 0.009 >= Number(relief.relief_amount || 0)) {
      await connection.query(
        `UPDATE lot_project_penalty_reliefs SET status = 'restored' WHERE penalty_relief_id = ?`,
        [reliefId]
      );
    }

    await refreshListingPenaltyCache(connection, listing, todayDateOnly());
    await recomputeListingScheduleBalances(connection, listing);

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Payments',
      entityType: 'lot_project_penalty_relief',
      entityId: String(reliefId),
      entityLabel: `${isCorrection ? 'Penalty correction' : 'Penalty waiver'} #${reliefId} — ${listing.lot_project_listing_unit_id}`,
      title: isCorrection ? 'Restored penalty correction' : 'Restored waived penalty',
      description: isCorrection
        ? `Restored penalty calculation after correction #${reliefId}.`
        : `Restored ${money(requestedAmount)} from penalty waiver #${reliefId}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        scheduleId: relief.lot_project_payment_schedule_id,
        reliefId,
        restorationId: result.insertId,
        amount: roundMoneyValue(requestedAmount),
        reason,
      },
    });

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: isCorrection ? 'The penalty was recalculated successfully.' : 'The removed penalty was added back successfully.',
      penalty_relief_id: result.insertId,
      restored_amount: roundMoneyValue(requestedAmount),
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(error?.statusCode || 500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
