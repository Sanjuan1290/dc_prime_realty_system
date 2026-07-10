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
import { writeAuditLog } from '../../System/auditLogs.controller.js';

export const updateLotProjectClientProfile = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!(await tableExists(connection, 'lot_project_client_profiles'))) {
      return res.status(500).json({ message: 'lot_project_client_profiles table does not exist.' });
    }

    const lookup = getListingLookupWhere(listingLookup);
    const [listingRows] = await connection.query(
      `
        SELECT
          l.lot_project_listing_id,
          l.lot_project_listing_unit_id,
          l.lot_project_listing_status
        FROM lot_project_listings l
        WHERE l.lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!canEditBuyerProfileForListing(listing.lot_project_listing_status)) {
      return res.status(400).json({
        message: 'Reserve this unit first before editing the buyer profile.',
      });
    }

    const buyerType = cleanBuyerType(req.body.buyerType || req.body.buyer_type);
    const hasSecondBuyer = buyerType === 'spouses' || buyerType === 'and_account';
    const buyerName = String(req.body.buyerName || req.body.buyer_full_name || '').trim();
    const secondBuyerName = String(req.body.secondBuyerName || req.body.second_buyer_full_name || '').trim();

    if (!buyerName) return res.status(400).json({ message: 'Principal buyer full name is required.' });
    if (hasSecondBuyer && !secondBuyerName) {
      return res.status(400).json({ message: 'Second buyer / spouse full name is required.' });
    }

    const tableName = 'lot_project_client_profiles';
    const columns = [
      'lot_project_id',
      'lot_project_listing_id',
      'buyer_type',
      'buyer_full_name',
      'buyer_birth_date',
      'buyer_place_of_birth',
      'buyer_citizenship',
      'buyer_gender',
      'buyer_civil_status',
      'buyer_contact_number',
      'buyer_email',
      'buyer_tin',
      'buyer_present_address',
      'buyer_permanent_address',
      'buyer_employment_status',
      'buyer_employer_business_name',
      'buyer_employer_business_address',
      'buyer_nature_of_work_business',
      'buyer_occupation_position',
      'buyer_monthly_income',
      'second_buyer_full_name',
      'second_buyer_birth_date',
      'second_buyer_place_of_birth',
      'second_buyer_citizenship',
      'second_buyer_gender',
      'second_buyer_civil_status',
      'second_buyer_contact_number',
      'second_buyer_email',
      'second_buyer_tin',
      'second_buyer_present_address',
      'second_buyer_permanent_address',
      'second_buyer_employment_status',
      'second_buyer_employer_business_name',
      'second_buyer_employer_business_address',
      'second_buyer_nature_of_work_business',
      'second_buyer_occupation_position',
      'second_buyer_monthly_income',
      'lot_project_client_profile_status',
    ];

    const values = [
      project.lot_project_id,
      listing.lot_project_listing_id,
      buyerType,
      buyerName,
      dateOrNull(req.body.birthDate || req.body.buyer_birth_date),
      toNullable(req.body.placeOfBirth || req.body.buyer_place_of_birth),
      toNullable(req.body.citizenship || req.body.buyer_citizenship),
      toNullable(req.body.gender || req.body.buyer_gender),
      toNullable(req.body.civilStatus || req.body.buyer_civil_status),
      toNullable(req.body.contactNo || req.body.buyer_contact_number),
      toNullable(req.body.email || req.body.buyer_email),
      toNullable(req.body.tin || req.body.buyer_tin),
      toNullable(req.body.presentAddress || req.body.buyer_present_address),
      toNullable(req.body.permanentAddress || req.body.buyer_permanent_address),
      toNullable(req.body.employmentStatus || req.body.buyer_employment_status),
      toNullable(req.body.employerBusinessName || req.body.buyer_employer_business_name),
      toNullable(req.body.employerBusinessAddress || req.body.buyer_employer_business_address),
      toNullable(req.body.natureOfWorkBusiness || req.body.buyer_nature_of_work_business),
      toNullable(req.body.occupationPositionTitle || req.body.buyer_occupation_position),
      parseMoneyValue(req.body.monthlyIncome || req.body.buyer_monthly_income),
      hasSecondBuyer ? secondBuyerName : null,
      hasSecondBuyer ? dateOrNull(req.body.secondBuyerBirthDate || req.body.second_buyer_birth_date) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerPlaceOfBirth || req.body.second_buyer_place_of_birth) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerCitizenship || req.body.second_buyer_citizenship) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerGender || req.body.second_buyer_gender) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerCivilStatus || req.body.second_buyer_civil_status) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerContactNo || req.body.second_buyer_contact_number) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmail || req.body.second_buyer_email) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerTin || req.body.second_buyer_tin) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerPresentAddress || req.body.second_buyer_present_address) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerPermanentAddress || req.body.second_buyer_permanent_address) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmploymentStatus || req.body.second_buyer_employment_status) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmployerBusinessName || req.body.second_buyer_employer_business_name) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerEmployerBusinessAddress || req.body.second_buyer_employer_business_address) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerNatureOfWorkBusiness || req.body.second_buyer_nature_of_work_business) : null,
      hasSecondBuyer ? toNullable(req.body.secondBuyerOccupationPositionTitle || req.body.second_buyer_occupation_position) : null,
      hasSecondBuyer ? parseMoneyValue(req.body.secondBuyerMonthlyIncome || req.body.second_buyer_monthly_income) : 0,
      'active',
    ];

    await addIfColumnExists(connection, tableName, columns, values, 'buyer_residence_phone_number', toNullable(req.body.residencePhoneNumber));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_present_zip_code', toNullable(req.body.presentZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_permanent_zip_code', toNullable(req.body.permanentZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_employer_zip_code', toNullable(req.body.employerZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_role', hasSecondBuyer ? cleanSecondBuyerRole(req.body.secondBuyerRole, buyerType) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_residence_phone_number', hasSecondBuyer ? toNullable(req.body.secondBuyerResidencePhoneNumber) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_present_zip_code', hasSecondBuyer ? toNullable(req.body.secondBuyerPresentZipCode) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_permanent_zip_code', hasSecondBuyer ? toNullable(req.body.secondBuyerPermanentZipCode) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_employer_zip_code', hasSecondBuyer ? toNullable(req.body.secondBuyerEmployerZipCode) : null);

    const updateAssignments = columns
      .filter((column) => !['lot_project_id', 'lot_project_listing_id'].includes(column))
      .map((column) => `${column} = VALUES(${column})`);

    await connection.beginTransaction();

    await connection.query(
      `
        INSERT INTO lot_project_client_profiles (${columns.join(', ')})
        VALUES (${columns.map(() => '?').join(', ')})
        ON DUPLICATE KEY UPDATE ${updateAssignments.join(', ')}
      `,
      values
    );

    const [profileRows] = await connection.query(
      `
        SELECT lot_project_client_profile_id
        FROM lot_project_client_profiles
        WHERE lot_project_listing_id = ?
        LIMIT 1
      `,
      [listing.lot_project_listing_id]
    );

    const clientProfileId = profileRows[0]?.lot_project_client_profile_id;

    await writeAuditLog(connection, req, {
      action: 'update',
      module: 'Client Profiles',
      entityType: 'lot_project_client_profile',
      entityId: clientProfileId ? String(clientProfileId) : String(listing.lot_project_listing_id),
      entityLabel: buyerName,
      title: 'Updated client profile',
      description: `Updated buyer profile for ${buyerName}.`,
      metadata: {
        listingId: listing.lot_project_listing_id,
        unitId: listing.lot_project_listing_unit_id || null,
        buyerType,
        hasSecondBuyer,
      },
    });

    await connection.commit();

    return res.json({
      success: true,
      message: `${buyerName} buyer profile saved successfully.`,
      listing_id: listing.lot_project_listing_id,
    });
  } catch (error) {
    try { await connection.rollback(); } catch {}
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
