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
  canGenerateListingSoa,
  getListingSoaRows,
  getRequestToken,
  getAuthenticatedUser,
  getUserFullName,
  getListingForPayment,
  normalizePaymentType,
  getPaymentTypeLabel,
  normalizePaymentMethod,
  getNextCashReference,
  mapPaymentRow,
  getListingPayments,
  recomputeListingScheduleBalances,
  applyPaymentToSchedules,
  reversePaymentAllocations,
  getPaymentById,
  dateOrNull,
  parseMoneyValue,
  cleanBuyerType,
  cleanSecondBuyerRole,
  addIfColumnExists,
} from '../_shared/lotProject.shared.js';

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
    const scheduleId = toNullableNumber(req.body.soaRowId || req.body.paymentScheduleId || req.body.lot_project_payment_schedule_id);

    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });

    const referenceId = paymentMethod === 'Cash'
      ? await getNextCashReference(connection, listing.lot_project_listing_unit_id)
      : toNullable(req.body.referenceId || req.body.reference_id);

    if (paymentMethod !== 'Cash' && !referenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    await connection.beginTransaction();

    const [paymentResult] = await connection.query(
      `
        INSERT INTO lot_project_payments (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          lot_project_payment_schedule_id,
          lot_project_payment_type,
          lot_project_payment_method,
          lot_project_payment_amount,
          lot_project_payment_date,
          lot_project_payment_reference_id,
          lot_project_payment_status,
          lot_project_payment_verified_by_user_id,
          lot_project_payment_verified_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Verified', ?, NOW())
      `,
      [
        project.lot_project_id,
        listing.lot_project_listing_id,
        listing.lot_project_client_profile_id,
        scheduleId,
        paymentType,
        paymentMethod,
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

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${getPaymentTypeLabel(paymentType)} payment saved and verified successfully.`,
      payment_id: paymentId,
      reference_id: referenceId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
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
    const scheduleId = toNullableNumber(req.body.soaRowId || req.body.paymentScheduleId || req.body.lot_project_payment_schedule_id || existingPayment.lot_project_payment_schedule_id);

    if (amount <= 0) return res.status(400).json({ message: 'Payment amount must be greater than 0.' });

    const referenceId = paymentMethod === 'Cash'
      ? (existingPayment.lot_project_payment_reference_id || await getNextCashReference(connection, listing.lot_project_listing_unit_id))
      : toNullable(req.body.referenceId || req.body.reference_id);

    if (paymentMethod !== 'Cash' && !referenceId) {
      return res.status(400).json({ message: 'Reference ID is required for non-cash payments.' });
    }

    await connection.beginTransaction();

    if (await tableExists(connection, 'lot_project_payment_allocations')) {
      await connection.query(
        `DELETE FROM lot_project_payment_allocations WHERE lot_project_payment_id = ?`,
        [paymentId]
      );
    }

    await connection.query(
      `
        UPDATE lot_project_payments
        SET lot_project_payment_schedule_id = ?,
            lot_project_payment_type = ?,
            lot_project_payment_method = ?,
            lot_project_payment_amount = ?,
            lot_project_payment_date = ?,
            lot_project_payment_reference_id = ?,
            lot_project_payment_status = 'Verified',
            lot_project_payment_verified_by_user_id = ?,
            lot_project_payment_verified_at = NOW()
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [
        scheduleId,
        paymentType,
        paymentMethod,
        amount,
        paymentDate,
        referenceId,
        user?.id || null,
        paymentId,
        project.lot_project_id,
        listing.lot_project_listing_id,
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

    await connection.commit();

    return res.json({
      success: true,
      message: `${getPaymentTypeLabel(paymentType)} payment updated successfully.`,
      payment_id: paymentId,
      reference_id: referenceId,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
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
        SELECT l.*, cp.*
        FROM lot_project_listings l
        INNER JOIN lot_project_client_profiles cp
          ON cp.lot_project_listing_id = l.lot_project_listing_id
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
              AND lot_project_payment_status <> 'Cancelled'
          `,
          [project.lot_project_id, listing.lot_project_listing_id]
        ))[0][0]?.total
      : 0;

    if (Number(paymentCount || 0) > 0) {
      return res.status(400).json({
        message: 'SOA terms cannot be changed after payments are recorded. Delete/reverse payments first, then update SOA terms.',
      });
    }

    const dpDiscountPercentage = Number(req.body.dpDiscountPercentage ?? req.body.soa_dp_discount_percentage ?? listing.soa_dp_discount_percentage ?? 0);
    const downpaymentPercentage = Number(req.body.downpaymentPercentage ?? req.body.soa_downpayment_percentage ?? listing.soa_downpayment_percentage ?? 30);
    const downpaymentTerms = Number(req.body.downpaymentTerms ?? req.body.soa_downpayment_terms ?? listing.soa_downpayment_terms ?? 3);
    const monthlyTerms = Number(req.body.monthlyTerms ?? req.body.soa_monthly_terms ?? listing.soa_monthly_terms ?? 36);
    const annualInterestRate = Number(req.body.annualInterestRate ?? req.body.soa_annual_interest_rate ?? listing.soa_annual_interest_rate ?? listing.annual_interest_rate ?? 0);
    const firstDueDate = dateOrNull(req.body.firstDueDate || req.body.soa_first_due_date || listing.soa_first_due_date);

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
    await addProfileUpdate('soa_monthly_terms', monthlyTerms);
    await addProfileUpdate('soa_annual_interest_rate', annualInterestRate);
    await addProfileUpdate('soa_first_due_date', firstDueDate);

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

    if (await tableExists(connection, 'lot_project_payment_schedules')) {
      const updatedListing = {
        ...listing,
        soa_dp_discount_percentage: dpDiscountPercentage,
        soa_downpayment_percentage: downpaymentPercentage,
        soa_downpayment_terms: downpaymentTerms,
        soa_monthly_terms: monthlyTerms,
        soa_annual_interest_rate: annualInterestRate,
        soa_first_due_date: firstDueDate,
      };
      const terms = getComputedSoaTerms(updatedListing, []);
      const computedRows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);

      await connection.query(
        `DELETE FROM lot_project_payment_schedules WHERE lot_project_listing_id = ?`,
        [listing.lot_project_listing_id]
      );

      if (computedRows.length > 0) {
        await connection.query(
          `
            INSERT INTO lot_project_payment_schedules (
              lot_project_id,
              lot_project_listing_id,
              lot_project_client_profile_id,
              due_date,
              description,
              beginning_balance,
              due_amount,
              penalty_amount,
              amount_paid,
              date_paid,
              reference_id,
              ending_balance,
              schedule_status,
              created_at,
              updated_at
            ) VALUES ${computedRows.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())').join(', ')}
          `,
          computedRows.flatMap((row) => [
            project.lot_project_id,
            listing.lot_project_listing_id,
            listing.lot_project_client_profile_id,
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
          ])
        );
      }
    }

    await connection.commit();

    return res.json({
      success: true,
      message: 'SOA terms saved and schedule recomputed successfully.',
      data: {
        dpDiscountPercentage,
        downpaymentPercentage,
        downpaymentTerms,
        monthlyTerms,
        annualInterestRate,
        firstDueDate,
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
  if (!password) return { ok: false, message: 'Super admin password is required.' };

  if (user?.role === 'super_admin') {
    const isPasswordCorrect = await bcrypt.compare(password, user.password_hash || '');
    return isPasswordCorrect
      ? { ok: true, superAdmin: user }
      : { ok: false, message: 'Super admin password is incorrect.' };
  }

  const [superAdmins] = await connection.query(
    `
      SELECT id, first_name, middle_name, last_name, email, role, password_hash, status
      FROM users
      WHERE role = 'super_admin'
        AND status = 'active'
    `
  );

  for (const superAdmin of superAdmins) {
    if (await bcrypt.compare(password, superAdmin.password_hash || '')) {
      return { ok: true, superAdmin };
    }
  }

  return { ok: false, message: user ? 'Super admin password is incorrect.' : 'Please enter a valid super admin password.' };
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

    if (await tableExists(connection, 'lot_project_payment_allocations')) {
      await connection.query(
        `DELETE FROM lot_project_payment_allocations WHERE lot_project_payment_id = ?`,
        [paymentId]
      );
    }

    await connection.query(
      `
        UPDATE lot_project_payments
        SET lot_project_payment_status = 'Cancelled',
            lot_project_payment_updated_at = NOW()
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [paymentId, project.lot_project_id, listing.lot_project_listing_id]
    );

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

