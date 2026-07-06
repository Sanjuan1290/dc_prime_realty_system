
import {
  db,
  getErrorMessage,
  tableExists,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getListingLookupWhere,
  toNullable,
  addIfColumnExists,
  cleanBuyerType,
  cleanSecondBuyerRole,
  dateOrNull,
  parseMoneyValue,
} from '../_shared/lotProject.shared.js';

const normalizeNumberOption = (modeValue, customValue, fallback = 0) => {
  if (modeValue === 'custom') return Number(customValue || 0);
  if (modeValue === 'spot_cash') return 0;
  const numberValue = Number(modeValue ?? fallback);
  return Number.isNaN(numberValue) ? fallback : numberValue;
};

const normalizeDocumentPayload = (documents = []) =>
  documents
    .map((document) => ({
      document_id: Number(document.document_id || document.id),
      is_required:
        document.requirement === 'optional' ||
        document.requirement === 'Optional' ||
        document.is_required === false
          ? 0
          : 1,
      status: document.status === 'inactive' ? 'inactive' : 'active',
    }))
    .filter((document) => document.document_id);

const insertReservationDocuments = async (connection, projectId, listingId, clientProfileId, requestedDocuments) => {
  if (!(await tableExists(connection, 'lot_project_listing_documents'))) return;

  const fallbackDefaults = requestedDocuments.length
    ? requestedDocuments
    : await getProjectDefaultDocuments(projectId);

  const cleanDocuments = normalizeDocumentPayload(fallbackDefaults);

  await connection.query(
    `DELETE FROM lot_project_listing_documents WHERE lot_project_listing_id = ?`,
    [listingId]
  );

  if (!cleanDocuments.length) return;

  await connection.query(
    `
      INSERT INTO lot_project_listing_documents (
        lot_project_id,
        lot_project_listing_id,
        document_id,
        lot_project_listing_document_is_required,
        lot_project_listing_document_status
      ) VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, ?)').join(', ')}
    `,
    cleanDocuments.flatMap((document) => [
      projectId,
      listingId,
      document.document_id,
      document.is_required,
      document.status,
    ])
  );

  if (!(await tableExists(connection, 'lot_project_client_documents'))) return;

  await connection.query(
    `
      INSERT INTO lot_project_client_documents (
        lot_project_id,
        lot_project_listing_id,
        lot_project_client_profile_id,
        document_id,
        lot_project_client_document_status
      ) VALUES ${cleanDocuments.map(() => '(?, ?, ?, ?, \'Missing\')').join(', ')}
      ON DUPLICATE KEY UPDATE
        lot_project_id = VALUES(lot_project_id),
        lot_project_listing_id = VALUES(lot_project_listing_id)
    `,
    cleanDocuments.flatMap((document) => [
      projectId,
      listingId,
      clientProfileId,
      document.document_id,
    ])
  );
};

