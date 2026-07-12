import {
  db,
  getErrorMessage,
  tableExists,
  columnExists,
  getProjectBySlug,
  getProjectDefaultDocuments,
  getListingLookupWhere,
  toNullable,
  addIfColumnExists,
  cleanBuyerType,
  cleanSecondBuyerRole,
  dateOrNull,
  parseMoneyValue,
  getComputedSoaTerms,
  createComputedSoaRows,
  recomputeComputedSoaBalances,
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

const normalizeNumberOption = (modeValue, customValue, fallback = 0) => {
  if (modeValue === 'custom') return Number(customValue || 0);
  if (modeValue === 'spot_cash') return 0;
  const numberValue = Number(modeValue ?? fallback);
  return Number.isNaN(numberValue) ? fallback : numberValue;
};

const getMissingDailyPenaltySchemaItems = async (connection) => {
  const missing = [];

  const requiredTables = [
    'lot_project_payment_schedules',
    'lot_project_penalty_reliefs',
  ];

  for (const tableName of requiredTables) {
    if (!(await tableExists(connection, tableName))) {
      missing.push(`table ${tableName}`);
    }
  }

  const requiredColumns = [
    ['lot_project_client_profiles', 'soa_penalty_calculation_method'],
    ['lot_project_payment_schedules', 'calculated_penalty_amount'],
    ['lot_project_payment_schedules', 'waived_penalty_amount'],
    ['lot_project_payment_schedules', 'penalty_calculated_through'],
  ];

  for (const [tableName, columnName] of requiredColumns) {
    if (missing.includes(`table ${tableName}`)) continue;
    if (!(await columnExists(connection, tableName, columnName))) {
      missing.push(`${tableName}.${columnName}`);
    }
  }

  return missing;
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


const replaceReservationSchedules = async (connection, projectId, listing, clientProfileId, profileTerms) => {
  if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return;

  const listingTermsRow = {
    ...listing,
    lot_project_client_profile_id: clientProfileId,
    buyer_full_name: profileTerms.buyerName,
    soa_mode_of_payment: profileTerms.modeOfPayment,
    soa_reservation_fee: profileTerms.reservationFee,
    soa_reservation_fee_applied_to_downpayment: profileTerms.reservationFeeAppliedToDownpayment ? 1 : 0,
    soa_starting_date: profileTerms.startingDate,
    soa_first_due_date: profileTerms.firstDueDate,
    soa_downpayment_percentage: profileTerms.downpaymentPercentage,
    soa_downpayment_terms: profileTerms.downpaymentTerms,
    soa_monthly_terms: profileTerms.monthlyTerms,
    soa_annual_interest_rate: profileTerms.annualInterestRate,
    soa_dp_discount_percentage: profileTerms.dpDiscountPercentage,
    soa_legal_misc_fee_mode: profileTerms.legalMiscFeeMode,
    soa_legal_misc_fee_amount: profileTerms.legalMiscFeeAmount,
  };

  const computedTerms = getComputedSoaTerms(listingTermsRow, []);
  const computedRows = createComputedSoaRows(computedTerms);
  const scheduleRows = recomputeComputedSoaBalances(computedRows, computedTerms);

  await connection.query(
    `DELETE FROM lot_project_payment_schedules WHERE lot_project_listing_id = ?`,
    [listing.lot_project_listing_id]
  );

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
  const addOptionalColumn = async (column) => {
    if (await columnExists(connection, 'lot_project_payment_schedules', column)) optionalColumns.push(column);
  };

  await addOptionalColumn('interest_amount');
  await addOptionalColumn('principal_amount');
  await addOptionalColumn('monthly_amortization_amount');
  await addOptionalColumn('paid_interest_amount');
  await addOptionalColumn('paid_principal_amount');
  await addOptionalColumn('paid_penalty_amount');

  const columns = [...baseColumns, ...optionalColumns];
  const values = scheduleRows.flatMap((row) => {
    const baseValues = [
      projectId,
      listing.lot_project_listing_id,
      clientProfileId,
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
      if (column === 'principal_amount') return Number(row.principalAmount || row.principal_amount || 0);
      if (column === 'monthly_amortization_amount') return Number(row.monthlyAmortizationAmount || row.dueAmount || 0);
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


const roundMoney = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const releaseStages = [
  { stage: '1st Release', trigger: 20, percent: 20 },
  { stage: '2nd Release', trigger: 40, percent: 20 },
  { stage: '3rd Release', trigger: 60, percent: 20 },
  { stage: '4th Release', trigger: 75, percent: 15 },
  { stage: 'Retention', trigger: 100, percent: 25 },
];

const loadSellerById = async (connection, accreditedSellerId) => {
  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id,
        acs.user_id,
        acs.seller_group_id,
        acs.accredited_seller_reports_under_user_id,
        acs.accredited_seller_status,
        u.role,
        u.status AS user_status,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS full_name
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      WHERE acs.accredited_seller_id = ?
      LIMIT 1
    `,
    [accreditedSellerId]
  );
  return rows[0] || null;
};

const loadSellerByUserId = async (connection, userId) => {
  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id,
        acs.user_id,
        acs.seller_group_id,
        acs.accredited_seller_reports_under_user_id,
        acs.accredited_seller_status,
        u.role,
        u.status AS user_status,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS full_name
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      WHERE acs.user_id = ?
      LIMIT 1
    `,
    [userId]
  );
  return rows[0] || null;
};

const loadGroupHeadSeller = async (connection, sellerGroupId) => {
  if (!sellerGroupId || !(await tableExists(connection, 'seller_groups'))) return null;

  const [rows] = await connection.query(
    `
      SELECT seller_group_head_user_id
      FROM seller_groups
      WHERE seller_group_id = ?
        AND seller_group_status = 'active'
      LIMIT 1
    `,
    [sellerGroupId]
  );

  const headUserId = rows[0]?.seller_group_head_user_id;
  if (!headUserId) return null;

  const headSeller = await loadSellerByUserId(connection, headUserId);
  if (!headSeller) return null;
  if (headSeller.accredited_seller_status !== 'active' || headSeller.user_status !== 'active') return null;

  return { ...headSeller, is_group_head: true };
};

const loadSellerChain = async (connection, accreditedSellerId) => {
  const chain = [];
  const seen = new Set();
  let current = await loadSellerById(connection, accreditedSellerId);
  let terminalSeller = null;

  while (current && !seen.has(current.accredited_seller_id)) {
    seen.add(current.accredited_seller_id);
    chain.push(current);
    terminalSeller = current;

    if (!current.accredited_seller_reports_under_user_id) break;
    current = await loadSellerByUserId(connection, current.accredited_seller_reports_under_user_id);
  }

  const headSeller = await loadGroupHeadSeller(connection, terminalSeller?.seller_group_id || chain[0]?.seller_group_id);
  if (headSeller && !seen.has(headSeller.accredited_seller_id)) {
    chain.push(headSeller);
  }

  return chain;
};

const loadSellerRateMap = async (connection, lotProjectId, sellerIds = []) => {
  if (!sellerIds.length || !(await tableExists(connection, 'accredited_seller_lot_project_rates'))) return new Map();

  const [rows] = await connection.query(
    `
      SELECT accredited_seller_id, accredited_seller_project_rate
      FROM accredited_seller_lot_project_rates
      WHERE lot_project_id = ?
        AND accredited_seller_lot_project_rate_status = 'active'
        AND accredited_seller_id IN (${sellerIds.map(() => '?').join(',')})
    `,
    [lotProjectId, ...sellerIds]
  );

  return new Map(rows.map((row) => [Number(row.accredited_seller_id), Number(row.accredited_seller_project_rate || 0)]));
};

const loadGroupPoolRate = async (connection, lotProjectId, sellerGroupId, fallbackRate = 0) => {
  if (!sellerGroupId || !(await tableExists(connection, 'seller_group_lot_project_rates'))) return fallbackRate;

  const [rows] = await connection.query(
    `
      SELECT seller_group_pool_rate
      FROM seller_group_lot_project_rates
      WHERE seller_group_id = ?
        AND lot_project_id = ?
        AND seller_group_lot_project_rate_status = 'active'
      LIMIT 1
    `,
    [sellerGroupId, lotProjectId]
  );

  return Number(rows[0]?.seller_group_pool_rate || fallbackRate || 0);
};

const insertCommissionReleaseRows = async (connection, commissionId, grossCommission, paymentPercent = 0) => {
  if (!(await tableExists(connection, 'lot_project_commission_releases'))) return;

  await connection.query(
    `DELETE FROM lot_project_commission_releases WHERE lot_project_commission_id = ?`,
    [commissionId]
  );

  await connection.query(
    `
      INSERT INTO lot_project_commission_releases (
        lot_project_commission_id,
        release_stage,
        release_trigger_percent,
        release_percent,
        gross_release_amount,
        deduction_amount,
        net_release_amount,
        release_status,
        scheduled_release_date
      ) VALUES ${releaseStages.map(() => '(?, ?, ?, ?, ?, 0, ?, ?, NULL)').join(', ')}
    `,
    releaseStages.flatMap((stage) => {
      const gross = roundMoney(grossCommission * (stage.percent / 100));
      const status = stage.stage === 'Retention'
        ? 'On Hold'
        : Number(paymentPercent || 0) >= stage.trigger
          ? 'Eligible'
          : 'Pending';
      return [commissionId, stage.stage, stage.trigger, stage.percent, gross, gross, status];
    })
  );
};

const replaceReservationCommissions = async (connection, projectId, listing, clientProfileId, assignedSellerId, saleChannel) => {
  if (!(await tableExists(connection, 'lot_project_commissions'))) return;
  if (!(await tableExists(connection, 'accredited_sellers'))) return;

  const baseAmount = roundMoney(listing.lot_project_listing_net_selling_price || listing.lot_project_listing_tcp || 0);
  if (baseAmount <= 0) return;

  const chain = await loadSellerChain(connection, assignedSellerId, projectId);
  if (!chain.length) throw new Error('Assigned seller hierarchy could not be loaded.');

  const sellerIds = chain.map((seller) => Number(seller.accredited_seller_id));
  const rateMap = await loadSellerRateMap(connection, projectId, sellerIds);
  const commissionChain = chain.filter((seller) =>
    !seller.is_group_head || Number(rateMap.get(Number(seller.accredited_seller_id)) || 0) > 0
  );
  const assignedSeller = commissionChain[0];
  const fallbackRate = Number(rateMap.get(assignedSeller.accredited_seller_id) || 0);
  const groupPoolRate = await loadGroupPoolRate(connection, projectId, assignedSeller.seller_group_id, fallbackRate);

  const ceilingRate = (seller) => {
    if (seller.role === 'broker_network_manager') return Number(groupPoolRate || rateMap.get(seller.accredited_seller_id) || 0);
    return Number(rateMap.get(seller.accredited_seller_id) || 0);
  };

  const commissionRows = [];

  if (saleChannel === 'direct_to_developer') {
    const rate = ceilingRate(assignedSeller) || groupPoolRate;
    commissionRows.push({ seller: assignedSeller, rate, sellerType: 'main_seller', saleType: 'direct' });
  } else {
    let lowerCeiling = 0;
    for (const seller of commissionChain) {
      const currentCeiling = ceilingRate(seller);
      if (currentCeiling < lowerCeiling) {
        throw new Error(`${seller.full_name || 'Parent seller'} rate (${currentCeiling}%) cannot be lower than the seller below them (${lowerCeiling}%). Fix seller rates before reserving.`);
      }

      const earnedRate = roundMoney(currentCeiling - lowerCeiling);
      if (earnedRate > 0) {
        commissionRows.push({
          seller,
          rate: earnedRate,
          sellerType: seller.accredited_seller_id === assignedSeller.accredited_seller_id
            ? seller.role === 'agent' ? 'selling_agent' : 'main_seller'
            : 'hierarchy_seller',
          saleType: 'distributed',
        });
      }

      lowerCeiling = currentCeiling;
    }

    if (groupPoolRate && lowerCeiling > groupPoolRate) {
      throw new Error(`Generated commission rate (${lowerCeiling}%) is higher than the group pool rate (${groupPoolRate}%).`);
    }
  }

  await connection.query(`DELETE FROM lot_project_commissions WHERE lot_project_listing_id = ?`, [listing.lot_project_listing_id]);

  for (const item of commissionRows) {
    const gross = roundMoney(baseAmount * (Number(item.rate || 0) / 100));
    const [result] = await connection.query(
      `
        INSERT INTO lot_project_commissions (
          lot_project_id,
          lot_project_listing_id,
          lot_project_client_profile_id,
          accredited_seller_id,
          commission_role,
          commission_seller_type,
          commission_sale_type,
          commission_base_amount,
          commission_rate,
          gross_commission_amount,
          released_commission_amount,
          net_remaining_commission_amount,
          payment_percent,
          commission_status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 'Pending')
      `,
      [
        projectId,
        listing.lot_project_listing_id,
        clientProfileId,
        item.seller.accredited_seller_id,
        item.seller.role,
        item.sellerType,
        item.saleType,
        baseAmount,
        item.rate,
        gross,
        gross,
      ]
    );

    await insertCommissionReleaseRows(connection, result.insertId, gross, 0);
  }
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
    const missingDailyPenaltySchema = await getMissingDailyPenaltySchemaItems(connection);
    if (missingDailyPenaltySchema.length) {
      return res.status(500).json({
        message: `Daily penalty database migration is incomplete. Missing: ${missingDailyPenaltySchema.join(', ')}. Run server/migrations/20260711_add_daily_penalty_reliefs.sql against the same database configured in server/.env, then restart the API.`,
        missing_schema_items: missingDailyPenaltySchema,
      });
    }

    const lookup = getListingLookupWhere(listingLookup, '');
    const hasAnnualInterestRate = await columnExists(connection, 'lot_project_listings', 'annual_interest_rate');
    const annualInterestSelect = hasAnnualInterestRate ? 'annual_interest_rate' : '0 AS annual_interest_rate';

    const [listingRows] = await connection.query(
      `
        SELECT
          lot_project_listing_id,
          lot_project_listing_unit_id,
          lot_project_listing_status,
          lot_project_listing_tcp,
          lot_project_listing_net_selling_price,
          lot_project_listing_lmf_amount,
          lot_project_listing_reservation_fee,
          ${annualInterestSelect}
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
    const buyerFirstName = cleanNamePart(clientProfile.buyerFirstName || clientProfile.buyer_first_name);
    const buyerMiddleName = cleanNamePart(clientProfile.buyerMiddleName || clientProfile.buyer_middle_name);
    const buyerLastName = cleanNamePart(clientProfile.buyerLastName || clientProfile.buyer_last_name);
    const buyerSuffix = cleanNamePart(clientProfile.buyerSuffix || clientProfile.buyer_suffix);
    const buyerName = buildBuyerFullName({
      firstName: buyerFirstName,
      middleName: buyerMiddleName,
      lastName: buyerLastName,
      suffix: buyerSuffix,
      fallback: clientProfile.buyerName || clientProfile.buyer_full_name,
    });
    const secondBuyerFirstName = cleanNamePart(clientProfile.secondBuyerFirstName || clientProfile.second_buyer_first_name);
    const secondBuyerMiddleName = cleanNamePart(clientProfile.secondBuyerMiddleName || clientProfile.second_buyer_middle_name);
    const secondBuyerLastName = cleanNamePart(clientProfile.secondBuyerLastName || clientProfile.second_buyer_last_name);
    const secondBuyerSuffix = cleanNamePart(clientProfile.secondBuyerSuffix || clientProfile.second_buyer_suffix);
    const secondBuyerName = buildBuyerFullName({
      firstName: secondBuyerFirstName,
      middleName: secondBuyerMiddleName,
      lastName: secondBuyerLastName,
      suffix: secondBuyerSuffix,
      fallback: clientProfile.secondBuyerName || clientProfile.second_buyer_full_name,
    });

    const principalRequiredFields = [
      { label: 'Principal buyer first name', value: buyerFirstName },
      { label: 'Principal buyer middle name', value: buyerMiddleName },
      { label: 'Principal buyer last name', value: buyerLastName },
      { label: 'Principal buyer suffix', value: buyerSuffix },
      { label: 'Principal buyer birth date', value: clientProfile.birthDate ?? clientProfile.buyer_birth_date },
      { label: 'Principal buyer place of birth', value: clientProfile.placeOfBirth ?? clientProfile.buyer_place_of_birth },
      { label: 'Principal buyer citizenship', value: clientProfile.citizenship ?? clientProfile.buyer_citizenship },
      { label: 'Principal buyer gender', value: clientProfile.gender ?? clientProfile.buyer_gender },
      { label: 'Principal buyer civil status', value: clientProfile.civilStatus ?? clientProfile.buyer_civil_status },
      { label: 'Principal buyer mobile number', value: clientProfile.contactNo ?? clientProfile.buyer_contact_number },
      { label: 'Principal buyer residence phone number', value: clientProfile.residencePhoneNumber ?? clientProfile.buyer_residence_phone_number },
      { label: 'Principal buyer email', value: clientProfile.email ?? clientProfile.buyer_email },
      { label: 'Principal buyer TIN', value: clientProfile.tin ?? clientProfile.buyer_tin },
      { label: 'Principal buyer present address', value: clientProfile.presentAddress ?? clientProfile.buyer_present_address },
      { label: 'Principal buyer present ZIP code', value: clientProfile.presentZipCode ?? clientProfile.buyer_present_zip_code },
      { label: 'Principal buyer permanent address', value: clientProfile.permanentAddress ?? clientProfile.buyer_permanent_address },
      { label: 'Principal buyer permanent ZIP code', value: clientProfile.permanentZipCode ?? clientProfile.buyer_permanent_zip_code },
      { label: 'Principal buyer employment status', value: clientProfile.employmentStatus ?? clientProfile.buyer_employment_status },
      { label: 'Principal buyer employer / business name', value: clientProfile.employerBusinessName ?? clientProfile.buyer_employer_business_name },
      { label: 'Principal buyer employer ZIP code', value: clientProfile.employerZipCode ?? clientProfile.buyer_employer_zip_code },
      { label: 'Principal buyer nature of work / business', value: clientProfile.natureOfWorkBusiness ?? clientProfile.buyer_nature_of_work_business },
      { label: 'Principal buyer occupation / position / title', value: clientProfile.occupationPositionTitle ?? clientProfile.buyer_occupation_position },
      { label: 'Principal buyer monthly income', value: clientProfile.monthlyIncome ?? clientProfile.buyer_monthly_income },
      { label: 'Principal buyer employer / business address', value: clientProfile.employerBusinessAddress ?? clientProfile.buyer_employer_business_address },
    ];

    const missingPrincipalField = firstMissingRequiredField(principalRequiredFields);
    if (missingPrincipalField) {
      return res.status(400).json({ message: `${missingPrincipalField.label} is required.` });
    }

    if (hasSecondBuyer) {
      const secondBuyerRequiredFields = [
        { label: 'Spouse / second buyer role', value: clientProfile.secondBuyerRole ?? clientProfile.second_buyer_role },
        { label: 'Spouse / second buyer first name', value: secondBuyerFirstName },
        { label: 'Spouse / second buyer middle name', value: secondBuyerMiddleName },
        { label: 'Spouse / second buyer last name', value: secondBuyerLastName },
        { label: 'Spouse / second buyer suffix', value: secondBuyerSuffix },
        { label: 'Spouse / second buyer birth date', value: clientProfile.secondBuyerBirthDate ?? clientProfile.second_buyer_birth_date },
        { label: 'Spouse / second buyer place of birth', value: clientProfile.secondBuyerPlaceOfBirth ?? clientProfile.second_buyer_place_of_birth },
        { label: 'Spouse / second buyer citizenship', value: clientProfile.secondBuyerCitizenship ?? clientProfile.second_buyer_citizenship },
        { label: 'Spouse / second buyer gender', value: clientProfile.secondBuyerGender ?? clientProfile.second_buyer_gender },
        { label: 'Spouse / second buyer civil status', value: clientProfile.secondBuyerCivilStatus ?? clientProfile.second_buyer_civil_status },
        { label: 'Spouse / second buyer mobile number', value: clientProfile.secondBuyerContactNo ?? clientProfile.second_buyer_contact_number },
        { label: 'Spouse / second buyer residence phone number', value: clientProfile.secondBuyerResidencePhoneNumber ?? clientProfile.second_buyer_residence_phone_number },
        { label: 'Spouse / second buyer email', value: clientProfile.secondBuyerEmail ?? clientProfile.second_buyer_email },
        { label: 'Spouse / second buyer TIN', value: clientProfile.secondBuyerTin ?? clientProfile.second_buyer_tin },
        { label: 'Spouse / second buyer present address', value: clientProfile.secondBuyerPresentAddress ?? clientProfile.second_buyer_present_address },
        { label: 'Spouse / second buyer present ZIP code', value: clientProfile.secondBuyerPresentZipCode ?? clientProfile.second_buyer_present_zip_code },
        { label: 'Spouse / second buyer permanent address', value: clientProfile.secondBuyerPermanentAddress ?? clientProfile.second_buyer_permanent_address },
        { label: 'Spouse / second buyer permanent ZIP code', value: clientProfile.secondBuyerPermanentZipCode ?? clientProfile.second_buyer_permanent_zip_code },
        { label: 'Spouse / second buyer employment status', value: clientProfile.secondBuyerEmploymentStatus ?? clientProfile.second_buyer_employment_status },
        { label: 'Spouse / second buyer employer / business name', value: clientProfile.secondBuyerEmployerBusinessName ?? clientProfile.second_buyer_employer_business_name },
        { label: 'Spouse / second buyer employer ZIP code', value: clientProfile.secondBuyerEmployerZipCode ?? clientProfile.second_buyer_employer_zip_code },
        { label: 'Spouse / second buyer nature of work / business', value: clientProfile.secondBuyerNatureOfWorkBusiness ?? clientProfile.second_buyer_nature_of_work_business },
        { label: 'Spouse / second buyer occupation / position / title', value: clientProfile.secondBuyerOccupationPositionTitle ?? clientProfile.second_buyer_occupation_position },
        { label: 'Spouse / second buyer monthly income', value: clientProfile.secondBuyerMonthlyIncome ?? clientProfile.second_buyer_monthly_income },
        { label: 'Spouse / second buyer employer / business address', value: clientProfile.secondBuyerEmployerBusinessAddress ?? clientProfile.second_buyer_employer_business_address },
      ];

      const missingSecondBuyerField = firstMissingRequiredField(secondBuyerRequiredFields);
      if (missingSecondBuyerField) {
        return res.status(400).json({ message: `${missingSecondBuyerField.label} is required.` });
      }
    }

    const modeOfPayment = reservation.modeOfPayment === 'cash' || terms.modeOfPayment === 'cash' ? 'cash' : 'installment';
    const isCash = modeOfPayment === 'cash';
    const reservationFee = parseMoneyValue(terms.reservationFee || listing.lot_project_listing_reservation_fee || 0);
    const downpaymentPercentage = isCash
      ? 0
      : Number(
          terms.downpaymentPercentage ?? normalizeNumberOption(terms.downpaymentPercentageMode, terms.customDownpaymentPercentage, 30)
        );
    const downpaymentTerms = isCash
      ? 0
      : Number(
          terms.downpaymentTerms ?? normalizeNumberOption(terms.downpaymentTermsMode, terms.customDownpaymentTerms, 3)
        );
    const monthlyTerms = isCash
      ? 0
      : Number(
          terms.monthlyTerms ?? normalizeNumberOption(terms.monthlyTermsMode, terms.customMonthlyTerms, 36)
        );
    const dpDiscountPercentage = isCash ? 0 : parseMoneyValue(terms.dpDiscountPercentage || 0);
    const reservationFeeAppliedToDownpayment = !isCash && (
      terms.reservationFeeTreatment === 'apply_to_downpayment' ||
      terms.reservationFeeAppliedToDownpayment === true ||
      Number(terms.reservationFeeAppliedToDownpayment || terms.soa_reservation_fee_applied_to_downpayment || 0) === 1
    );
    const legalMiscFeeMode = String(terms.legalMiscFeeMode || terms.legalMiscFee || 'include_in_monthly') === 'separate_soa_row'
      ? 'separate_soa_row'
      : 'include_in_monthly';
    const legalMiscFeeAmount = parseMoneyValue(terms.legalMiscFeeAmount || listing.lot_project_listing_lmf_amount || 0);
    const allowedDailyPenaltyRates = new Set([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5]);
    const dailyPenaltyRate = Number(terms.dailyPenaltyRate ?? terms.penaltyRatePercent ?? 0.1);
    const penaltyGraceDays = Number(terms.penaltyGraceDays ?? 1);
    if (!allowedDailyPenaltyRates.has(dailyPenaltyRate)) {
      return res.status(400).json({ message: 'Select a valid daily penalty rate.' });
    }
    if (!Number.isInteger(penaltyGraceDays) || penaltyGraceDays < 1 || penaltyGraceDays > 31) {
      return res.status(400).json({ message: 'Penalty grace period must be between 1 and 31 days.' });
    }
    const assignedSellerId = Number(terms.sellerId || reservation.sellerId || reservation.seller?.id || reservation.seller?.accredited_seller_id || 0) || null;
    const saleChannel = String(reservation.saleChannel || terms.saleChannel || 'distributed') === 'direct_to_developer'
      ? 'direct_to_developer'
      : 'distributed';

    if (!assignedSellerId) {
      return res.status(400).json({ message: 'Assigned seller / unit manager is required.' });
    }

    if (await tableExists(connection, 'accredited_sellers')) {
      const [sellerRows] = await connection.query(
        `
          SELECT
            acs.accredited_seller_id,
            acs.accredited_seller_status,
            u.id AS user_id,
            u.role,
            u.status AS user_status,
            sg.seller_group_name,
            sg.seller_group_status
          FROM accredited_sellers acs
          INNER JOIN users u ON u.id = acs.user_id
          LEFT JOIN seller_groups sg ON sg.seller_group_id = acs.seller_group_id
          WHERE acs.accredited_seller_id = ?
          LIMIT 1
        `,
        [assignedSellerId]
      );

      const assignedSeller = sellerRows[0];
      if (!assignedSeller || assignedSeller.accredited_seller_status !== 'active' || assignedSeller.user_status !== 'active') {
        return res.status(400).json({ message: 'Assigned seller / unit manager is not active.' });
      }
    }

    const tableName = 'lot_project_client_profiles';
    if (reservationFeeAppliedToDownpayment && !(await columnExists(connection, tableName, 'soa_reservation_fee_applied_to_downpayment'))) {
      return res.status(400).json({
        message: 'Reservation fee deduction from downpayment needs the latest database migration.',
      });
    }
    const listingInterestRate = parseMoneyValue(listing.annual_interest_rate || 0);
    const selectedInterestRate = isCash
      ? 0
      : parseMoneyValue(terms.interestRate || listingInterestRate || 0);
    const interestRateOverridden = !isCash && terms.interestRate !== undefined && terms.interestRate !== null && terms.interestRate !== '' && Math.abs(selectedInterestRate - listingInterestRate) > 0.0001 ? 1 : 0;

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
      toNullable(buyerFirstName),
      toNullable(buyerMiddleName),
      toNullable(buyerLastName),
      toNullable(buyerSuffix),
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
      hasSecondBuyer ? toNullable(secondBuyerFirstName) : null,
      hasSecondBuyer ? toNullable(secondBuyerMiddleName) : null,
      hasSecondBuyer ? toNullable(secondBuyerLastName) : null,
      hasSecondBuyer ? toNullable(secondBuyerSuffix) : null,
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
      selectedInterestRate,
      dpDiscountPercentage,
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
    await addIfColumnExists(connection, tableName, columns, values, 'assigned_accredited_seller_id', assignedSellerId);
    await addIfColumnExists(connection, tableName, columns, values, 'sale_channel', saleChannel);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_reservation_fee_applied_to_downpayment', reservationFeeAppliedToDownpayment ? 1 : 0);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_legal_misc_fee_mode', legalMiscFeeMode);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_legal_misc_fee_amount', legalMiscFeeAmount);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_interest_rate_overridden', interestRateOverridden);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_penalty_rate_percent', dailyPenaltyRate);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_penalty_grace_days', penaltyGraceDays);
    await addIfColumnExists(connection, tableName, columns, values, 'soa_penalty_calculation_method', 'daily');

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

    await replaceReservationSchedules(connection, project.lot_project_id, listing, clientProfileId, {
      buyerName,
      modeOfPayment,
      reservationFee,
      startingDate: dateOrNull(terms.startingDate) || new Date().toISOString().slice(0, 10),
      firstDueDate: dateOrNull(terms.firstDueDate) || new Date().toISOString().slice(0, 10),
      downpaymentPercentage: Number.isNaN(downpaymentPercentage) ? 30 : downpaymentPercentage,
      downpaymentTerms: Number.isNaN(downpaymentTerms) ? 3 : downpaymentTerms,
      monthlyTerms: Number.isNaN(monthlyTerms) ? 36 : monthlyTerms,
      annualInterestRate: selectedInterestRate,
      dpDiscountPercentage,
      reservationFeeAppliedToDownpayment,
      legalMiscFeeMode,
      legalMiscFeeAmount,
    });

    await replaceReservationCommissions(
      connection,
      project.lot_project_id,
      listing,
      clientProfileId,
      assignedSellerId,
      saleChannel
    );

    await writeAuditLog(connection, req, {
      action: 'create',
      module: 'Reservations',
      entityType: 'lot_project_listing',
      entityId: String(listing.lot_project_listing_id),
      entityLabel: `Unit ${listing.lot_project_listing_unit_id} — ${buyerName}`,
      title: 'Reserved listing for client',
      description: `Reserved ${listing.lot_project_listing_unit_id} for ${buyerName}.`,
      metadata: {
        clientProfileId,
        buyerName,
        buyerType,
        modeOfPayment,
        reservationFeeAppliedToDownpayment,
        assignedSellerId,
        saleChannel,
        dailyPenaltyRate,
        penaltyGraceDays,
        penaltyCalculationMethod: 'daily',
      },
    });

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
