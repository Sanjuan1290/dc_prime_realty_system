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

const cleanNamePart = (value) => String(value || '').trim();

const firstMissingRequiredField = (fields = []) =>
  fields.find((field) => !String(field.value ?? '').trim());
const buildBuyerFullName = ({ firstName, middleName, lastName, suffix, fallback = '' } = {}) => {
  const generated = [firstName, middleName, lastName, suffix]
    .map(cleanNamePart)
    .filter(Boolean)
    .join(' ');
  return generated || cleanNamePart(fallback);
};

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
    const buyerFirstName = cleanNamePart(req.body.buyerFirstName || req.body.buyer_first_name);
    const buyerMiddleName = cleanNamePart(req.body.buyerMiddleName || req.body.buyer_middle_name);
    const buyerLastName = cleanNamePart(req.body.buyerLastName || req.body.buyer_last_name);
    const buyerSuffix = cleanNamePart(req.body.buyerSuffix || req.body.buyer_suffix);
    const buyerName = buildBuyerFullName({
      firstName: buyerFirstName,
      middleName: buyerMiddleName,
      lastName: buyerLastName,
      suffix: buyerSuffix,
      fallback: req.body.buyerName || req.body.buyer_full_name,
    });
    const secondBuyerFirstName = cleanNamePart(req.body.secondBuyerFirstName || req.body.second_buyer_first_name);
    const secondBuyerMiddleName = cleanNamePart(req.body.secondBuyerMiddleName || req.body.second_buyer_middle_name);
    const secondBuyerLastName = cleanNamePart(req.body.secondBuyerLastName || req.body.second_buyer_last_name);
    const secondBuyerSuffix = cleanNamePart(req.body.secondBuyerSuffix || req.body.second_buyer_suffix);
    const secondBuyerName = buildBuyerFullName({
      firstName: secondBuyerFirstName,
      middleName: secondBuyerMiddleName,
      lastName: secondBuyerLastName,
      suffix: secondBuyerSuffix,
      fallback: req.body.secondBuyerName || req.body.second_buyer_full_name,
    });

    const principalRequiredFields = [
      { label: 'Principal buyer first name', value: buyerFirstName },
      { label: 'Principal buyer middle name', value: buyerMiddleName },
      { label: 'Principal buyer last name', value: buyerLastName },
      { label: 'Principal buyer suffix', value: buyerSuffix },
      { label: 'Principal buyer birth date', value: req.body.birthDate ?? req.body.buyer_birth_date },
      { label: 'Principal buyer place of birth', value: req.body.placeOfBirth ?? req.body.buyer_place_of_birth },
      { label: 'Principal buyer citizenship', value: req.body.citizenship ?? req.body.buyer_citizenship },
      { label: 'Principal buyer gender', value: req.body.gender ?? req.body.buyer_gender },
      { label: 'Principal buyer civil status', value: req.body.civilStatus ?? req.body.buyer_civil_status },
      { label: 'Principal buyer mobile number', value: req.body.contactNo ?? req.body.buyer_contact_number },
      { label: 'Principal buyer residence phone number', value: req.body.residencePhoneNumber ?? req.body.buyer_residence_phone_number },
      { label: 'Principal buyer email', value: req.body.email ?? req.body.buyer_email },
      { label: 'Principal buyer TIN', value: req.body.tin ?? req.body.buyer_tin },
      { label: 'Principal buyer present address', value: req.body.presentAddress ?? req.body.buyer_present_address },
      { label: 'Principal buyer present ZIP code', value: req.body.presentZipCode ?? req.body.buyer_present_zip_code },
      { label: 'Principal buyer permanent address', value: req.body.permanentAddress ?? req.body.buyer_permanent_address },
      { label: 'Principal buyer permanent ZIP code', value: req.body.permanentZipCode ?? req.body.buyer_permanent_zip_code },
      { label: 'Principal buyer employment status', value: req.body.employmentStatus ?? req.body.buyer_employment_status },
      { label: 'Principal buyer employer / business name', value: req.body.employerBusinessName ?? req.body.buyer_employer_business_name },
      { label: 'Principal buyer employer ZIP code', value: req.body.employerZipCode ?? req.body.buyer_employer_zip_code },
      { label: 'Principal buyer nature of work / business', value: req.body.natureOfWorkBusiness ?? req.body.buyer_nature_of_work_business },
      { label: 'Principal buyer occupation / position / title', value: req.body.occupationPositionTitle ?? req.body.buyer_occupation_position },
      { label: 'Principal buyer monthly income', value: req.body.monthlyIncome ?? req.body.buyer_monthly_income },
      { label: 'Principal buyer employer / business address', value: req.body.employerBusinessAddress ?? req.body.buyer_employer_business_address },
    ];

    const missingPrincipalField = firstMissingRequiredField(principalRequiredFields);
    if (missingPrincipalField) {
      return res.status(400).json({ message: `${missingPrincipalField.label} is required.` });
    }

    if (hasSecondBuyer) {
      const secondBuyerRequiredFields = [
        { label: 'Spouse / second buyer role', value: req.body.secondBuyerRole ?? req.body.second_buyer_role },
        { label: 'Spouse / second buyer first name', value: secondBuyerFirstName },
        { label: 'Spouse / second buyer middle name', value: secondBuyerMiddleName },
        { label: 'Spouse / second buyer last name', value: secondBuyerLastName },
        { label: 'Spouse / second buyer suffix', value: secondBuyerSuffix },
        { label: 'Spouse / second buyer birth date', value: req.body.secondBuyerBirthDate ?? req.body.second_buyer_birth_date },
        { label: 'Spouse / second buyer place of birth', value: req.body.secondBuyerPlaceOfBirth ?? req.body.second_buyer_place_of_birth },
        { label: 'Spouse / second buyer citizenship', value: req.body.secondBuyerCitizenship ?? req.body.second_buyer_citizenship },
        { label: 'Spouse / second buyer gender', value: req.body.secondBuyerGender ?? req.body.second_buyer_gender },
        { label: 'Spouse / second buyer civil status', value: req.body.secondBuyerCivilStatus ?? req.body.second_buyer_civil_status },
        { label: 'Spouse / second buyer mobile number', value: req.body.secondBuyerContactNo ?? req.body.second_buyer_contact_number },
        { label: 'Spouse / second buyer residence phone number', value: req.body.secondBuyerResidencePhoneNumber ?? req.body.second_buyer_residence_phone_number },
        { label: 'Spouse / second buyer email', value: req.body.secondBuyerEmail ?? req.body.second_buyer_email },
        { label: 'Spouse / second buyer TIN', value: req.body.secondBuyerTin ?? req.body.second_buyer_tin },
        { label: 'Spouse / second buyer present address', value: req.body.secondBuyerPresentAddress ?? req.body.second_buyer_present_address },
        { label: 'Spouse / second buyer present ZIP code', value: req.body.secondBuyerPresentZipCode ?? req.body.second_buyer_present_zip_code },
        { label: 'Spouse / second buyer permanent address', value: req.body.secondBuyerPermanentAddress ?? req.body.second_buyer_permanent_address },
        { label: 'Spouse / second buyer permanent ZIP code', value: req.body.secondBuyerPermanentZipCode ?? req.body.second_buyer_permanent_zip_code },
        { label: 'Spouse / second buyer employment status', value: req.body.secondBuyerEmploymentStatus ?? req.body.second_buyer_employment_status },
        { label: 'Spouse / second buyer employer / business name', value: req.body.secondBuyerEmployerBusinessName ?? req.body.second_buyer_employer_business_name },
        { label: 'Spouse / second buyer employer ZIP code', value: req.body.secondBuyerEmployerZipCode ?? req.body.second_buyer_employer_zip_code },
        { label: 'Spouse / second buyer nature of work / business', value: req.body.secondBuyerNatureOfWorkBusiness ?? req.body.second_buyer_nature_of_work_business },
        { label: 'Spouse / second buyer occupation / position / title', value: req.body.secondBuyerOccupationPositionTitle ?? req.body.second_buyer_occupation_position },
        { label: 'Spouse / second buyer monthly income', value: req.body.secondBuyerMonthlyIncome ?? req.body.second_buyer_monthly_income },
        { label: 'Spouse / second buyer employer / business address', value: req.body.secondBuyerEmployerBusinessAddress ?? req.body.second_buyer_employer_business_address },
      ];

      const missingSecondBuyerField = firstMissingRequiredField(secondBuyerRequiredFields);
      if (missingSecondBuyerField) {
        return res.status(400).json({ message: `${missingSecondBuyerField.label} is required.` });
      }
    }

    const tableName = 'lot_project_client_profiles';
    const columns = [
      'lot_project_id',
      'lot_project_listing_id',
      'buyer_type',
      'buyer_first_name',
      'buyer_middle_name',
      'buyer_last_name',
      'buyer_suffix',
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
      'second_buyer_first_name',
      'second_buyer_middle_name',
      'second_buyer_last_name',
      'second_buyer_suffix',
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
      toNullable(buyerFirstName),
      toNullable(buyerMiddleName),
      toNullable(buyerLastName),
      toNullable(buyerSuffix),
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
      hasSecondBuyer ? toNullable(secondBuyerFirstName) : null,
      hasSecondBuyer ? toNullable(secondBuyerMiddleName) : null,
      hasSecondBuyer ? toNullable(secondBuyerLastName) : null,
      hasSecondBuyer ? toNullable(secondBuyerSuffix) : null,
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
