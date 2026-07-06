import {
  db,
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
      [paymentId, `${getPaymentTypeLabel(paymentType)} payment updated by ${getUserFullName(user)}.`, user.id]
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

export const deleteLotProjectListingPayment = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const user = await getAuthenticatedUser(req);
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const paymentId = Number(req.params.paymentId || 0);
    const project = await getProjectBySlug(slug);
    const superAdminPassword = String(req.body.superAdminPassword || req.body.password || '').trim();

    if (!user) return res.status(401).json({ message: 'Please login before deleting a payment.' });
    if (user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Only the logged-in super admin can delete a payment.' });
    }
    if (!superAdminPassword) {
      return res.status(400).json({ message: 'Super admin password is required.' });
    }

    const isPasswordCorrect = await bcrypt.compare(superAdminPassword, user.password_hash || '');
    if (!isPasswordCorrect) {
      return res.status(403).json({ message: 'Super admin password is incorrect.' });
    }

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
        DELETE FROM lot_project_payments
        WHERE lot_project_payment_id = ?
          AND lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [paymentId, project.lot_project_id, listing.lot_project_listing_id]
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