export const reserveLotProjectListing = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const slug = String(req.params.projectSlug || '').trim();
    const listingLookup = String(req.params.listingId || '').trim();
    const project = await getProjectBySlug(slug);

    if (!project) return res.status(404).json({ message: 'Lot project not found.' });
    if (!listingLookup) return res.status(400).json({ message: 'Listing id is required.' });
    if (!(await tableExists(connection, 'lot_project_listings'))) {
      return res.status(500).json({ message: 'lot_project_listings table does not exist.' });
    }
    if (!(await tableExists(connection, 'lot_project_client_profiles'))) {
      return res.status(500).json({ message: 'lot_project_client_profiles table does not exist.' });
    }

    const lookup = getListingLookupWhere(listingLookup);
    const [listingRows] = await connection.query(
      `
        SELECT
          lot_project_listing_id,
          lot_project_listing_unit_id,
          lot_project_listing_status,
          lot_project_listing_tcp,
          lot_project_listing_reservation_fee,
          annual_interest_rate
        FROM lot_project_listings
        WHERE lot_project_id = ?
          AND ${lookup.sql}
        LIMIT 1
      `,
      [project.lot_project_id, ...lookup.params]
    );

    const listing = listingRows[0];
    if (!listing) return res.status(404).json({ message: 'Listing not found.' });
    if (!['available', 'hold'].includes(String(listing.lot_project_listing_status || '').toLowerCase())) {
      return res.status(400).json({ message: 'Only available or hold listings can be reserved.' });
    }

    const clientProfile = req.body.clientProfile || req.body.client || {};
    const reservation = req.body.reservation || {};
    const terms = reservation.paymentTerms || req.body.paymentTerms || {};
    const buyerType = cleanBuyerType(clientProfile.buyerType || clientProfile.buyer_type);
    const hasSecondBuyer = buyerType === 'spouses' || buyerType === 'and_account';
    const buyerName = String(clientProfile.buyerName || clientProfile.buyer_full_name || '').trim();
    const secondBuyerName = String(clientProfile.secondBuyerName || clientProfile.second_buyer_full_name || '').trim();

    if (!buyerName) return res.status(400).json({ message: 'Principal buyer full name is required.' });
    if (!clientProfile.contactNo && !clientProfile.buyer_contact_number) {
      return res.status(400).json({ message: 'Principal buyer mobile number is required.' });
    }
    if (!clientProfile.presentAddress && !clientProfile.buyer_present_address) {
      return res.status(400).json({ message: 'Principal buyer present address is required.' });
    }
    if (hasSecondBuyer && !secondBuyerName) {
      return res.status(400).json({ message: 'Second buyer / spouse full name is required.' });
    }

    const modeOfPayment = reservation.modeOfPayment === 'cash' || terms.modeOfPayment === 'cash' ? 'cash' : 'installment';
    const reservationFee = parseMoneyValue(terms.reservationFee || listing.lot_project_listing_reservation_fee || 0);
    const downpaymentPercentage = Number(
      terms.downpaymentPercentage ?? normalizeNumberOption(terms.downpaymentPercentageMode, terms.customDownpaymentPercentage, 30)
    );
    const downpaymentTerms = Number(
      terms.downpaymentTerms ?? normalizeNumberOption(terms.downpaymentTermsMode, terms.customDownpaymentTerms, 3)
    );
    const monthlyTerms = Number(
      terms.monthlyTerms ?? normalizeNumberOption(terms.monthlyTermsMode, terms.customMonthlyTerms, 36)
    );

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
      'soa_mode_of_payment',
      'soa_reservation_fee',
      'soa_starting_date',
      'soa_first_due_date',
      'soa_downpayment_percentage',
      'soa_downpayment_terms',
      'soa_monthly_terms',
      'soa_annual_interest_rate',
      'soa_dp_discount_percentage',
    ];

    const values = [
      project.lot_project_id,
      listing.lot_project_listing_id,
      buyerType,
      buyerName,
      dateOrNull(clientProfile.birthDate || clientProfile.buyer_birth_date),
      toNullable(clientProfile.placeOfBirth || clientProfile.buyer_place_of_birth),
      toNullable(clientProfile.citizenship || clientProfile.buyer_citizenship),
      toNullable(clientProfile.gender || clientProfile.buyer_gender),
      toNullable(clientProfile.civilStatus || clientProfile.buyer_civil_status),
      toNullable(clientProfile.contactNo || clientProfile.buyer_contact_number),
      toNullable(clientProfile.email || clientProfile.buyer_email),
      toNullable(clientProfile.tin || clientProfile.buyer_tin),
      toNullable(clientProfile.presentAddress || clientProfile.buyer_present_address),
      toNullable(clientProfile.permanentAddress || clientProfile.buyer_permanent_address),
      toNullable(clientProfile.employmentStatus || clientProfile.buyer_employment_status),
      toNullable(clientProfile.employerBusinessName || clientProfile.buyer_employer_business_name),
      toNullable(clientProfile.employerBusinessAddress || clientProfile.buyer_employer_business_address),
      toNullable(clientProfile.natureOfWorkBusiness || clientProfile.buyer_nature_of_work_business),
      toNullable(clientProfile.occupationPositionTitle || clientProfile.buyer_occupation_position),
      parseMoneyValue(clientProfile.monthlyIncome || clientProfile.buyer_monthly_income),
      hasSecondBuyer ? secondBuyerName : null,
      hasSecondBuyer ? dateOrNull(clientProfile.secondBuyerBirthDate || clientProfile.second_buyer_birth_date) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerPlaceOfBirth || clientProfile.second_buyer_place_of_birth) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerCitizenship || clientProfile.second_buyer_citizenship) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerGender || clientProfile.second_buyer_gender) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerCivilStatus || clientProfile.second_buyer_civil_status) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerContactNo || clientProfile.second_buyer_contact_number) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerEmail || clientProfile.second_buyer_email) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerTin || clientProfile.second_buyer_tin) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerPresentAddress || clientProfile.second_buyer_present_address) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerPermanentAddress || clientProfile.second_buyer_permanent_address) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerEmploymentStatus || clientProfile.second_buyer_employment_status) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerEmployerBusinessName || clientProfile.second_buyer_employer_business_name) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerEmployerBusinessAddress || clientProfile.second_buyer_employer_business_address) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerNatureOfWorkBusiness || clientProfile.second_buyer_nature_of_work_business) : null,
      hasSecondBuyer ? toNullable(clientProfile.secondBuyerOccupationPositionTitle || clientProfile.second_buyer_occupation_position) : null,
      hasSecondBuyer ? parseMoneyValue(clientProfile.secondBuyerMonthlyIncome || clientProfile.second_buyer_monthly_income) : 0,
      'active',
      modeOfPayment,
      reservationFee,
      dateOrNull(terms.startingDate) || new Date().toISOString().slice(0, 10),
      dateOrNull(terms.firstDueDate) || new Date().toISOString().slice(0, 10),
      Number.isNaN(downpaymentPercentage) ? 30 : downpaymentPercentage,
      Number.isNaN(downpaymentTerms) ? 3 : downpaymentTerms,
      Number.isNaN(monthlyTerms) ? 36 : monthlyTerms,
      parseMoneyValue(terms.interestRate || listing.annual_interest_rate || 0),
      parseMoneyValue(terms.dpDiscountPercentage || 0),
    ];

    await addIfColumnExists(connection, tableName, columns, values, 'buyer_residence_phone_number', toNullable(clientProfile.residencePhoneNumber));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_present_zip_code', toNullable(clientProfile.presentZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_permanent_zip_code', toNullable(clientProfile.permanentZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'buyer_employer_zip_code', toNullable(clientProfile.employerZipCode));
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_role', hasSecondBuyer ? cleanSecondBuyerRole(clientProfile.secondBuyerRole, buyerType) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_residence_phone_number', hasSecondBuyer ? toNullable(clientProfile.secondBuyerResidencePhoneNumber) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_present_zip_code', hasSecondBuyer ? toNullable(clientProfile.secondBuyerPresentZipCode) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_permanent_zip_code', hasSecondBuyer ? toNullable(clientProfile.secondBuyerPermanentZipCode) : null);
    await addIfColumnExists(connection, tableName, columns, values, 'second_buyer_employer_zip_code', hasSecondBuyer ? toNullable(clientProfile.secondBuyerEmployerZipCode) : null);

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
    if (!clientProfileId) throw new Error('Buyer profile was not created.');

    await connection.query(
      `
        UPDATE lot_project_listings
        SET lot_project_listing_status = 'sold',
            lot_project_listing_sold_substatus = 'active',
            lot_project_listing_cancellation_type = NULL
        WHERE lot_project_id = ?
          AND lot_project_listing_id = ?
      `,
      [project.lot_project_id, listing.lot_project_listing_id]
    );

    await insertReservationDocuments(
      connection,
      project.lot_project_id,
      listing.lot_project_listing_id,
      clientProfileId,
      Array.isArray(req.body.documents) ? req.body.documents : []
    );

    await connection.commit();

    return res.status(201).json({
      success: true,
      message: `${buyerName} reservation saved successfully.`,
      listing_id: listing.lot_project_listing_id,
      client_profile_id: clientProfileId,
      unit_id: listing.lot_project_listing_unit_id,
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({ message: getErrorMessage(error) });
  } finally {
    connection.release();
  }
};
