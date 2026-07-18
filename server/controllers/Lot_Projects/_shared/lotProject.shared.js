import { db } from '../../../db/connect.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';

export { db, jwt, bcrypt };

export const getErrorMessage = (error) => {
  if (error?.statusCode && error?.message) return error.message;
  if (error?.code === 'ER_DUP_ENTRY') return 'Duplicate project name, slug, location code, or unit ID.';
  if (String(error?.code || '').startsWith('ER_') || error?.sqlMessage || error?.sql) {
    return 'Database operation failed. Please check the saved data and try again.';
  }
  return error?.message || 'Something went wrong.';
};

export const slugify = (value = '') =>
  String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const toNullable = (value) => {
  const clean = String(value || '').trim();
  return clean || null;
};

export const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const numberValue = Number(value);
  return Number.isNaN(numberValue) ? null : numberValue;
};

export const toActiveStatus = (value) => (value === 'inactive' ? 'inactive' : 'active');

export const tableExists = async (connection, tableName) => {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `,
    [tableName]
  );

  return Number(rows[0]?.total || 0) > 0;
};


export const columnExists = async (connection, tableName, columnName) => {
  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
    `,
    [tableName, columnName]
  );

  return Number(rows[0]?.total || 0) > 0;
};

export const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));

export const todayDateOnly = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

export const plainDate = (value, fallback = '-') => {
  if (!value) return fallback;
  if (typeof value === 'string') {
    const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
    return match ? match[1] : value.slice(0, 10);
  }
  return new Date(value).toISOString().slice(0, 10);
};

export const formatDateTime = (value) => {
  if (!value) return '-';
  if (typeof value === 'string') return value.replace('T', ' ').slice(0, 16);
  return new Date(value).toISOString().replace('T', ' ').slice(0, 16);
};

export const toDisplayValue = (value, fallback = '-') => {
  const clean = String(value ?? '').trim();
  return clean || fallback;
};

export const safeDeleteByProjectId = async (connection, tableName, lotProjectId) => {
  const allowedTables = new Set([
    'lot_project_settings',
    'lot_project_cadastral_lot_numbers',
    'lot_project_default_documents',
    'seller_group_lot_project_rates',
    'accredited_seller_lot_project_rates',
  ]);

  if (!allowedTables.has(tableName)) {
    throw new Error('Unsafe project delete operation blocked.');
  }

  const exists = await tableExists(connection, tableName);
  if (!exists) return;

  await connection.query(`DELETE FROM ${tableName} WHERE lot_project_id = ?`, [lotProjectId]);
};

export const normalizeProjectPayload = (body = {}) => {
  const name = String(body.lot_project_name || body.project_bailen_name || body.name || '').trim();

  return {
    name,
    slug: slugify(body.lot_project_slug || body.slug || name),
    location: String(body.lot_project_location || body.project_bailen_location || body.location || '').trim(),
    locationCode: String(body.lot_project_location_code || body.project_bailen_location_code || body.locationCode || '').trim().toUpperCase(),
    administrator: toNullable(body.lot_project_administrator_name || body.project_bailen_administrator_name || body.administrator),
    taxDeclarationNo: toNullable(body.lot_project_tax_declaration_no || body.project_bailen_tax_declaration_no || body.taxDeclarationNo),
    pin: toNullable(body.lot_project_pin || body.project_bailen_pin || body.pin),
    status: toActiveStatus(body.lot_project_status || body.project_bailen_status || body.status),
    cadastralLots: Array.isArray(body.cadastralLots)
      ? body.cadastralLots.map((item) => String(item).trim()).filter(Boolean)
      : Array.isArray(body.cadastral_lots)
        ? body.cadastral_lots.map((item) => String(item?.lotNumber || item?.lot_project_cadastral_lot_number || item).trim()).filter(Boolean)
        : [],
    defaultDocuments: Array.isArray(body.defaultDocuments)
      ? body.defaultDocuments
      : Array.isArray(body.default_documents)
        ? body.default_documents
        : Array.isArray(body.documents)
          ? body.documents
          : Array.isArray(body.selectedDocuments)
            ? body.selectedDocuments
            : [],
  };
};

export const getListingStatusLabel = (status = '', soldSubstatus = null) => {
  if (status === 'sold' && soldSubstatus === 'fully_paid') return 'Fully Paid';

  const map = {
    available: 'Available',
    hold: 'Hold',
    sold: 'Sold / Active',
    pending_for_cancellation: 'Pending Cancellation',
    cancelled: 'Cancelled',
  };

  return map[status] || status || 'Available';
};

export const normalizeLotType = (value = '') => {
  const clean = String(value || '').trim().toLowerCase();
  if (clean === 'corner') return 'Corner';
  if (clean === 'end') return 'End';
  return 'Inner';
};

export const lotTypeLabel = (value = '') => normalizeLotType(value);

export const normalizeListingStatusPayload = (value = '') => {
  const clean = String(value || 'available').trim().toLowerCase();

  if (clean === 'fully_paid') {
    return { status: 'sold', soldSubstatus: 'fully_paid' };
  }

  if (clean === 'sold_active' || clean === 'sold / active') {
    return { status: 'sold', soldSubstatus: 'active' };
  }

  const allowed = new Set([
    'available',
    'hold',
    'sold',
    'pending_for_cancellation',
    'cancelled',
  ]);

  return {
    status: allowed.has(clean) ? clean : 'available',
    soldSubstatus: clean === 'sold' ? 'active' : null,
  };
};

export const formatDocumentsLabel = (row = {}) => {
  const listingDocs = Number(row.listing_document_count || 0);
  const projectDocs = Number(row.project_default_document_count || 0);
  const requiredDocs = Number(row.project_required_document_count || 0);

  if (listingDocs > 0) return `${listingDocs} custom`;
  if (projectDocs > 0) return `${projectDocs} project default`;
  if (requiredDocs > 0) return `${requiredDocs} required`;
  return 'No checklist';
};

export const mapListingRow = (row = {}) => ({
  ...row,
  id: row.lot_project_listing_id,
  unitCode: row.lot_project_listing_unit_id,
  oldUnitIds: row.lot_project_listing_old_unit_ids || '-',
  lotType: lotTypeLabel(row.lot_project_listing_unit_type),
  cadastralLots: row.cadastral_lots
    ? String(row.cadastral_lots).split(',').map((item) => item.trim()).filter(Boolean)
    : [],
  area: Number(row.lot_project_listing_area_sqm || 0),
  pricePerSqm: Number(row.lot_project_listing_price_per_sqm || 0),
  netSellingPrice: Number(row.lot_project_listing_net_selling_price || 0),
  lmfRate: Number(row.lot_project_listing_lmf_rate || 0),
  lmfAmount: Number(row.lot_project_listing_lmf_amount || 0),
  tcp: Number(row.lot_project_listing_tcp || 0),
  reservationFee: Number(row.lot_project_listing_reservation_fee || 0),
  annualInterestRate: Number(row.annual_interest_rate || 0),
  buyer: row.buyer_full_name || row.buyer_name || 'No buyer yet',
  documentStatus: row.document_status || formatDocumentsLabel(row),
  status: getListingStatusLabel(row.lot_project_listing_status, row.lot_project_listing_sold_substatus),
  heldForName: row.hold_client_name || '',
  holdNote: row.hold_note || '',
  holdCreatedAt: row.hold_created_at ? plainDate(row.hold_created_at) : '',
  rawStatus: row.lot_project_listing_status,
  soldSubstatus: row.lot_project_listing_sold_substatus,
  routeId: row.lot_project_listing_id || row.lot_project_listing_unit_id,
});

export const mapProjectRows = (projects = [], cadastralRows = []) => {
  const cadastralMap = new Map();

  cadastralRows.forEach((row) => {
    if (!cadastralMap.has(row.lot_project_id)) {
      cadastralMap.set(row.lot_project_id, []);
    }

    cadastralMap.get(row.lot_project_id).push(row.lot_project_cadastral_lot_number);
  });

  return projects.map((project) => ({
    ...project,
    id: project.lot_project_id,
    type: 'lot',
    name: project.lot_project_name,
    slug: project.lot_project_slug,
    location: project.lot_project_location,
    locationCode: project.lot_project_location_code,
    administrator: project.lot_project_administrator_name,
    taxDeclarationNo: project.lot_project_tax_declaration_no,
    pin: project.lot_project_pin,
    status: project.lot_project_status,
    routePath: `/lot-projects/${project.lot_project_slug}`,
    cadastralLots: cadastralMap.get(project.lot_project_id) || [],
    defaultDocs: Number(project.default_documents_count || 0),
    requiredDocs: Number(project.required_documents_count || 0),
  }));
};

export const getProjectBySlug = async (slug) => {
  const [projectRows] = await db.query(
    `
      SELECT *
      FROM lot_projects
      WHERE lot_project_slug = ?
      LIMIT 1
    `,
    [slug]
  );

  return projectRows[0] || null;
};

export const getProjectDefaultDocuments = async (lotProjectId) => {
  const [defaultDocuments] = await db.query(
    `
      SELECT
        lpdd.lot_project_default_document_id,
        lpdd.lot_project_id,
        lpdd.document_id,
        lpdd.lot_project_default_document_is_required,
        lpdd.lot_project_default_document_status,
        d.document_name,
        d.document_description,
        d.document_status
      FROM lot_project_default_documents lpdd
      INNER JOIN documents d ON d.document_id = lpdd.document_id
      WHERE lpdd.lot_project_id = ?
      ORDER BY d.document_name ASC
    `,
    [lotProjectId]
  );

  return defaultDocuments.map((document) => ({
    ...document,
    id: document.document_id,
    name: document.document_name,
    description: document.document_description || 'Project Default',
    source: 'Project Default',
    requirement: document.lot_project_default_document_is_required ? 'required' : 'optional',
    status: document.lot_project_default_document_status || document.document_status || 'active',
  }));
};

export const getProjectCadastralLots = async (lotProjectId) => {
  const connection = await db.getConnection();

  try {
    const hasListingCadastralLinks = await tableExists(connection, 'lot_project_listing_cadastral_lots');

    if (!hasListingCadastralLinks) {
      const [rows] = await connection.query(
        `
          SELECT
            lot_project_cadastral_lot_number_id,
            lot_project_id,
            lot_project_cadastral_lot_number
          FROM lot_project_cadastral_lot_numbers
          WHERE lot_project_id = ?
          ORDER BY lot_project_cadastral_lot_number ASC
        `,
        [lotProjectId]
      );

      return rows.map((lot) => ({
        ...lot,
        id: lot.lot_project_cadastral_lot_number_id,
        lotNumber: lot.lot_project_cadastral_lot_number,
        status: 'active',
        usedCount: 0,
        usedByUnits: '',
      }));
    }

    const [cadastralLots] = await connection.query(
      `
        SELECT
          c.lot_project_cadastral_lot_number_id,
          c.lot_project_id,
          c.lot_project_cadastral_lot_number,
          COALESCE(COUNT(l.lot_project_listing_id), 0) AS usedCount,
          GROUP_CONCAT(l.lot_project_listing_unit_id ORDER BY l.lot_project_listing_unit_id SEPARATOR ', ') AS usedByUnits
        FROM lot_project_cadastral_lot_numbers c
        LEFT JOIN lot_project_listing_cadastral_lots lcl
          ON lcl.lot_project_cadastral_lot_number_id = c.lot_project_cadastral_lot_number_id
        LEFT JOIN lot_project_listings l
          ON l.lot_project_listing_id = lcl.lot_project_listing_id
        WHERE c.lot_project_id = ?
        GROUP BY c.lot_project_cadastral_lot_number_id, c.lot_project_id, c.lot_project_cadastral_lot_number
        ORDER BY c.lot_project_cadastral_lot_number ASC
      `,
      [lotProjectId]
    );

    return cadastralLots.map((lot) => ({
      ...lot,
      id: lot.lot_project_cadastral_lot_number_id,
      lotNumber: lot.lot_project_cadastral_lot_number,
      status: 'active',
      usedCount: Number(lot.usedCount || 0),
      usedByUnits: lot.usedByUnits || '',
    }));
  } finally {
    connection.release();
  }
};


export const getListingLookupWhere = (value, alias = 'l') => {
  const clean = String(value || '').trim();
  const requestedAlias = String(alias || '').trim();
  const safeAlias = /^[A-Za-z_][A-Za-z0-9_]*$/.test(requestedAlias) ? requestedAlias : '';
  const column = (columnName) => (safeAlias ? `${safeAlias}.${columnName}` : columnName);

  if (/^\d+$/.test(clean)) {
    return {
      sql: `${column('lot_project_listing_id')} = ?`,
      params: [Number(clean)],
    };
  }

  return {
    sql: `${column('lot_project_listing_unit_id')} = ?`,
    params: [clean.toUpperCase()],
  };
};

export const computeAgeFromDate = (birthDate) => {
  if (!birthDate) return '-';

  const birth = new Date(birthDate);
  const today = new Date();

  if (Number.isNaN(birth.getTime())) return '-';

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : '-';
};

export const getClientCompletionStatus = (profile = {}) => {
  const buyerType = profile.buyer_type || 'single';
  const hasSecondBuyer = buyerType === 'spouses' || buyerType === 'and_account';

  const required = [
    profile.buyer_full_name,
    profile.buyer_contact_number,
    profile.buyer_email,
    profile.buyer_present_address,
  ];

  if (hasSecondBuyer) {
    required.push(
      profile.second_buyer_full_name,
      profile.second_buyer_contact_number,
      profile.second_buyer_email
    );
  }

  return required.some((value) => !String(value || '').trim()) ? 'incomplete' : 'complete';
};

const legacyNameSuffixes = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v']);
const legacyCompoundSurnamePrefixes = new Set(['san', 'santa', 'de', 'del', 'dela', 'da', 'dos', 'das', 'la', 'las', 'los', 'van', 'von']);

const parseLegacyBuyerName = (value = '') => {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  if (!clean) return { firstName: '', middleName: '', lastName: '', suffix: '' };

  if (clean.includes(',')) {
    const [lastPart, ...remainingParts] = clean.split(',');
    const remaining = remainingParts.join(' ').trim().split(/\s+/).filter(Boolean);
    let suffix = '';

    if (remaining.length && legacyNameSuffixes.has(remaining[remaining.length - 1].toLowerCase())) {
      suffix = remaining.pop();
    }

    return {
      lastName: lastPart.trim(),
      firstName: remaining.shift() || '',
      middleName: remaining.join(' '),
      suffix,
    };
  }

  const parts = clean.split(' ').filter(Boolean);
  let suffix = '';

  if (parts.length && legacyNameSuffixes.has(parts[parts.length - 1].toLowerCase())) {
    suffix = parts.pop();
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '', suffix };
  }

  const firstName = parts.shift() || '';
  let surnameTokenCount = 1;
  const lowerParts = parts.map((part) => part.toLowerCase());

  if (
    lowerParts.length >= 3 &&
    lowerParts[lowerParts.length - 3] === 'de' &&
    ['la', 'las', 'los'].includes(lowerParts[lowerParts.length - 2])
  ) {
    surnameTokenCount = 3;
  } else if (
    lowerParts.length >= 2 &&
    legacyCompoundSurnamePrefixes.has(lowerParts[lowerParts.length - 2])
  ) {
    surnameTokenCount = 2;
  }

  const lastName = parts.splice(-surnameTokenCount).join(' ');

  return {
    firstName,
    lastName,
    middleName: parts.join(' '),
    suffix,
  };
};

export const mapClientProfile = (profile = {}, sellerName = '-') => {
  const buyerNameParts = parseLegacyBuyerName(profile.buyer_full_name);
  const secondBuyerNameParts = parseLegacyBuyerName(profile.second_buyer_full_name);
  const buyerFirstName = profile.buyer_first_name || buyerNameParts.firstName;
  const buyerMiddleName = profile.buyer_middle_name || buyerNameParts.middleName;
  const buyerLastName = profile.buyer_last_name || buyerNameParts.lastName;
  const buyerSuffix = profile.buyer_suffix || buyerNameParts.suffix;
  const secondBuyerFirstName = profile.second_buyer_first_name || secondBuyerNameParts.firstName;
  const secondBuyerMiddleName = profile.second_buyer_middle_name || secondBuyerNameParts.middleName;
  const secondBuyerLastName = profile.second_buyer_last_name || secondBuyerNameParts.lastName;
  const secondBuyerSuffix = profile.second_buyer_suffix || secondBuyerNameParts.suffix;

  return {
    id: profile.lot_project_client_profile_id || null,
    lot_project_client_profile_id: profile.lot_project_client_profile_id || null,
    profileStatus: getClientCompletionStatus(profile),
    accountStatus: profile.lot_project_client_profile_status || 'active',
    buyerType: profile.buyer_type || 'single',
    buyerRole: 'Principal Buyer',
    buyerFirstName,
    buyerMiddleName,
    buyerLastName,
    buyerSuffix,
    buyerName: profile.buyer_full_name || [buyerFirstName, buyerMiddleName, buyerLastName, buyerSuffix].filter(Boolean).join(' '),
    birthDate: plainDate(profile.buyer_birth_date) === '-' ? '' : plainDate(profile.buyer_birth_date),
    placeOfBirth: profile.buyer_place_of_birth || '',
    computedAge: computeAgeFromDate(profile.buyer_birth_date),
    citizenship: profile.buyer_citizenship || '',
    gender: profile.buyer_gender || '',
    civilStatus: profile.buyer_civil_status || '',
    contactNo: profile.buyer_contact_number || '',
    residencePhoneNumber: profile.buyer_residence_phone_number || '',
    email: profile.buyer_email || '',
    tin: profile.buyer_tin || '',
    presentAddress: profile.buyer_present_address || '',
    presentZipCode: profile.buyer_present_zip_code || '',
    permanentAddress: profile.buyer_permanent_address || '',
    permanentZipCode: profile.buyer_permanent_zip_code || '',
    employmentStatus: profile.buyer_employment_status || '',
    employerBusinessName: profile.buyer_employer_business_name || '',
    employerZipCode: profile.buyer_employer_zip_code || '',
    natureOfWorkBusiness: profile.buyer_nature_of_work_business || '',
    occupationPositionTitle: profile.buyer_occupation_position || '',
    monthlyIncome: profile.buyer_monthly_income !== undefined && profile.buyer_monthly_income !== null ? String(profile.buyer_monthly_income) : '',
    employerBusinessAddress: profile.buyer_employer_business_address || '',
    secondBuyerRole: profile.second_buyer_role || (profile.buyer_type === 'spouses' ? 'spouse' : 'co_owner'),
    secondBuyerFirstName,
    secondBuyerMiddleName,
    secondBuyerLastName,
    secondBuyerSuffix,
    secondBuyerName: profile.second_buyer_full_name || [secondBuyerFirstName, secondBuyerMiddleName, secondBuyerLastName, secondBuyerSuffix].filter(Boolean).join(' '),
    secondBuyerBirthDate: plainDate(profile.second_buyer_birth_date) === '-' ? '' : plainDate(profile.second_buyer_birth_date),
    secondBuyerPlaceOfBirth: profile.second_buyer_place_of_birth || '',
    secondBuyerComputedAge: computeAgeFromDate(profile.second_buyer_birth_date),
    secondBuyerCitizenship: profile.second_buyer_citizenship || '',
    secondBuyerGender: profile.second_buyer_gender || '',
    secondBuyerCivilStatus: profile.second_buyer_civil_status || '',
    secondBuyerContactNo: profile.second_buyer_contact_number || '',
    secondBuyerResidencePhoneNumber: profile.second_buyer_residence_phone_number || '',
    secondBuyerEmail: profile.second_buyer_email || '',
    secondBuyerTin: profile.second_buyer_tin || '',
    secondBuyerPresentAddress: profile.second_buyer_present_address || '',
    secondBuyerPresentZipCode: profile.second_buyer_present_zip_code || '',
    secondBuyerPermanentAddress: profile.second_buyer_permanent_address || '',
    secondBuyerPermanentZipCode: profile.second_buyer_permanent_zip_code || '',
    secondBuyerEmploymentStatus: profile.second_buyer_employment_status || '',
    secondBuyerEmployerBusinessName: profile.second_buyer_employer_business_name || '',
    secondBuyerEmployerZipCode: profile.second_buyer_employer_zip_code || '',
    secondBuyerNatureOfWorkBusiness: profile.second_buyer_nature_of_work_business || '',
    secondBuyerOccupationPositionTitle: profile.second_buyer_occupation_position || '',
    secondBuyerMonthlyIncome: profile.second_buyer_monthly_income !== undefined && profile.second_buyer_monthly_income !== null ? String(profile.second_buyer_monthly_income) : '',
    secondBuyerEmployerBusinessAddress: profile.second_buyer_employer_business_address || '',
    seller: sellerName || '-',
  };
};

export const canEditBuyerProfileForListing = (status) => {
  const statusKey = String(status || '').trim().toLowerCase();
  return Boolean(statusKey && !['available', 'hold'].includes(statusKey));
};


export const getCommissionStatusLabel = (status = '') => {
  const labels = {
    Pending: 'Not Eligible',
    Eligible: 'Eligible',
    'Partially Released': 'Partial',
    Released: 'Completed',
    'On Hold': 'On Hold',
    Cancelled: 'Cancelled',
  };
  return labels[status] || status || '-';
};

export const mapProfileListing = (row = {}, project = {}, documents = []) => {
  const area = Number(row.lot_project_listing_area_sqm || 0);
  const pricePerSqm = Number(row.lot_project_listing_price_per_sqm || 0);
  const netSellingPrice = Number(row.lot_project_listing_net_selling_price || 0);
  const lmfRate = Number(row.lot_project_listing_lmf_rate || 0);
  const lmfAmount = Number(row.lot_project_listing_lmf_amount || 0);
  const tcp = Number(row.lot_project_listing_tcp || 0);
  const reservationFee = Number(row.lot_project_listing_reservation_fee || 0);
  const annualInterestRate = Number(row.annual_interest_rate || 0);
  const totalPaid = Number(row.total_paid || 0);
  const balance = Math.max(tcp - totalPaid, 0);
  const paymentCount = Number(row.payment_count || 0);
  const submittedDocuments = documents.filter((doc) => doc.status === 'Submitted' || doc.status === 'Approved').length;
  const approvedDocuments = documents.filter((doc) => doc.status === 'Approved').length;
  const requiredDocuments = documents.filter((doc) => doc.requirement === 'Required').length;
  const missingRequired = documents.filter((doc) => doc.requirement === 'Required' && doc.status === 'Missing').length;
  const listingStatus = getListingStatusLabel(row.lot_project_listing_status, row.lot_project_listing_sold_substatus);
  const hasClientProfile = Boolean(row.lot_project_client_profile_id || row.buyer_full_name);
  const canEditBuyerProfile = canEditBuyerProfileForListing(row.lot_project_listing_status);
  const canUsePayments = hasClientProfile && canEditBuyerProfile;

  return {
    ...row,
    id: row.lot_project_listing_id,
    lot_project_listing_id: row.lot_project_listing_id,
    lot_project_client_profile_id: row.lot_project_client_profile_id || null,
    clientProfileId: row.lot_project_client_profile_id || null,
    hasClientProfile,
    canEditBuyerProfile,
    canUsePayments,
    unit_id: row.lot_project_listing_unit_id,
    unitCode: row.lot_project_listing_unit_id,
    project_name: project.lot_project_name,
    projectName: project.lot_project_name,
    project_location: project.lot_project_location,
    locationCode: project.lot_project_location_code,
    administrator: project.lot_project_administrator_name || '-',
    cadastral_lot_no: row.cadastral_lots || '-',
    old_unit_ids: row.lot_project_listing_old_unit_ids || '-',
    lot_type: normalizeLotType(row.lot_project_listing_unit_type),
    listing_status: listingStatus,
    heldForName: row.hold_client_name || '',
    holdNote: row.hold_note || '',
    holdCreatedAt: row.hold_created_at ? plainDate(row.hold_created_at) : '',
    rawStatus: row.lot_project_listing_status,
    soldSubstatus: row.lot_project_listing_sold_substatus,
    status: listingStatus,
    lot_area_sqm: `${area} sqm`,
    lotAreaSqm: area,
    area,
    price_per_sqm: money(pricePerSqm),
    pricePerSqm,
    net_selling_price: money(netSellingPrice),
    netSellingPrice,
    lmf_rate: `${lmfRate}%`,
    lmfRate,
    legalMiscRate: lmfRate,
    lmf_amount: money(lmfAmount),
    lmfAmount,
    tcp: money(tcp),
    tcpAmount: tcp,
    reservationFee,
    annualInterestRate,
    interestRate: `${annualInterestRate.toFixed(2)}%`,
    soaModeOfPayment: row.soa_mode_of_payment || 'installment',
    modeOfPayment: row.soa_mode_of_payment || 'installment',
    soaReservationFee: Number(row.soa_reservation_fee || reservationFee || 0),
    soaReservationFeeAppliedToDownpayment: Number(row.soa_reservation_fee_applied_to_downpayment || 0) === 1,
    reservationFeeTreatment: Number(row.soa_reservation_fee_applied_to_downpayment || 0) === 1
      ? 'apply_to_downpayment'
      : 'separate',
    soaStartingDate: row.soa_starting_date ? plainDate(row.soa_starting_date) : '-',
    soaFirstDueDate: row.soa_first_due_date ? plainDate(row.soa_first_due_date) : '-',
    soaDownpaymentPercentage: Number(row.soa_downpayment_percentage || 0),
    soaDownpaymentTerms: Number(row.soa_downpayment_terms || 0),
    soaMonthlyTerms: Number(row.soa_monthly_terms || 0),
    soaAnnualInterestRate: Number(Number(row.soa_interest_rate_overridden || 0) === 1 ? row.soa_annual_interest_rate : annualInterestRate),
    soaListingAnnualInterestRate: annualInterestRate,
    soaInterestRateSource: Number(row.soa_interest_rate_overridden || 0) === 1 ? 'custom' : 'listing',
    soaInterestRateOverridden: Number(row.soa_interest_rate_overridden || 0) === 1,
    soaDpDiscountPercentage: Number(row.soa_dp_discount_percentage || 0),
    soaPenaltyRatePercent: Number(row.soa_penalty_rate_percent || 0),
    soaPenaltyGraceDays: Number(row.soa_penalty_grace_days || 0),
    soaPenaltyCalculationMethod: row.soa_penalty_calculation_method || (Number(row.soa_penalty_rate_percent || 0) > 0 ? 'monthly_started' : 'none'),
    buyer_name: row.buyer_full_name || '-',
    spouse_co_owner: row.second_buyer_full_name || '-',
    email: row.buyer_email || '-',
    contact_no: row.buyer_contact_number || '-',
    address: row.buyer_present_address || '-',
    assigned_user: row.assigned_user_name || row.seller_name || '-',
    due_day: row.first_due_date ? plainDate(row.first_due_date) : row.soa_first_due_date ? plainDate(row.soa_first_due_date) : '-',
    first_due_date: row.first_due_date ? plainDate(row.first_due_date) : row.soa_first_due_date ? plainDate(row.soa_first_due_date) : '-',
    total_paid: money(totalPaid),
    totalPaid,
    balance: money(balance),
    balanceAmount: balance,
    payment_status: paymentCount === 0 ? 'Unpaid' : balance <= 0 ? 'Paid' : 'Partial',
    payment_count: String(paymentCount),
    latest_payment_date: row.latest_payment_date ? plainDate(row.latest_payment_date) : '-',
    latest_payment_amount: money(row.latest_payment_amount || 0),
    seller: row.seller_name || '-',
    seller_role: row.seller_role || '-',
    seller_email: row.seller_email || '-',
    seller_contact_no: row.seller_contact_no || '-',
    seller_tin_no: row.seller_tin_no || '-',
    sellerTinNo: row.seller_tin_no || '-',
    sellerFirstName: row.seller_first_name || '',
    sellerMiddleName: row.seller_middle_name || '',
    sellerLastName: row.seller_last_name || '',
    sellerPrcNo: row.seller_prc_no || '',
    sellerAddress: row.seller_address || '',
    seller_group: row.seller_group_name || '-',
    seller_status: row.seller_status || '-',
    seller_accreditation_date: row.seller_accreditation_date ? plainDate(row.seller_accreditation_date) : '-',
    reports_under: row.reports_under || '-',
    sale_channel: row.sale_channel || '-',
    commission_rate: row.commission_rate ? `${Number(row.commission_rate)}%` : '-',
    commission_amount: money(row.gross_commission_amount || 0),
    released_amount: money(row.released_amount || 0),
    remaining_commission: money(Math.max(Number(row.gross_commission_amount || 0) - Number(row.released_amount || 0), 0)),
    commission_status: getCommissionStatusLabel(row.commission_status),
    commission_status_raw: row.commission_status || '-',
    total_documents: String(documents.length),
    required_documents: String(requiredDocuments),
    submitted_documents: String(submittedDocuments),
    approved_documents: String(approvedDocuments),
    missing_required: String(missingRequired),
    document_status: missingRequired > 0 ? 'Incomplete' : documents.length ? 'Complete' : 'No checklist',
    created_at: formatDateTime(row.lot_project_listing_created_at),
    updated_at: formatDateTime(row.lot_project_listing_updated_at),
    client_unit_created: formatDateTime(row.lot_project_client_profile_created_at),
    client_unit_updated: formatDateTime(row.lot_project_client_profile_updated_at),
  };
};


const normalizeClientDocumentImageEntries = (fileUrlValue, fileNameValue = '') => {
  const fallbackFileName = String(fileNameValue || '').trim();
  const raw = String(fileUrlValue || '').trim();
  if (!raw) return [];

  const toEntry = (item, index = 0) => {
    if (!item) return null;

    if (typeof item === 'string') {
      const url = item.trim();
      if (!url) return null;
      return {
        url,
        fileName: fallbackFileName || `Document Image ${index + 1}`,
      };
    }

    if (typeof item === 'object') {
      const url = String(item.url || item.secure_url || item.fileUrl || item.file_url || '').trim();
      if (!url) return null;
      return {
        ...item,
        url,
        fileName: item.fileName || item.file_name || item.originalFilename || item.original_filename || fallbackFileName || `Document Image ${index + 1}`,
      };
    }

    return null;
  };

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.map(toEntry).filter(Boolean);
    const single = toEntry(parsed, 0);
    return single ? [single] : [];
  } catch {
    return [{ url: raw, fileName: fallbackFileName || 'Document Image 1' }];
  }
};

export const parseClientDocumentImages = (fileUrlValue, fileNameValue = '') =>
  normalizeClientDocumentImageEntries(fileUrlValue, fileNameValue);

export const getListingDocuments = async (connection, lotProjectId, listingId, clientProfileId) => {
  const hasListingDocuments = await tableExists(connection, 'lot_project_listing_documents');
  const hasClientDocuments = await tableExists(connection, 'lot_project_client_documents');

  if (!hasListingDocuments) return [];

  const clientDocumentJoin = hasClientDocuments && clientProfileId
    ? `
        LEFT JOIN lot_project_client_documents cd
          ON cd.document_id = d.document_id
          AND cd.lot_project_listing_id = lpd.lot_project_listing_id
          AND cd.lot_project_client_profile_id = ?
      `
    : `LEFT JOIN (SELECT NULL AS document_id, NULL AS lot_project_client_document_file_name, NULL AS lot_project_client_document_file_url, 'Missing' AS lot_project_client_document_status) cd ON 1 = 0`;

  const params = hasClientDocuments && clientProfileId
    ? [clientProfileId, lotProjectId, listingId]
    : [lotProjectId, listingId];

  const [rows] = await connection.query(
    `
      SELECT
        lpd.lot_project_listing_document_id,
        lpd.document_id,
        lpd.lot_project_listing_document_is_required,
        d.document_name,
        d.document_description,
        cd.lot_project_client_document_file_name,
        cd.lot_project_client_document_file_url,
        cd.lot_project_client_document_status
      FROM lot_project_listing_documents lpd
      INNER JOIN documents d ON d.document_id = lpd.document_id
      ${clientDocumentJoin}
      WHERE lpd.lot_project_id = ?
        AND lpd.lot_project_listing_id = ?
        AND lpd.lot_project_listing_document_status = 'active'
      ORDER BY lpd.lot_project_listing_document_is_required DESC, d.document_name ASC
    `,
    params
  );

  return rows.map((document) => {
    const imageEntries = parseClientDocumentImages(
      document.lot_project_client_document_file_url,
      document.lot_project_client_document_file_name
    );
    const imageUrls = imageEntries.map((image) => image.url).filter(Boolean);

    return {
      id: document.lot_project_listing_document_id,
      document_id: document.document_id,
      name: document.document_name,
      description: document.document_description || 'Document requirement',
      requirement: document.lot_project_listing_document_is_required ? 'Required' : 'Optional',
      status: document.lot_project_client_document_status || 'Missing',
      fileName: document.lot_project_client_document_file_name || (imageEntries.length ? `${imageEntries.length} file(s)` : '-'),
      fileUrl: imageUrls[0] || '',
      images: imageUrls,
      imageEntries,
      imageCount: imageUrls.length,
    };
  });
};

export const roundMoneyValue = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

export const normalizeDateInput = (value) => {
  if (!value || value === '-') return todayDateOnly();

  if (typeof value === 'string') {
    const clean = value.trim();
    const isoMatch = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

    const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch;
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
    }
  }

  return new Date(value).toISOString().slice(0, 10);
};

export const addMonthsToDate = (value, months = 0) => {
  const [y, m, d] = normalizeDateInput(value).split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const originalDay = date.getUTCDate();

  date.setUTCMonth(date.getUTCMonth() + Number(months || 0));

  if (date.getUTCDate() !== originalDay) {
    date.setUTCDate(0);
  }

  return date.toISOString().slice(0, 10);
};

export const getOrdinalLabel = (number) => {
  const value = Number(number || 0);
  const lastTwo = value % 100;

  if (lastTwo >= 11 && lastTwo <= 13) return `${value}th`;

  const last = value % 10;
  if (last === 1) return `${value}st`;
  if (last === 2) return `${value}nd`;
  if (last === 3) return `${value}rd`;
  return `${value}th`;
};

export const getScheduleTotalDue = (row = {}) => {
  const penalty = Number(row.penalty ?? row.penaltyAmount ?? row.penalty_amount ?? 0);
  const dueAmount = Number(row.dueAmount ?? row.due_amount ?? 0);
  const discountAmount = Number(row.discountAmount ?? row.discount_amount ?? 0);
  const interest = Number(row.interest ?? row.interestAmount ?? row.interest_amount ?? 0);
  const hasPrincipalBreakdown =
    row.scheduleType === 'monthly' &&
    (
      row.principalAmount !== undefined ||
      row.principal_amount !== undefined ||
      row.monthlyAmortizationAmount !== undefined ||
      row.monthly_amortization_amount !== undefined
    );

  return roundMoneyValue(Math.max(dueAmount - discountAmount, 0) + (hasPrincipalBreakdown ? 0 : interest) + penalty);
};

const isStoredDownpaymentRow = (row = {}) => {
  const description = String(row.description || '').toLowerCase();
  return description.includes('downpayment') || description.includes('down payment');
};

const getDownpaymentDiscountRate = (clientProfile = {}) => Number(clientProfile.soa_dp_discount_percentage || 0);

const getExpectedDownpaymentGrossPerRow = (row = {}, clientProfile = {}) => {
  const tcp = Number(
    clientProfile.lot_project_listing_tcp ||
      clientProfile.tcp ||
      clientProfile.total_contract_price ||
      0
  );
  const downpaymentPercentage = Number(clientProfile.soa_downpayment_percentage || 0);
  const downpaymentTerms = Math.max(Number(clientProfile.soa_downpayment_terms || 0), 1);

  if (tcp <= 0 || downpaymentPercentage <= 0) return 0;

  const targetTotal = roundMoneyValue(tcp * (downpaymentPercentage / 100));
  const reservationFee = roundMoneyValue(
    clientProfile.soa_reservation_fee ?? clientProfile.reservationFee ?? clientProfile.lot_project_listing_reservation_fee ?? 0
  );
  const reservationApplied = Number(
    clientProfile.soa_reservation_fee_applied_to_downpayment ??
      clientProfile.reservationFeeAppliedToDownpayment ??
      0
  ) === 1;
  const reservationCredit = reservationApplied ? Math.min(reservationFee, targetTotal) : 0;
  const grossTotal = roundMoneyValue(Math.max(targetTotal - reservationCredit, 0));
  const baseGross = roundMoneyValue(grossTotal / downpaymentTerms);
  const rowIndex = Number(row.sequence || row.row_number || 0);
  const isLast = downpaymentTerms === 1 || rowIndex === downpaymentTerms;

  return isLast
    ? roundMoneyValue(grossTotal - (baseGross * (downpaymentTerms - 1)))
    : baseGross;
};

export const getStoredRowDiscountInfo = (row = {}, clientProfile = {}) => {
  if (!isStoredDownpaymentRow(row)) {
    return {
      discountAmount: 0,
      discountAlreadyAppliedToDueAmount: false,
      cashDueAmount: roundMoneyValue(Number(row.due_amount || 0) + Number(row.penalty_amount || 0)),
    };
  }

  const dueAmount = roundMoneyValue(Number(row.due_amount || 0));
  const penaltyAmount = roundMoneyValue(Number(row.penalty_amount || 0));
  const rate = getDownpaymentDiscountRate(clientProfile);

  if (dueAmount <= 0 || rate <= 0) {
    return {
      discountAmount: 0,
      discountAlreadyAppliedToDueAmount: false,
      cashDueAmount: roundMoneyValue(dueAmount + penaltyAmount),
    };
  }

  const explicitDiscount = Number(row.discount_amount ?? row.discountAmount ?? 0);
  if (explicitDiscount > 0) {
    return {
      discountAmount: roundMoneyValue(explicitDiscount),
      discountAlreadyAppliedToDueAmount: false,
      cashDueAmount: roundMoneyValue(Math.max(dueAmount - explicitDiscount, 0) + penaltyAmount),
    };
  }

  const expectedGross = getExpectedDownpaymentGrossPerRow(row, clientProfile);
  const expectedDiscount = expectedGross > 0 ? roundMoneyValue(expectedGross * (rate / 100)) : 0;
  const expectedNet = expectedGross > 0 ? roundMoneyValue(Math.max(expectedGross - expectedDiscount, 0)) : 0;
  const looksStoredNet = expectedNet > 0 && Math.abs(dueAmount - expectedNet) <= 0.05;

  if (looksStoredNet) {
    return {
      discountAmount: expectedDiscount,
      discountAlreadyAppliedToDueAmount: true,
      cashDueAmount: roundMoneyValue(dueAmount + penaltyAmount),
    };
  }

  const fallbackDiscount = expectedDiscount > 0
    ? expectedDiscount
    : roundMoneyValue(dueAmount * (rate / 100));

  return {
    discountAmount: fallbackDiscount,
    discountAlreadyAppliedToDueAmount: false,
    cashDueAmount: roundMoneyValue(Math.max(dueAmount - fallbackDiscount, 0) + penaltyAmount),
  };
};

export const getStoredRowDiscountAmount = (row = {}, clientProfile = {}) =>
  getStoredRowDiscountInfo(row, clientProfile).discountAmount;

export const getStoredRowTotalDue = (row = {}, clientProfile = {}) =>
  getStoredRowDiscountInfo(row, clientProfile).cashDueAmount;

// Full Payment must clear every unpaid SOA row after the penalty cache has
// been refreshed for the selected payment date.
export const getRemainingUnpaidScheduleBalance = (rows = [], clientProfile = {}) =>
  roundMoneyValue(
    rows.reduce((sum, row) => {
      const totalDue = getStoredRowTotalDue(row, clientProfile);
      const amountPaid = Number(row.amount_paid ?? row.amountPaid ?? 0);
      return sum + Math.max(totalDue - amountPaid, 0);
    }, 0)
  );


const dateOnlyToUtcMs = (value) => {
  const clean = plainDate(value);
  if (!clean || clean === '-') return null;
  const [year, month, day] = clean.split('-').map(Number);
  if (!year || !month || !day) return null;
  return Date.UTC(year, month - 1, day);
};

const addCalendarDays = (value, days = 0) => {
  const utcMs = dateOnlyToUtcMs(value);
  if (utcMs === null) return null;
  return new Date(utcMs + (Number(days || 0) * 86400000)).toISOString().slice(0, 10);
};

const calendarDayDiff = (fromValue, toValue) => {
  const fromMs = dateOnlyToUtcMs(fromValue);
  const toMs = dateOnlyToUtcMs(toValue);
  if (fromMs === null || toMs === null) return 0;
  return Math.max(Math.round((toMs - fromMs) / 86400000), 0);
};

const isPenaltyReliefActive = (relief = {}) =>
  !['cancelled'].includes(String(relief.status || '').toLowerCase());

const getPenaltyBaseDueAmount = (row = {}, clientProfile = {}) => {
  const storedPenalty = Number(row.penalty_amount || 0);
  const cashDue = Number(getStoredRowDiscountInfo(row, clientProfile).cashDueAmount || 0);
  return roundMoneyValue(Math.max(cashDue - storedPenalty, 0));
};

const getPenaltyEligibleSchedule = (row = {}) => {
  const type = getStoredScheduleType(row);
  if (['reservation', 'legal_misc', 'balloon'].includes(type)) return false;
  return String(row.schedule_status || '').toLowerCase() !== 'cancelled';
};

const mapPenaltyReliefRow = (row = {}) => ({
  id: Number(row.penalty_relief_id || 0),
  penaltyReliefId: Number(row.penalty_relief_id || 0),
  scheduleId: Number(row.lot_project_payment_schedule_id || 0),
  reliefType: row.relief_type,
  promisedPaymentDate: plainDate(row.promised_payment_date),
  reliefAmount: roundMoneyValue(row.relief_amount || 0),
  restoresPenaltyReliefId: row.restores_penalty_relief_id ? Number(row.restores_penalty_relief_id) : null,
  status: row.status || 'active',
  reason: row.reason || '',
  internalNotes: row.internal_notes || '',
  approvedByUserId: row.approved_by_user_id ? Number(row.approved_by_user_id) : null,
  approvedByName: row.approved_by_name || '-',
  createdAt: formatDateTime(row.created_at),
  rawCreatedAt: row.created_at,
});

const getEffectiveExtensionState = ({ reliefs = [], allocations = [], baseDue = 0, asOfDate }) => {
  const extensions = reliefs
    .filter((relief) => relief.relief_type === 'penalty_free_extension' && isPenaltyReliefActive(relief))
    .sort((a, b) => Number(b.penalty_relief_id || 0) - Number(a.penalty_relief_id || 0));
  const extension = extensions[0];
  if (!extension?.promised_payment_date) return null;

  const promisedDate = plainDate(extension.promised_payment_date);
  const grantedAt = plainDate(extension.created_at || asOfDate);
  const paidByPromise = roundMoneyValue(
    allocations
      .filter((allocation) => plainDate(allocation.payment_date) <= promisedDate)
      .reduce((sum, allocation) => sum + Number(allocation.applied_amount || 0), 0)
  );
  const honored = paidByPromise + 0.009 >= baseDue;
  const currentDate = plainDate(asOfDate);
  const status = honored
    ? 'honored'
    : currentDate <= promisedDate
      ? 'active'
      : paidByPromise > 0
        ? 'partially_honored'
        : 'broken';

  return {
    id: Number(extension.penalty_relief_id),
    penaltyReliefId: Number(extension.penalty_relief_id),
    promisedPaymentDate: promisedDate,
    grantedAt,
    status,
    reason: extension.reason || '',
    internalNotes: extension.internal_notes || '',
    approvedByName: extension.approved_by_name || '-',
    paidByPromise,
    suppressPenalty: status === 'active' || status === 'honored',
  };
};

export const calculateScheduleDailyPenalty = ({
  row = {},
  clientProfile = {},
  allocations = [],
  reliefs = [],
  asOfDate = todayDateOnly(),
} = {}) => {
  const method = String(clientProfile.soa_penalty_calculation_method || 'none').toLowerCase();
  const ratePercent = Number(clientProfile.soa_penalty_rate_percent || 0);
  const graceDays = Math.max(Number(clientProfile.soa_penalty_grace_days || 0), 0);
  const baseDue = getPenaltyBaseDueAmount(row, clientProfile);
  const cleanAsOfDate = plainDate(asOfDate);
  const penaltyStartDate = row.due_date ? addCalendarDays(row.due_date, graceDays + 1) : null;
  const sortedAllocations = [...allocations]
    .filter((allocation) => allocation.payment_date && Number(allocation.applied_amount || 0) > 0)
    .sort((a, b) => {
      const dateCompare = plainDate(a.payment_date).localeCompare(plainDate(b.payment_date));
      if (dateCompare !== 0) return dateCompare;
      return Number(a.lot_project_payment_id || 0) - Number(b.lot_project_payment_id || 0);
    });
  const activeExtension = getEffectiveExtensionState({
    reliefs,
    allocations: sortedAllocations,
    baseDue,
    asOfDate: cleanAsOfDate,
  });
  const mappedReliefs = reliefs.map((relief) => {
    const mapped = mapPenaltyReliefRow(relief);
    if (relief.relief_type === 'penalty_free_extension') {
      const extensionState = getEffectiveExtensionState({
        reliefs: [relief],
        allocations: sortedAllocations,
        baseDue,
        asOfDate: cleanAsOfDate,
      });
      if (extensionState) {
        return {
          ...mapped,
          status: extensionState.status,
          grantedAt: extensionState.grantedAt,
        };
      }
    }
    return mapped;
  });

  const totalApplied = roundMoneyValue(
    sortedAllocations.reduce((sum, item) => sum + Number(item.applied_amount || 0), 0)
  );

  if (!getPenaltyEligibleSchedule(row) || baseDue <= 0 || method === 'none' || ratePercent <= 0) {
    return {
      scheduleId: Number(row.lot_project_payment_schedule_id || 0),
      method,
      ratePercent,
      graceDays,
      baseDueAmount: baseDue,
      unpaidBaseAmount: roundMoneyValue(Math.max(baseDue - totalApplied, 0)),
      calculatedPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      penaltyAmount: 0,
      paidPenaltyAmount: 0,
      outstandingPenaltyAmount: 0,
      penaltyStartDate,
      penaltyCalculatedThrough: cleanAsOfDate,
      reliefs: mappedReliefs,
      activeExtension,
      canGrantExtension: false,
      canWaivePenalty: false,
    };
  }

  if (method !== 'daily') {
    const correctionIdsRestored = new Set(
      reliefs
        .filter((relief) => relief.relief_type === 'restoration' && isPenaltyReliefActive(relief))
        .map((relief) => Number(relief.restores_penalty_relief_id || 0))
        .filter(Boolean)
    );
    const hasActiveCorrection = reliefs.some(
      (relief) => relief.relief_type === 'penalty_correction' &&
        isPenaltyReliefActive(relief) &&
        !correctionIdsRestored.has(Number(relief.penalty_relief_id || 0))
    );
    const calculated = hasActiveCorrection
      ? 0
      : roundMoneyValue(row.calculated_penalty_amount ?? row.penalty_amount ?? 0);
    const waiverIds = new Set(
      reliefs
        .filter((relief) => ['full_waiver', 'partial_waiver'].includes(relief.relief_type))
        .map((relief) => Number(relief.penalty_relief_id || 0))
    );
    const waiverTotal = roundMoneyValue(
      reliefs
        .filter((relief) => ['full_waiver', 'partial_waiver'].includes(relief.relief_type) && isPenaltyReliefActive(relief))
        .reduce((sum, relief) => sum + Number(relief.relief_amount || 0), 0)
    );
    const restoredTotal = roundMoneyValue(
      reliefs
        .filter((relief) => relief.relief_type === 'restoration' &&
          isPenaltyReliefActive(relief) &&
          waiverIds.has(Number(relief.restores_penalty_relief_id || 0)))
        .reduce((sum, relief) => sum + Number(relief.relief_amount || 0), 0)
    );
    const waived = roundMoneyValue(Math.min(Math.max(waiverTotal - restoredTotal, 0), calculated));
    const penaltyAmount = roundMoneyValue(Math.max(calculated - waived, 0));
    const paidPenalty = roundMoneyValue(Math.min(Number(row.paid_penalty_amount || 0), penaltyAmount));

    return {
      scheduleId: Number(row.lot_project_payment_schedule_id || 0),
      method,
      ratePercent,
      graceDays,
      baseDueAmount: baseDue,
      unpaidBaseAmount: roundMoneyValue(Math.max(baseDue - Math.max(totalApplied - paidPenalty, 0), 0)),
      calculatedPenaltyAmount: calculated,
      waivedPenaltyAmount: waived,
      penaltyAmount,
      paidPenaltyAmount: paidPenalty,
      outstandingPenaltyAmount: roundMoneyValue(Math.max(penaltyAmount - paidPenalty, 0)),
      penaltyStartDate,
      penaltyCalculatedThrough: cleanAsOfDate,
      reliefs: mappedReliefs,
      activeExtension,
      canGrantExtension: false,
      canWaivePenalty: penaltyAmount - paidPenalty > 0.009,
    };
  }

  if (!penaltyStartDate) {
    return {
      scheduleId: Number(row.lot_project_payment_schedule_id || 0),
      method,
      ratePercent,
      graceDays,
      baseDueAmount: baseDue,
      unpaidBaseAmount: roundMoneyValue(Math.max(baseDue - totalApplied, 0)),
      calculatedPenaltyAmount: 0,
      waivedPenaltyAmount: 0,
      penaltyAmount: 0,
      paidPenaltyAmount: 0,
      outstandingPenaltyAmount: 0,
      penaltyStartDate,
      penaltyCalculatedThrough: cleanAsOfDate,
      reliefs: mappedReliefs,
      activeExtension,
      canGrantExtension: false,
      canWaivePenalty: false,
    };
  }

  const reliefById = new Map(
    reliefs.map((relief) => [Number(relief.penalty_relief_id || 0), relief])
  );
  const restoredCorrectionIds = new Set(
    reliefs
      .filter((relief) => relief.relief_type === 'restoration' && isPenaltyReliefActive(relief))
      .filter((relief) => reliefById.get(Number(relief.restores_penalty_relief_id || 0))?.relief_type === 'penalty_correction')
      .map((relief) => Number(relief.restores_penalty_relief_id || 0))
  );

  const reliefEvents = reliefs
    .filter(isPenaltyReliefActive)
    .filter((relief) => {
      if (['full_waiver', 'partial_waiver'].includes(relief.relief_type)) return true;
      if (relief.relief_type === 'penalty_correction') {
        return !restoredCorrectionIds.has(Number(relief.penalty_relief_id || 0));
      }
      if (relief.relief_type === 'restoration') {
        const target = reliefById.get(Number(relief.restores_penalty_relief_id || 0));
        return ['full_waiver', 'partial_waiver'].includes(target?.relief_type);
      }
      return false;
    })
    .map((relief) => ({
      kind: 'relief',
      date: plainDate(relief.created_at || cleanAsOfDate),
      relief,
    }));
  const paymentEvents = sortedAllocations.map((allocation) => ({
    kind: 'payment',
    date: plainDate(allocation.payment_date),
    allocation,
  }));
  const events = [...reliefEvents, ...paymentEvents]
    .filter((event) => event.date && event.date !== '-')
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      if (dateCompare !== 0) return dateCompare;
      if (a.kind !== b.kind) return a.kind === 'relief' ? -1 : 1;
      return Number(a.relief?.penalty_relief_id || a.allocation?.lot_project_payment_id || 0) -
        Number(b.relief?.penalty_relief_id || b.allocation?.lot_project_payment_id || 0);
    });

  let currentBase = baseDue;
  let calculatedPenalty = 0;
  let waiverBalance = 0;
  let paidPenalty = 0;
  let cursorDate = penaltyStartDate;
  const dailyRate = ratePercent / 100;
  const suppressionStart = activeExtension?.suppressPenalty
    ? [penaltyStartDate, activeExtension.grantedAt].sort().at(-1)
    : null;
  const suppressionEndExclusive = activeExtension?.suppressPenalty
    ? addCalendarDays(activeExtension.promisedPaymentDate, 1)
    : null;

  const countChargeableDays = (fromDate, toDateExclusive) => {
    const totalDays = calendarDayDiff(fromDate, toDateExclusive);
    if (!suppressionStart || !suppressionEndExclusive || totalDays <= 0) return totalDays;

    const overlapStart = fromDate > suppressionStart ? fromDate : suppressionStart;
    const overlapEnd = toDateExclusive < suppressionEndExclusive ? toDateExclusive : suppressionEndExclusive;
    const suppressedDays = overlapEnd > overlapStart
      ? calendarDayDiff(overlapStart, overlapEnd)
      : 0;
    return Math.max(totalDays - suppressedDays, 0);
  };

  const accrueUntilExclusive = (eventDate) => {
    if (!cursorDate || currentBase <= 0 || eventDate <= cursorDate) return;
    const days = countChargeableDays(cursorDate, eventDate);
    if (days > 0) {
      calculatedPenalty = roundMoneyValue(calculatedPenalty + (currentBase * dailyRate * days));
    }
    cursorDate = eventDate;
  };

  for (const event of events) {
    if (event.date > cleanAsOfDate) break;

    if (event.date >= penaltyStartDate) {
      accrueUntilExclusive(event.date);
    }

    if (event.kind === 'relief') {
      const amount = Number(event.relief.relief_amount || 0);
      if (event.relief.relief_type === 'restoration') {
        waiverBalance = roundMoneyValue(Math.max(waiverBalance - amount, 0));
      } else if (event.relief.relief_type === 'penalty_correction') {
        currentBase = roundMoneyValue(Math.max(currentBase - paidPenalty, 0));
        calculatedPenalty = 0;
        waiverBalance = 0;
        paidPenalty = 0;
        cursorDate = addCalendarDays(event.date, 1);
      } else {
        waiverBalance = roundMoneyValue(waiverBalance + amount);
      }
      continue;
    }

    let paymentAmount = roundMoneyValue(event.allocation.applied_amount || 0);
    const outstandingPenalty = roundMoneyValue(
      Math.max(calculatedPenalty - waiverBalance - paidPenalty, 0)
    );
    const penaltyPayment = roundMoneyValue(Math.min(paymentAmount, outstandingPenalty));
    paidPenalty = roundMoneyValue(paidPenalty + penaltyPayment);
    paymentAmount = roundMoneyValue(Math.max(paymentAmount - penaltyPayment, 0));
    currentBase = roundMoneyValue(Math.max(currentBase - paymentAmount, 0));

    if (event.date < penaltyStartDate) {
      cursorDate = penaltyStartDate;
    } else if (!cursorDate || event.date > cursorDate) {
      cursorDate = event.date;
    }
  }

  if (cleanAsOfDate >= penaltyStartDate && currentBase > 0) {
    accrueUntilExclusive(addCalendarDays(cleanAsOfDate, 1));
  }

  const waivedPenalty = roundMoneyValue(Math.min(waiverBalance, calculatedPenalty));
  const penaltyAmount = roundMoneyValue(Math.max(calculatedPenalty - waivedPenalty, 0));
  paidPenalty = roundMoneyValue(Math.min(paidPenalty, penaltyAmount));
  const outstandingPenalty = roundMoneyValue(Math.max(penaltyAmount - paidPenalty, 0));
  const hasCurrentActiveExtension = activeExtension?.status === 'active';

  return {
    scheduleId: Number(row.lot_project_payment_schedule_id || 0),
    method,
    ratePercent,
    graceDays,
    baseDueAmount: baseDue,
    unpaidBaseAmount: currentBase,
    calculatedPenaltyAmount: calculatedPenalty,
    waivedPenaltyAmount: waivedPenalty,
    penaltyAmount,
    paidPenaltyAmount: paidPenalty,
    outstandingPenaltyAmount: outstandingPenalty,
    penaltyStartDate,
    penaltyCalculatedThrough: cleanAsOfDate,
    reliefs: mappedReliefs,
    activeExtension,
    canGrantExtension:
      currentBase > 0.009 &&
      !hasCurrentActiveExtension &&
      Boolean(row.due_date) &&
      cleanAsOfDate >= plainDate(row.due_date),
    canWaivePenalty: outstandingPenalty > 0.009,
  };
};

export const getListingPenaltySnapshots = async (
  connection,
  lotProjectId,
  listingId,
  clientProfile = {},
  scheduleRows = [],
  asOfDate = todayDateOnly()
) => {
  if (!scheduleRows.length) return new Map();

  const scheduleIds = scheduleRows
    .map((row) => Number(row.lot_project_payment_schedule_id || 0))
    .filter(Boolean);
  if (!scheduleIds.length) return new Map();

  const placeholders = scheduleIds.map(() => '?').join(', ');
  let allocations = [];
  if (await tableExists(connection, 'lot_project_payment_allocations')) {
    const [allocationRows] = await connection.query(
      `
        SELECT
          pa.lot_project_payment_schedule_id,
          pa.applied_amount,
          p.lot_project_payment_id,
          p.lot_project_payment_date AS payment_date
        FROM lot_project_payment_allocations pa
        INNER JOIN lot_project_payments p
          ON p.lot_project_payment_id = pa.lot_project_payment_id
        WHERE pa.lot_project_payment_schedule_id IN (${placeholders})
          AND p.lot_project_payment_status = 'Verified'
        ORDER BY p.lot_project_payment_date ASC, p.lot_project_payment_id ASC
      `,
      scheduleIds
    );
    allocations = allocationRows;
  }

  let reliefRows = [];
  if (await tableExists(connection, 'lot_project_penalty_reliefs')) {
    const [rows] = await connection.query(
      `
        SELECT
          pr.*,
          TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS approved_by_name
        FROM lot_project_penalty_reliefs pr
        LEFT JOIN users u ON u.id = pr.approved_by_user_id
        WHERE pr.lot_project_id = ?
          AND pr.lot_project_listing_id = ?
          AND pr.lot_project_payment_schedule_id IN (${placeholders})
        ORDER BY pr.created_at ASC, pr.penalty_relief_id ASC
      `,
      [lotProjectId, listingId, ...scheduleIds]
    );
    reliefRows = rows;
  }

  const allocationsBySchedule = new Map();
  allocations.forEach((allocation) => {
    const key = Number(allocation.lot_project_payment_schedule_id);
    if (!allocationsBySchedule.has(key)) allocationsBySchedule.set(key, []);
    allocationsBySchedule.get(key).push(allocation);
  });

  const reliefsBySchedule = new Map();
  reliefRows.forEach((relief) => {
    const key = Number(relief.lot_project_payment_schedule_id);
    if (!reliefsBySchedule.has(key)) reliefsBySchedule.set(key, []);
    reliefsBySchedule.get(key).push(relief);
  });

  const snapshots = new Map();
  scheduleRows.forEach((row) => {
    const scheduleId = Number(row.lot_project_payment_schedule_id || 0);
    snapshots.set(scheduleId, calculateScheduleDailyPenalty({
      row,
      clientProfile,
      allocations: allocationsBySchedule.get(scheduleId) || [],
      reliefs: reliefsBySchedule.get(scheduleId) || [],
      asOfDate,
    }));
  });

  return snapshots;
};

export const refreshListingPenaltyCache = async (
  connection,
  listing,
  asOfDate = todayDateOnly()
) => {
  if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return new Map();

  const [profileRows] = await connection.query(
    `SELECT * FROM lot_project_client_profiles WHERE lot_project_listing_id = ? LIMIT 1`,
    [listing.lot_project_listing_id]
  );
  const clientProfile = { ...(listing || {}), ...(profileRows[0] || {}) };
  const scheduleRows = await getExistingSoaScheduleRows(
    connection,
    listing.lot_project_id,
    listing.lot_project_listing_id
  );
  const snapshots = await getListingPenaltySnapshots(
    connection,
    listing.lot_project_id,
    listing.lot_project_listing_id,
    clientProfile,
    scheduleRows,
    asOfDate
  );

  const hasCalculatedColumn = await columnExists(connection, 'lot_project_payment_schedules', 'calculated_penalty_amount');
  const hasWaivedColumn = await columnExists(connection, 'lot_project_payment_schedules', 'waived_penalty_amount');
  const hasThroughColumn = await columnExists(connection, 'lot_project_payment_schedules', 'penalty_calculated_through');

  for (const row of scheduleRows) {
    const snapshot = snapshots.get(Number(row.lot_project_payment_schedule_id));
    if (!snapshot) continue;

    const setColumns = ['penalty_amount = ?', 'paid_penalty_amount = ?'];
    const params = [snapshot.penaltyAmount, snapshot.paidPenaltyAmount];
    if (hasCalculatedColumn) {
      setColumns.push('calculated_penalty_amount = ?');
      params.push(snapshot.calculatedPenaltyAmount);
    }
    if (hasWaivedColumn) {
      setColumns.push('waived_penalty_amount = ?');
      params.push(snapshot.waivedPenaltyAmount);
    }
    if (hasThroughColumn) {
      setColumns.push('penalty_calculated_through = ?');
      params.push(snapshot.penaltyCalculatedThrough);
    }

    await connection.query(
      `UPDATE lot_project_payment_schedules SET ${setColumns.join(', ')} WHERE lot_project_payment_schedule_id = ?`,
      [...params, row.lot_project_payment_schedule_id]
    );

    if (snapshot.activeExtension && await tableExists(connection, 'lot_project_penalty_reliefs')) {
      await connection.query(
        `
          UPDATE lot_project_penalty_reliefs
          SET status = ?,
              honored_at = CASE WHEN ? = 'honored' THEN COALESCE(honored_at, NOW()) ELSE honored_at END
          WHERE penalty_relief_id = ?
            AND status <> 'cancelled'
        `,
        [snapshot.activeExtension.status, snapshot.activeExtension.status, snapshot.activeExtension.penaltyReliefId]
      );
    }
  }

  return snapshots;
};

export const getStoredScheduleType = (row = {}) => {
  const text = String(row.description || '').toLowerCase();
  if (text.includes('reservation')) return 'reservation';
  if (text.includes('legal') || text.includes('misc') || text.includes('lmf')) return 'legal_misc';
  if (text.includes('downpayment') || text.includes('down payment')) return 'downpayment';
  if (text.includes('monthly')) return 'monthly';
  if (text.includes('full payment')) return 'full_payment';
  if (text.includes('balloon')) return 'balloon';
  return 'other';
};

export const paymentTypeToStoredScheduleType = (paymentType) => {
  const cleanType = String(paymentType || '').toLowerCase();
  if (cleanType === 'reservation') return 'reservation';
  if (cleanType === 'downpayment') return 'downpayment';
  if (cleanType === 'legal_misc') return 'legal_misc';
  if (['monthly_amortization', 'advance_payment', 'balloon'].includes(cleanType)) return 'monthly';
  return null;
};

const isSameScheduleId = (row = {}, scheduleId) =>
  Number(row.lot_project_payment_schedule_id || 0) === Number(scheduleId || 0);

export const appendPaymentReference = (row, payment) => {
  const reference = payment.referenceId || payment.lot_project_payment_reference_id || '-';
  const paidDate = payment.paymentDate || payment.lot_project_payment_date || '-';

  row.datePaid = paidDate && paidDate !== '-' ? normalizeDateInput(paidDate) : '-';

  if (!row.referenceId || row.referenceId === '-') {
    row.referenceId = reference;
  } else if (reference && reference !== '-' && !String(row.referenceId).split(', ').includes(reference)) {
    row.referenceId = `${row.referenceId}, ${reference}`;
  }
};

export const getPaymentAmountValue = (payment = {}) =>
  roundMoneyValue(payment.amount ?? payment.lot_project_payment_amount ?? 0);

export const createBalloonPrincipalRow = (payment = {}, index = 1) => {
  const paymentId = payment.paymentId || payment.id || payment.lot_project_payment_id || index;
  const paidDate = payment.paymentDate || payment.lot_project_payment_date || new Date();
  const amountPaid = getPaymentAmountValue(payment);
  const referenceId = payment.referenceId || payment.lot_project_payment_reference_id || '-';

  return {
    id: `balloon-${paymentId}`,
    scheduleType: 'balloon',
    sequence: 100000 + Number(index || 0),
    dueDate: normalizeDateInput(paidDate),
    description: 'Balloon Principal Reduction',
    beginningBalance: 0,
    dueAmount: amountPaid,
    monthlyAmortizationAmount: amountPaid,
    principalAmount: amountPaid,
    interest: 0,
    penalty: 0,
    datePaid: normalizeDateInput(paidDate),
    amountPaid,
    referenceId,
    status: amountPaid > 0 ? 'Paid' : 'Unpaid',
    endingBalance: 0,
  };
};

export const getRowSortOrder = (row = {}) => {
  const order = {
    reservation: 1,
    downpayment: 2,
    monthly: 3,
    full_payment: 4,
    balloon: 5,
    legal_misc: 6,
  };

  return order[row.scheduleType] || 9;
};

const isReservationRow = (row = {}) => row.scheduleType === 'reservation';
const isLegalMiscRow = (row = {}) => row.scheduleType === 'legal_misc';

export const sortComputedRows = (rows = []) =>
  [...rows].sort((a, b) => {
    // Reservation Fee is always first, and Legal/Misc Fee is always last
    // because it has no scheduled due date.
    if (isReservationRow(a) && !isReservationRow(b)) return -1;
    if (!isReservationRow(a) && isReservationRow(b)) return 1;

    if (isLegalMiscRow(a) && !isLegalMiscRow(b)) return 1;
    if (!isLegalMiscRow(a) && isLegalMiscRow(b)) return -1;

    const dateCompare = String(a.dueDate || '').localeCompare(String(b.dueDate || ''));
    if (dateCompare !== 0) return dateCompare;

    const orderCompare = getRowSortOrder(a) - getRowSortOrder(b);
    if (orderCompare !== 0) return orderCompare;

    return Number(a.sequence || 0) - Number(b.sequence || 0);
  });


export const getReserveSellerOptions = async (
  connection,
  lotProjectId,
  { search = '', limit = 100 } = {}
) => {
  if (!(await tableExists(connection, 'accredited_sellers'))) return [];

  const hasDirectRates = await tableExists(connection, 'agent_lot_project_direct_rates');
  const hasLegacySellerRates = await tableExists(connection, 'accredited_seller_lot_project_rates');
  const hasDummyColumns = await columnExists(connection, 'accredited_sellers', 'is_system_dummy');
  const hasSystemUserColumns = await columnExists(connection, 'users', 'is_system_account');

  const rateJoin = hasDirectRates
    ? `INNER JOIN agent_lot_project_direct_rates direct_rate
         ON direct_rate.accredited_seller_id = acs.accredited_seller_id
        AND direct_rate.lot_project_id = ?
        AND direct_rate.direct_rate_status = 'active'`
    : hasLegacySellerRates
      ? `INNER JOIN accredited_seller_lot_project_rates direct_rate
           ON direct_rate.accredited_seller_id = acs.accredited_seller_id
          AND direct_rate.lot_project_id = ?
          AND direct_rate.accredited_seller_lot_project_rate_status = 'active'`
      : '';
  const rateSelect = hasDirectRates
    ? 'direct_rate.direct_rate'
    : hasLegacySellerRates
      ? 'direct_rate.accredited_seller_project_rate'
      : '0';

  const keyword = String(search || '').trim();
  const searchSql = keyword
    ? `AND (
         TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) LIKE ?
         OR IFNULL(sg.seller_group_name, '') LIKE ?
         OR TRIM(CONCAT_WS(' ', parent_user.first_name, parent_user.middle_name, parent_user.last_name)) LIKE ?
         OR TRIM(CONCAT_WS(' ', owner_user.first_name, owner_user.middle_name, owner_user.last_name)) LIKE ?
       )`
    : '';
  const params = rateJoin ? [lotProjectId] : [];
  if (keyword) {
    const like = `%${keyword}%`;
    params.push(like, like, like, like);
  }
  params.push(Math.min(Math.max(Number(limit) || 100, 1), 200));

  const [rows] = await connection.query(
    `
      SELECT
        acs.accredited_seller_id AS id,
        acs.accredited_seller_id,
        acs.user_id,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS name,
        u.role,
        ${rateSelect} AS rate,
        sg.seller_group_id,
        sg.seller_group_name,
        parent_acs.accredited_seller_id AS reports_under_accredited_seller_id,
        parent_user.id AS reports_under_user_id,
        TRIM(CONCAT_WS(' ', parent_user.first_name, parent_user.middle_name, parent_user.last_name)) AS reports_under_name,
        ${hasDummyColumns ? 'acs.is_system_dummy' : '0'} AS is_system_dummy,
        ${hasDummyColumns ? 'acs.dummy_owner_accredited_seller_id' : 'NULL'} AS dummy_owner_accredited_seller_id,
        TRIM(CONCAT_WS(' ', owner_user.first_name, owner_user.middle_name, owner_user.last_name)) AS owner_name,
        owner_user.role AS owner_role,
        ${hasSystemUserColumns ? 'u.is_system_account' : '0'} AS is_system_account
      FROM accredited_sellers acs
      INNER JOIN users u ON u.id = acs.user_id
      INNER JOIN seller_groups sg
        ON sg.seller_group_id = acs.seller_group_id
       AND sg.seller_group_status = 'active'
      ${rateJoin}
      LEFT JOIN accredited_sellers parent_acs
        ON parent_acs.user_id = acs.accredited_seller_reports_under_user_id
      LEFT JOIN users parent_user ON parent_user.id = parent_acs.user_id
      LEFT JOIN accredited_sellers owner_acs
        ON owner_acs.accredited_seller_id = ${hasDummyColumns ? 'acs.dummy_owner_accredited_seller_id' : 'NULL'}
      LEFT JOIN users owner_user ON owner_user.id = owner_acs.user_id
      WHERE acs.accredited_seller_status = 'active'
        AND u.status = 'active'
        AND u.role = 'agent'
        AND ${rateSelect} > 0
        ${searchSql}
      ORDER BY
        ${hasDummyColumns ? 'acs.is_system_dummy' : '0'} ASC,
        name ASC
      LIMIT ?
    `,
    params
  );

  return rows.map((row) => {
    const isSystemDummy = Number(row.is_system_dummy || row.is_system_account || 0) === 1;
    const displayName = isSystemDummy && row.owner_name
      ? `${row.owner_name} — Direct Sales Agent`
      : row.name || 'Unnamed Agent';

    return {
      id: Number(row.id),
      accredited_seller_id: Number(row.accredited_seller_id),
      user_id: Number(row.user_id),
      name: displayName,
      role: 'Agent',
      roleValue: 'agent',
      rate: `${Number(row.rate || 0).toFixed(2)}%`,
      rateValue: Number(row.rate || 0),
      directRate: Number(row.rate || 0),
      groupId: Number(row.seller_group_id),
      groupName: row.seller_group_name || '-',
      reportsUnderId: row.reports_under_accredited_seller_id
        ? Number(row.reports_under_accredited_seller_id)
        : null,
      reportsUnderName: row.reports_under_name || '-',
      isSystemDummy,
      ownerId: row.dummy_owner_accredited_seller_id
        ? Number(row.dummy_owner_accredited_seller_id)
        : null,
      ownerName: row.owner_name || null,
      ownerRole: row.owner_role || null,
      allocation: row.reports_under_name
        ? `Agent under ${row.reports_under_name}`
        : 'Agent direct to group head',
    };
  });
};

const normalizeInterestCalculationType = () => 'amortized';

const getEffectiveSoaInterestRate = (listingRow = {}) =>
  Number(listingRow.annual_interest_rate ?? listingRow.lot_project_listing_annual_interest_rate ?? 0);

const getMonthlyAmortizationAmount = (financedBalance, annualInterestRate, monthlyTerms) => {
  const principal = roundMoneyValue(financedBalance || 0);
  const terms = Number(monthlyTerms || 0);

  if (principal <= 0 || terms <= 0) return 0;

  const monthlyRate = Number(annualInterestRate || 0) / 100 / 12;
  if (monthlyRate <= 0) return roundMoneyValue(principal / terms);

  const factor = Math.pow(1 + monthlyRate, terms);
  return roundMoneyValue(principal * ((monthlyRate * factor) / (factor - 1)));
};

export const getComputedSoaTerms = (listingRow = {}, existingScheduleRows = []) => {
  const tcp = roundMoneyValue(listingRow.lot_project_listing_tcp || listingRow.tcp || 0);
  const legalMiscFeeMode = String(
    listingRow.soa_legal_misc_fee_mode || listingRow.legalMiscFeeMode || listingRow.legalMiscFee || 'include_in_monthly'
  ) === 'separate_soa_row'
    ? 'separate_soa_row'
    : 'include_in_monthly';
  const legalMiscFeeAmount = roundMoneyValue(
    listingRow.soa_legal_misc_fee_amount ?? listingRow.legalMiscFeeAmount ?? listingRow.lot_project_listing_lmf_amount ?? 0
  );
  const principalTcp = roundMoneyValue(
    legalMiscFeeMode === 'separate_soa_row'
      ? Math.max(tcp - legalMiscFeeAmount, 0)
      : tcp
  );

  const firstExistingRow = existingScheduleRows[0] || {};
  const existingReservationRow = existingScheduleRows.find((row) =>
    String(row.description || '').toLowerCase().includes('reservation')
  );
  const existingLegalMiscRow = existingScheduleRows.find((row) => {
    const text = String(row.description || '').toLowerCase();
    return text.includes('legal') || text.includes('misc') || text.includes('lmf');
  });
  const existingDownpaymentRows = existingScheduleRows.filter((row) =>
    String(row.description || '').toLowerCase().includes('downpayment')
  );
  const existingMonthlyRows = existingScheduleRows.filter((row) =>
    String(row.description || '').toLowerCase().includes('monthly')
  );

  const reservationFee = roundMoneyValue(
    listingRow.reservation_fee ||
      listingRow.soa_reservation_fee ||
      existingReservationRow?.due_amount ||
      listingRow.lot_project_listing_reservation_fee ||
      0
  );

  const downpaymentPercentage = Number(
    listingRow.downpayment_percentage || listingRow.soa_downpayment_percentage || 30
  );
  const dpDiscountPercentage = Number(
    listingRow.dp_discount_percentage || listingRow.soa_dp_discount_percentage || 0
  );

  const inferredDownpaymentGrossTotal = existingDownpaymentRows.reduce(
    (sum, row) => sum + Number(row.due_amount || 0),
    0
  );
  const downpaymentTargetTotal = roundMoneyValue(principalTcp * (downpaymentPercentage / 100));
  const reservationFeeAppliedToDownpayment = Number(
    listingRow.soa_reservation_fee_applied_to_downpayment ??
      listingRow.reservationFeeAppliedToDownpayment ??
      (listingRow.reservationFeeTreatment === 'apply_to_downpayment' ? 1 : 0)
  ) === 1;
  const reservationFeeDownpaymentCredit = reservationFeeAppliedToDownpayment
    ? roundMoneyValue(Math.min(reservationFee, downpaymentTargetTotal))
    : 0;
  const computedDownpaymentGrossTotal = roundMoneyValue(
    Math.max(downpaymentTargetTotal - reservationFeeDownpaymentCredit, 0)
  );
  const downpaymentGrossTotal = roundMoneyValue(
    existingDownpaymentRows.length ? inferredDownpaymentGrossTotal : computedDownpaymentGrossTotal
  );
  const downpaymentDiscountTotal = roundMoneyValue(downpaymentGrossTotal * (dpDiscountPercentage / 100));
  const computedDownpaymentTotal = roundMoneyValue(Math.max(downpaymentGrossTotal - downpaymentDiscountTotal, 0));

  const downpaymentTotal = computedDownpaymentTotal;

  const downpaymentTerms = Math.max(
    Number(
      listingRow.downpayment_terms ??
        listingRow.soa_downpayment_terms ??
        (existingDownpaymentRows.length || 3)
    ),
    0
  );

  const monthlyTerms = Math.max(
    Number(
      listingRow.monthly_terms ??
        listingRow.soa_monthly_terms ??
        (existingMonthlyRows.length || 36)
    ),
    1
  );

  const startingDate = normalizeDateInput(
    listingRow.soa_starting_date ||
      listingRow.starting_date ||
      existingReservationRow?.due_date ||
      firstExistingRow.due_date ||
      new Date()
  );
  const firstDueDate = normalizeDateInput(
    listingRow.soa_first_due_date ||
      listingRow.first_due_date ||
      existingDownpaymentRows[0]?.due_date ||
      firstExistingRow.due_date ||
      startingDate
  );

  const annualInterestRate = getEffectiveSoaInterestRate(listingRow);
  const interestRateSource = Number(listingRow.soa_interest_rate_overridden || 0) === 1 ? 'custom' : 'listing';
  const financedBalance = roundMoneyValue(Math.max(principalTcp - reservationFee - downpaymentGrossTotal, 0));
  const monthlyPrincipal = roundMoneyValue(monthlyTerms > 0 ? financedBalance / monthlyTerms : financedBalance);
  const monthlyAmortization = getMonthlyAmortizationAmount(financedBalance, annualInterestRate, monthlyTerms);

  return {
    tcp,
    principalTcp,
    legalMiscFeeMode,
    legalMiscFeeAmount: existingLegalMiscRow?.due_amount ? Number(existingLegalMiscRow.due_amount) : legalMiscFeeAmount,
    reservationFee,
    downpaymentPercentage,
    dpDiscountPercentage,
    downpaymentTargetTotal,
    reservationFeeAppliedToDownpayment,
    reservationFeeDownpaymentCredit,
    downpaymentGrossTotal,
    downpaymentDiscountTotal,
    downpaymentTotal,
    downpaymentTerms,
    monthlyTerms,
    monthlyPrincipal,
    monthlyAmortization,
    annualInterestRate,
    listingAnnualInterestRate: Number(listingRow.annual_interest_rate || 0),
    interestRateSource,
    financedBalance,
    startingDate,
    firstDueDate,
    modeOfPayment: listingRow.soa_mode_of_payment || listingRow.mode_of_payment || 'installment',
  };
};

export const createComputedSoaRows = (terms = {}) => {
  const rows = [];
  let sequence = 1;

  if (terms.reservationFee > 0) {
    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'reservation',
      sequence,
      dueDate: terms.startingDate,
      description: 'Reservation Fee',
      beginningBalance: terms.tcp,
      dueAmount: terms.reservationFee,
      principalAmount: terms.reservationFee,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  if (terms.legalMiscFeeMode === 'separate_soa_row' && Number(terms.legalMiscFeeAmount || 0) > 0) {
    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'legal_misc',
      sequence,
      dueDate: null,
      description: 'Legal / Misc Fee',
      beginningBalance: terms.tcp,
      dueAmount: roundMoneyValue(terms.legalMiscFeeAmount),
      principalAmount: 0,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  if (String(terms.modeOfPayment || '').toLowerCase() === 'cash') {
    const cashBalance = Math.max((terms.principalTcp || terms.tcp) - terms.reservationFee, 0);

    if (cashBalance > 0) {
      rows.push({
        id: `computed-${sequence}`,
        scheduleType: 'full_payment',
        sequence,
        dueDate: terms.firstDueDate,
        description: 'Full Payment',
        beginningBalance: terms.tcp,
        dueAmount: roundMoneyValue(cashBalance),
        principalAmount: roundMoneyValue(cashBalance),
        interest: 0,
        penalty: 0,
        datePaid: '-',
        amountPaid: 0,
        referenceId: '-',
        status: 'Unpaid',
        endingBalance: terms.tcp,
      });
    }

    return rows;
  }

  const dpTerms = terms.downpaymentTerms <= 0 ? 1 : terms.downpaymentTerms;
  const baseDownpaymentGross = dpTerms > 0 ? roundMoneyValue((terms.downpaymentGrossTotal || terms.downpaymentTotal || 0) / dpTerms) : 0;
  let downpaymentGrossRemainder = roundMoneyValue(terms.downpaymentGrossTotal || terms.downpaymentTotal || 0);
  let downpaymentDiscountRemainder = roundMoneyValue(terms.downpaymentDiscountTotal || 0);

  for (let index = 1; index <= dpTerms; index += 1) {
    if (downpaymentGrossRemainder <= 0) break;

    const isLast = index === dpTerms;
    const dueAmount = roundMoneyValue(isLast ? downpaymentGrossRemainder : baseDownpaymentGross);
    const discountAmount = roundMoneyValue(isLast ? downpaymentDiscountRemainder : dueAmount * (Number(terms.dpDiscountPercentage || 0) / 100));
    const principalAmount = roundMoneyValue(Math.max(dueAmount - discountAmount, 0));
    downpaymentGrossRemainder = roundMoneyValue(downpaymentGrossRemainder - dueAmount);
    downpaymentDiscountRemainder = roundMoneyValue(downpaymentDiscountRemainder - discountAmount);

    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'downpayment',
      sequence,
      dueDate: addMonthsToDate(terms.firstDueDate, index - 1),
      description: dpTerms === 1 ? 'Downpayment' : `${getOrdinalLabel(index)} Downpayment`,
      beginningBalance: terms.tcp,
      dueAmount,
      discountAmount,
      principalAmount,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  for (let index = 1; index <= terms.monthlyTerms; index += 1) {
    const dueDate = addMonthsToDate(terms.firstDueDate, dpTerms + index - 1);
    rows.push({
      id: `computed-${sequence}`,
      scheduleType: 'monthly',
      sequence,
      dueDate,
      description: `${getOrdinalLabel(index)} Monthly Payment`,
      beginningBalance: terms.tcp,
      dueAmount: terms.monthlyAmortization || terms.monthlyPrincipal,
      monthlyAmortizationAmount: terms.monthlyAmortization || terms.monthlyPrincipal,
      principalAmount: 0,
      interest: 0,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      status: 'Unpaid',
      endingBalance: terms.tcp,
    });
    sequence += 1;
  }

  return rows;
};

export const getPaymentTargetRows = (rows, paymentType) => {
  const cleanType = String(paymentType || '').toLowerCase();

  if (cleanType === 'reservation') return rows.filter((row) => row.scheduleType === 'reservation');
  if (cleanType === 'downpayment') return rows.filter((row) => row.scheduleType === 'downpayment');
  if (cleanType === 'monthly_amortization') return rows.filter((row) => row.scheduleType === 'monthly');
  if (cleanType === 'legal_misc') return rows.filter((row) => row.scheduleType === 'legal_misc');
  if (cleanType === 'advance_payment') return rows.filter((row) => row.scheduleType === 'monthly');
  if (cleanType === 'balloon') return rows.filter((row) => row.scheduleType === 'monthly');
  if (cleanType === 'full_payment') return rows;

  return rows;
};

export const allocatePaymentsToComputedRows = (rows = [], payments = []) => {
  const sortedPayments = [...payments].sort((a, b) => {
    const dateA = String(a.paymentDate || a.lot_project_payment_date || '');
    const dateB = String(b.paymentDate || b.lot_project_payment_date || '');
    if (dateA !== dateB) return dateA.localeCompare(dateB);
    return Number(a.paymentId || a.id || a.lot_project_payment_id || 0) - Number(b.paymentId || b.id || b.lot_project_payment_id || 0);
  });

  let balloonCounter = 0;

  for (const payment of sortedPayments) {
    const type = payment.paymentTypeValue || normalizePaymentType(payment.paymentType || payment.type);
    let remaining = getPaymentAmountValue(payment);

    if (type === 'balloon') {
      balloonCounter += 1;
      rows.push(createBalloonPrincipalRow(payment, balloonCounter));
      continue;
    }

    const targetRows = getPaymentTargetRows(rows, type);

    for (const row of targetRows) {
      if (remaining <= 0) break;

      const unpaid = Math.max(getScheduleTotalDue(row) - Number(row.amountPaid || 0), 0);
      if (unpaid <= 0) continue;

      const appliedAmount = roundMoneyValue(Math.min(remaining, unpaid));
      row.amountPaid = roundMoneyValue(Number(row.amountPaid || 0) + appliedAmount);
      appendPaymentReference(row, payment);
      remaining = roundMoneyValue(remaining - appliedAmount);
    }
  }

  return sortComputedRows(rows);
};


const getPaymentBreakdownForRow = (row = {}, amountPaid = 0) => {
  let remaining = roundMoneyValue(amountPaid);
  const penaltyDue = Number(row.penalty || 0);
  const interestDue = Number(row.interest || 0);
  const principalDue = Number(row.principalAmount ?? row.principal_amount ?? row.dueAmount ?? 0);

  const penaltyPaid = roundMoneyValue(Math.min(remaining, penaltyDue));
  remaining = roundMoneyValue(Math.max(remaining - penaltyPaid, 0));

  const interestPaid = roundMoneyValue(Math.min(remaining, interestDue));
  remaining = roundMoneyValue(Math.max(remaining - interestPaid, 0));

  const principalPaid = roundMoneyValue(Math.min(remaining, principalDue));

  return { penaltyPaid, interestPaid, principalPaid };
};

export const recomputeComputedSoaBalances = (rows = [], terms = {}) => {
  const today = todayDateOnly();
  let runningBalance = roundMoneyValue(terms.principalTcp ?? terms.tcp ?? 0);
  let projectedMonthlyBalance = roundMoneyValue(terms.financedBalance || 0);
  const monthlyRate = Number(terms.annualInterestRate || 0) / 100 / 12;
  const sortedRows = sortComputedRows(rows);
  const monthlyRows = sortedRows.filter((row) => row.scheduleType === 'monthly');
  const visibleRows = [];
  let monthlyIndex = 0;

  for (const row of sortedRows) {
    const scheduleType = row.scheduleType;
    let amountPaid = roundMoneyValue(Number(row.amountPaid || 0));

    if (runningBalance <= 0 && amountPaid <= 0 && !['legal_misc'].includes(scheduleType)) break;

    row.beginningBalance = runningBalance;

    if (scheduleType === 'balloon') {
      row.interest = 0;
      row.penalty = 0;
      row.monthlyAmortizationAmount = amountPaid;
      row.dueAmount = amountPaid;
      row.principalAmount = amountPaid;

      const principalPaid = roundMoneyValue(Math.min(amountPaid, runningBalance));
      runningBalance = roundMoneyValue(Math.max(runningBalance - principalPaid, 0));
      projectedMonthlyBalance = roundMoneyValue(Math.max(projectedMonthlyBalance - principalPaid, 0));

      row.amountPaid = principalPaid;
      row.endingBalance = runningBalance;
      row.status = principalPaid > 0 ? 'Paid' : 'Unpaid';

      // Balloon is a principal-reduction payment, not a fake scheduled SOA due row.
      // It remains visible in payment logs, while future monthly rows stay locked and shorten from the back.
      if (runningBalance <= 0) break;
      continue;
    }

    if (scheduleType === 'monthly') {
      const remainingMonthlyRows = Math.max(monthlyRows.length - monthlyIndex, 1);
      const amortizedPayment = roundMoneyValue(Number(terms.monthlyAmortization || row.monthlyAmortizationAmount || row.dueAmount || 0));
      const scheduledBalance = roundMoneyValue(Math.max(projectedMonthlyBalance, 0));

      if (scheduledBalance <= 0 && amountPaid <= 0) break;

      row.interest = roundMoneyValue(scheduledBalance * monthlyRate);
      const normalPrincipal = roundMoneyValue(Math.max(amortizedPayment - row.interest, 0));
      const isFinalPayoff = remainingMonthlyRows === 1 || normalPrincipal >= scheduledBalance;

      if (isFinalPayoff) {
        row.principalAmount = scheduledBalance;
        row.dueAmount = roundMoneyValue(row.principalAmount + row.interest);
      } else {
        row.dueAmount = amortizedPayment;
        row.principalAmount = roundMoneyValue(Math.min(normalPrincipal, scheduledBalance));
      }

      row.monthlyAmortizationAmount = row.dueAmount;
      projectedMonthlyBalance = roundMoneyValue(Math.max(projectedMonthlyBalance - row.principalAmount, 0));
      monthlyIndex += 1;
    }

    if (scheduleType === 'full_payment') {
      row.dueAmount = roundMoneyValue(Math.min(Number(row.dueAmount || 0), runningBalance));
      row.principalAmount = row.dueAmount;
      row.monthlyAmortizationAmount = row.dueAmount;
    }

    if (scheduleType !== 'monthly') {
      row.principalAmount = Number(row.principalAmount ?? row.dueAmount ?? 0);
      row.monthlyAmortizationAmount = Number(row.monthlyAmortizationAmount ?? row.dueAmount ?? 0);
    }

    const totalDue = getScheduleTotalDue(row);
    amountPaid = roundMoneyValue(Number(row.amountPaid || 0));
    const computedBreakdown = getPaymentBreakdownForRow(row, amountPaid);
    const hasExplicitBreakdown =
      row.paidPenaltyAmount !== undefined ||
      row.paid_penalty_amount !== undefined ||
      row.paidInterestAmount !== undefined ||
      row.paid_interest_amount !== undefined ||
      row.paidPrincipalAmount !== undefined ||
      row.paid_principal_amount !== undefined;
    const penaltyPaid = hasExplicitBreakdown
      ? roundMoneyValue(row.paidPenaltyAmount ?? row.paid_penalty_amount ?? computedBreakdown.penaltyPaid)
      : computedBreakdown.penaltyPaid;
    const interestPaid = hasExplicitBreakdown
      ? roundMoneyValue(row.paidInterestAmount ?? row.paid_interest_amount ?? computedBreakdown.interestPaid)
      : computedBreakdown.interestPaid;
    const principalPaid = hasExplicitBreakdown
      ? roundMoneyValue(row.paidPrincipalAmount ?? row.paid_principal_amount ?? computedBreakdown.principalPaid)
      : computedBreakdown.principalPaid;
    const discountAmount = roundMoneyValue(Number(row.discountAmount || row.discount_amount || 0));
    const principalDue = roundMoneyValue(Number(row.principalAmount ?? row.principal_amount ?? row.dueAmount ?? 0));
    const discountCredit = principalPaid > 0 && discountAmount > 0
      ? roundMoneyValue(Math.min(discountAmount, principalDue > 0 ? discountAmount * (principalPaid / principalDue) : discountAmount))
      : 0;
    const actualPrincipalReduction = roundMoneyValue(principalPaid + discountCredit);

    runningBalance = roundMoneyValue(Math.max(runningBalance - actualPrincipalReduction, 0));
    row.endingBalance = runningBalance;

    const hasDueDate = /^\d{4}-\d{2}-\d{2}$/.test(String(row.dueDate || ''));
    const hasPaidDate = /^\d{4}-\d{2}-\d{2}$/.test(String(row.datePaid || ''));

    if (amountPaid <= 0) {
      row.status = hasDueDate && row.dueDate < today ? 'Overdue' : 'Unpaid';
    } else if (amountPaid + 0.009 < totalDue) {
      row.status = 'Partial';
    } else {
      row.status = hasPaidDate && hasDueDate && row.datePaid < row.dueDate ? 'Advance' : 'Paid';
    }

    visibleRows.push({
      id: row.id,
      scheduleId: row.scheduleId || row.lot_project_payment_schedule_id || row.id,
      dueDate: row.dueDate,
      description: row.description,
      beginningBalance: row.beginningBalance,
      dueAmount: row.dueAmount,
      monthlyAmortizationAmount: row.monthlyAmortizationAmount || row.dueAmount,
      principalAmount: row.principalAmount || 0,
      interest: row.interest || 0,
      discountAmount: row.discountAmount || row.discount_amount || 0,
      penalty: row.penalty || 0,
      calculatedPenaltyAmount: row.calculatedPenaltyAmount ?? row.calculated_penalty_amount ?? row.penalty ?? 0,
      waivedPenaltyAmount: row.waivedPenaltyAmount ?? row.waived_penalty_amount ?? 0,
      outstandingPenaltyAmount: row.outstandingPenaltyAmount ?? Math.max(Number(row.penalty || 0) - penaltyPaid, 0),
      penaltyRatePercent: row.penaltyRatePercent ?? row.ratePercent ?? 0,
      penaltyGraceDays: row.penaltyGraceDays ?? row.graceDays ?? 0,
      penaltyStartDate: row.penaltyStartDate || null,
      penaltyCalculatedThrough: row.penaltyCalculatedThrough || null,
      penaltyReliefs: row.penaltyReliefs || row.reliefs || [],
      activePenaltyExtension: row.activePenaltyExtension || row.activeExtension || null,
      canGrantPenaltyExtension: Boolean(row.canGrantPenaltyExtension ?? row.canGrantExtension),
      canWaivePenalty: Boolean(row.canWaivePenalty),
      datePaid: row.datePaid || '-',
      amountPaid: row.amountPaid || 0,
      paidPrincipalAmount: principalPaid,
      paidInterestAmount: interestPaid,
      paidPenaltyAmount: penaltyPaid,
      referenceId: row.referenceId || '-',
      status: row.status,
      endingBalance: row.endingBalance,
      totalDue,
    });

    if (runningBalance <= 0 && amountPaid > 0) break;
  }

  return visibleRows;
};

export const getExistingSoaScheduleRows = async (connection, lotProjectId, listingId) => {
  if (!(await tableExists(connection, 'lot_project_payment_schedules'))) return [];

  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        lot_project_payment_schedule_id ASC
    `,
    [lotProjectId, listingId]
  );

  return rows;
};

export const canGenerateListingSoa = (listingRow = {}) => {
  const rawStatus = String(
    listingRow.lot_project_listing_status ||
      listingRow.rawStatus ||
      listingRow.status ||
      ''
  )
    .trim()
    .toLowerCase();

  const hasBuyerProfile = Boolean(
    listingRow.lot_project_client_profile_id ||
      String(listingRow.buyer_full_name || '').trim()
  );

  if (!hasBuyerProfile) return false;
  if (rawStatus === 'available' || rawStatus === 'hold') return false;

  return true;
};

export const getListingSoaRows = async (connection, lotProjectId, listingId, listingRow = {}, payments = []) => {
  if (!canGenerateListingSoa(listingRow)) return [];

  const existingScheduleRows = await getExistingSoaScheduleRows(connection, lotProjectId, listingId);
  const terms = getComputedSoaTerms(listingRow, existingScheduleRows);

  if (existingScheduleRows.length) {
    const clientProfile = { ...(listingRow || {}) };
    const snapshots = await getListingPenaltySnapshots(
      connection,
      lotProjectId,
      listingId,
      clientProfile,
      existingScheduleRows,
      todayDateOnly()
    );

    const storedRows = existingScheduleRows.map((row, index) => {
      const scheduleId = Number(row.lot_project_payment_schedule_id || 0);
      const snapshot = snapshots.get(scheduleId) || {};
      return {
        id: scheduleId,
        scheduleId,
        lot_project_payment_schedule_id: scheduleId,
        scheduleType: getStoredScheduleType(row),
        sequence: index + 1,
        dueDate: plainDate(row.due_date, null),
        description: row.description,
        beginningBalance: Number(row.beginning_balance || 0),
        dueAmount: Number(row.due_amount || 0),
        monthlyAmortizationAmount: Number(row.monthly_amortization_amount || row.due_amount || 0),
        principalAmount: Number(row.principal_amount ?? row.due_amount ?? 0),
        interest: Number(row.interest_amount || 0),
        discountAmount: getStoredRowDiscountAmount(row, clientProfile),
        penalty: Number(snapshot.penaltyAmount ?? row.penalty_amount ?? 0),
        calculatedPenaltyAmount: Number(snapshot.calculatedPenaltyAmount ?? row.calculated_penalty_amount ?? row.penalty_amount ?? 0),
        waivedPenaltyAmount: Number(snapshot.waivedPenaltyAmount ?? row.waived_penalty_amount ?? 0),
        outstandingPenaltyAmount: Number(snapshot.outstandingPenaltyAmount ?? 0),
        penaltyRatePercent: Number(snapshot.ratePercent ?? clientProfile.soa_penalty_rate_percent ?? 0),
        penaltyGraceDays: Number(snapshot.graceDays ?? clientProfile.soa_penalty_grace_days ?? 0),
        penaltyStartDate: snapshot.penaltyStartDate || null,
        penaltyCalculatedThrough: snapshot.penaltyCalculatedThrough || null,
        penaltyReliefs: snapshot.reliefs || [],
        activePenaltyExtension: snapshot.activeExtension || null,
        canGrantPenaltyExtension: Boolean(snapshot.canGrantExtension),
        canWaivePenalty: Boolean(snapshot.canWaivePenalty),
        datePaid: plainDate(row.date_paid),
        amountPaid: Number(row.amount_paid || 0),
        paidPrincipalAmount: Number(row.paid_principal_amount || 0),
        paidInterestAmount: Number(row.paid_interest_amount || 0),
        paidPenaltyAmount: Number(snapshot.paidPenaltyAmount ?? row.paid_penalty_amount ?? 0),
        referenceId: row.reference_id || '-',
        status: row.schedule_status || 'Unpaid',
        endingBalance: Number(row.ending_balance || 0),
      };
    });

    return recomputeComputedSoaBalances(storedRows, terms);
  }

  const computedRows = createComputedSoaRows(terms);
  const rowsWithPayments = allocatePaymentsToComputedRows(computedRows, payments);
  return recomputeComputedSoaBalances(rowsWithPayments, terms);
};


export const getRequestToken = (req) => {
  const authorization = String(req.headers?.authorization || '').trim();

  if (authorization.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim();
  }

  return (
    req.cookies?.token ||
    req.cookies?.authToken ||
    req.cookies?.auth_token ||
    req.cookies?.access_token ||
    null
  );
};

export const getAuthenticatedUser = async (req) => {
  const token = getRequestToken(req);
  if (!token || !process.env.JWT_SECRET) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id || decoded.user_id || decoded.userId;

    if (!userId) return null;

    const [rows] = await db.query(
      `
        SELECT id, first_name, middle_name, last_name, email, role, password_hash, status
        FROM users
        WHERE id = ?
        LIMIT 1
      `,
      [userId]
    );

    const user = rows[0];
    if (!user || user.status !== 'active') return null;
    return user;
  } catch {
    return null;
  }
};

export const getUserFullName = (user = {}) => {
  const safeUser = user || {};
  const name = [safeUser.first_name, safeUser.middle_name, safeUser.last_name]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');

  return name || safeUser.email || '-';
};

export const getListingForPayment = async (connection, project, listingLookup) => {
  const lookup = getListingLookupWhere(listingLookup);
  const [rows] = await connection.query(
    `
      SELECT
        l.lot_project_listing_id,
        l.lot_project_id,
        l.lot_project_listing_unit_id,
        l.lot_project_listing_tcp,
        cp.lot_project_client_profile_id,
        cp.buyer_full_name
      FROM lot_project_listings l
      LEFT JOIN lot_project_client_profiles cp
        ON cp.lot_project_listing_id = l.lot_project_listing_id
      WHERE l.lot_project_id = ?
        AND ${lookup.sql}
      LIMIT 1
    `,
    [project.lot_project_id, ...lookup.params]
  );

  return rows[0] || null;
};

export const normalizePaymentType = (value = '') => {
  const clean = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ');

  if (clean === 'reservation') return 'reservation';
  if (clean === 'downpayment' || clean === 'down payment') return 'downpayment';
  if (clean === 'monthly' || clean === 'monthly amortization') return 'monthly_amortization';
  if (clean === 'advance payment' || clean === 'advance') return 'advance_payment';
  if (clean === 'balloon' || clean === 'balloon payment') return 'balloon';
  if (clean === 'full payment' || clean === 'full') return 'full_payment';
  if (clean === 'legal misc' || clean === 'legal/misc' || clean === 'legal misc fee' || clean === 'legal / misc fee' || clean === 'lmf') return 'legal_misc';
  return 'other';
};

export const getPaymentTypeLabel = (value = '') => {
  const labels = {
    reservation: 'Reservation',
    downpayment: 'Downpayment',
    monthly_amortization: 'Monthly',
    advance_payment: 'Advance Payment',
    balloon: 'Balloon',
    full_payment: 'Full Payment',
    legal_misc: 'Other',
    other: 'Other',
  };

  return labels[String(value || '').toLowerCase()] || 'Other';
};

export const normalizePaymentMethod = (value = '') => {
  const clean = String(value || 'Cash').trim().toLowerCase();

  if (clean === 'cash') return 'Cash';
  if (clean === 'bank transfer' || clean === 'bank') return 'Bank Transfer';
  if (clean === 'online transfer' || clean === 'online payment' || clean === 'gcash') return 'Online Payment';
  if (clean === 'check' || clean === 'cheque') return 'Check';
  return 'Other';
};

export const getNextCashReference = async (connection, unitCode) => {
  const dateKey = todayDateOnly().replaceAll('-', '');
  const cleanUnit = String(unitCode || 'UNIT').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const prefix = `CASH-${dateKey}-${cleanUnit}`;

  const [rows] = await connection.query(
    `
      SELECT COUNT(*) AS total
      FROM lot_project_payments
      WHERE lot_project_payment_reference_id LIKE ?
    `,
    [`${prefix}-%`]
  );

  const nextNumber = String(Number(rows[0]?.total || 0) + 1).padStart(4, '0');
  return `${prefix}-${nextNumber}`;
};

export const mapPaymentRow = (row = {}) => ({
  id: row.lot_project_payment_id,
  paymentId: row.lot_project_payment_id,
  soaRowId: row.lot_project_payment_schedule_id,
  paymentType: getPaymentTypeLabel(row.lot_project_payment_type),
  paymentTypeValue: row.lot_project_payment_type,
  scheduleDescription: row.schedule_description || '-',
  type: getPaymentTypeLabel(row.lot_project_payment_type),
  method: row.lot_project_payment_method || '-',
  amount: Number(row.lot_project_payment_amount || 0),
  paymentDate: plainDate(row.lot_project_payment_date),
  referenceId: row.lot_project_payment_reference_id || '-',
  verifiedBy: row.verified_by_name || '-',
  verifiedAt: formatDateTime(row.lot_project_payment_verified_at),
  status: row.lot_project_payment_status || 'Verified',
  createdAt: formatDateTime(row.lot_project_payment_created_at),
  updatedAt: formatDateTime(row.lot_project_payment_updated_at),
});

export const getListingPayments = async (connection, lotProjectId, listingId) => {
  if (!(await tableExists(connection, 'lot_project_payments'))) return [];

  const [rows] = await connection.query(
    `
      SELECT
        p.*,
        ps.description AS schedule_description,
        TRIM(CONCAT_WS(' ', u.first_name, u.middle_name, u.last_name)) AS verified_by_name
      FROM lot_project_payments p
      LEFT JOIN lot_project_payment_schedules ps
        ON ps.lot_project_payment_schedule_id = p.lot_project_payment_schedule_id
      LEFT JOIN users u
        ON u.id = p.lot_project_payment_verified_by_user_id
      WHERE p.lot_project_id = ?
        AND p.lot_project_listing_id = ?
        AND p.lot_project_payment_status = 'Verified'
      ORDER BY p.lot_project_payment_date DESC, p.lot_project_payment_id DESC
    `,
    [lotProjectId, listingId]
  );

  return rows.map(mapPaymentRow);
};

export const recomputeListingScheduleBalances = async (connection, listing) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
      ORDER BY
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        lot_project_payment_schedule_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id]
  );

  const [clientProfileRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_client_profiles
      WHERE lot_project_listing_id = ?
      LIMIT 1
    `,
    [listing.lot_project_listing_id]
  );

  const clientProfile = { ...(listing || {}), ...(clientProfileRows[0] || {}) };
  const terms = getComputedSoaTerms(clientProfile, rows);
  let runningBalance = roundMoneyValue(terms.principalTcp ?? terms.tcp ?? 0);
  const hasPaidColumns = await columnExists(connection, 'lot_project_payment_schedules', 'paid_principal_amount');

  for (const row of rows) {
    const beginningBalance = runningBalance;
    const paidAmount = Number(row.amount_paid || 0);
    const penaltyDue = Number(row.penalty_amount || 0);
    const interestDue = Number(row.interest_amount || 0);
    const principalDue = Number(row.principal_amount ?? row.due_amount ?? 0);
    const discountInfo = getStoredRowDiscountInfo(row, clientProfile);

    let remainingPaid = paidAmount;
    const paidPenalty = roundMoneyValue(Math.min(remainingPaid, penaltyDue));
    remainingPaid = roundMoneyValue(Math.max(remainingPaid - paidPenalty, 0));

    const paidInterest = roundMoneyValue(Math.min(remainingPaid, interestDue));
    remainingPaid = roundMoneyValue(Math.max(remainingPaid - paidInterest, 0));

    const paidPrincipal = roundMoneyValue(Math.min(remainingPaid, principalDue, runningBalance));
    const principalCashDue = roundMoneyValue(Math.max(discountInfo.cashDueAmount - penaltyDue - interestDue, 0));
    const discountCredit = discountInfo.discountAmount > 0 && paidPrincipal > 0
      ? roundMoneyValue(Math.min(discountInfo.discountAmount, discountInfo.discountAmount * Math.min(paidPrincipal / Math.max(principalCashDue, 1), 1)))
      : 0;
    const principalReduction = roundMoneyValue(Math.min(paidPrincipal + discountCredit, runningBalance));
    runningBalance = roundMoneyValue(Math.max(runningBalance - principalReduction, 0));

    const setColumns = ['beginning_balance = ?', 'ending_balance = ?'];
    const values = [beginningBalance, runningBalance];

    if (hasPaidColumns) {
      setColumns.push('paid_penalty_amount = ?', 'paid_interest_amount = ?', 'paid_principal_amount = ?');
      values.push(paidPenalty, paidInterest, paidPrincipal);
    }

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET ${setColumns.join(',\n            ')}
        WHERE lot_project_payment_schedule_id = ?
      `,
      [...values, row.lot_project_payment_schedule_id]
    );
  }
};

export const applyPaymentToSchedules = async (connection, listing, paymentId, preferredScheduleId, amount, paymentDate, referenceId, paymentType) => {
  if (!(await tableExists(connection, 'lot_project_payment_allocations'))) {
    throw new Error('lot_project_payment_allocations table does not exist. Run the payments SOA migration first.');
  }

  const [clientProfileRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_client_profiles
      WHERE lot_project_client_profile_id = ?
      LIMIT 1
    `,
    [listing.lot_project_client_profile_id]
  );
  const clientProfile = { ...(listing || {}), ...(clientProfileRows[0] || {}) };

  const [scheduleRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payment_schedules
      WHERE lot_project_id = ?
        AND lot_project_listing_id = ?
      ORDER BY
        CASE WHEN lot_project_payment_schedule_id = ? THEN 0 ELSE 1 END,
        CASE WHEN due_date IS NULL THEN 1 ELSE 0 END,
        due_date ASC,
        lot_project_payment_schedule_id ASC
    `,
    [listing.lot_project_id, listing.lot_project_listing_id, preferredScheduleId || 0]
  );

  if (!scheduleRows.length) {
    throw new Error('No SOA schedule row is available for this listing.');
  }

  const restrictedType = paymentTypeToStoredScheduleType(paymentType);
  const preferredRow = preferredScheduleId
    ? scheduleRows.find((row) => isSameScheduleId(row, preferredScheduleId))
    : null;
  const typeFilteredRows = restrictedType
    ? scheduleRows.filter((row) => getStoredScheduleType(row) === restrictedType || isSameScheduleId(row, preferredScheduleId))
    : scheduleRows;
  const orderedTargets = preferredRow
    ? [preferredRow, ...typeFilteredRows.filter((row) => !isSameScheduleId(row, preferredRow.lot_project_payment_schedule_id))]
    : typeFilteredRows;

  let remaining = roundMoneyValue(Number(amount || 0));

  for (const row of orderedTargets) {
    if (remaining <= 0) break;

    const totalDue = getStoredRowTotalDue(row, clientProfile);
    const currentPaid = Number(row.amount_paid || 0);
    const unpaidForRow = Math.max(totalDue - currentPaid, 0);

    if (unpaidForRow <= 0) continue;

    const appliedAmount = roundMoneyValue(Math.min(remaining, unpaidForRow));
    const nextPaid = roundMoneyValue(currentPaid + appliedAmount);
    const isPaid = nextPaid + 0.009 >= totalDue;
    const paidBeforeDue = paymentDate && row.due_date && String(paymentDate).slice(0, 10) < String(row.due_date).slice(0, 10);
    const nextStatus = isPaid ? (paidBeforeDue ? 'Advance' : 'Paid') : 'Partial';

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET amount_paid = ?,
            date_paid = ?,
            reference_id = ?,
            schedule_status = ?
        WHERE lot_project_payment_schedule_id = ?
      `,
      [nextPaid, paymentDate, referenceId, nextStatus, row.lot_project_payment_schedule_id]
    );

    await connection.query(
      `
        INSERT INTO lot_project_payment_allocations (
          lot_project_payment_id,
          lot_project_payment_schedule_id,
          applied_amount
        ) VALUES (?, ?, ?)
      `,
      [paymentId, row.lot_project_payment_schedule_id, appliedAmount]
    );

    remaining = roundMoneyValue(remaining - appliedAmount);
  }

  if (remaining > 0) {
    throw new Error('Payment amount exceeds the remaining unpaid SOA balance for this payment type.');
  }

  await recomputeListingScheduleBalances(connection, listing);
};

export const reversePaymentAllocations = async (connection, listing, paymentId) => {
  if (!(await tableExists(connection, 'lot_project_payment_allocations'))) return;

  const [clientProfileRows] = await connection.query(
    `
      SELECT *
      FROM lot_project_client_profiles
      WHERE lot_project_client_profile_id = ?
      LIMIT 1
    `,
    [listing.lot_project_client_profile_id]
  );
  const clientProfile = { ...(listing || {}), ...(clientProfileRows[0] || {}) };

  const [allocations] = await connection.query(
    `
      SELECT lot_project_payment_schedule_id, applied_amount
      FROM lot_project_payment_allocations
      WHERE lot_project_payment_id = ?
    `,
    [paymentId]
  );

  for (const allocation of allocations) {
    const [scheduleRows] = await connection.query(
      `
        SELECT *
        FROM lot_project_payment_schedules
        WHERE lot_project_payment_schedule_id = ?
        LIMIT 1
      `,
      [allocation.lot_project_payment_schedule_id]
    );

    const schedule = scheduleRows[0];
    if (!schedule) continue;

    const nextPaid = roundMoneyValue(Math.max(Number(schedule.amount_paid || 0) - Number(allocation.applied_amount || 0), 0));
    const totalDue = getStoredRowTotalDue(schedule, clientProfile);
    const paidBeforeDue = schedule.date_paid && schedule.due_date && String(schedule.date_paid).slice(0, 10) < String(schedule.due_date).slice(0, 10);
    const nextStatus = nextPaid <= 0
      ? 'Unpaid'
      : nextPaid + 0.009 >= totalDue
        ? (paidBeforeDue ? 'Advance' : 'Paid')
        : 'Partial';

    await connection.query(
      `
        UPDATE lot_project_payment_schedules
        SET amount_paid = ?,
            date_paid = CASE WHEN ? <= 0 THEN NULL ELSE date_paid END,
            reference_id = CASE WHEN ? <= 0 THEN NULL ELSE reference_id END,
            schedule_status = ?
        WHERE lot_project_payment_schedule_id = ?
      `,
      [nextPaid, nextPaid, nextPaid, nextStatus, allocation.lot_project_payment_schedule_id]
    );
  }

  await connection.query(
    `DELETE FROM lot_project_payment_allocations WHERE lot_project_payment_id = ?`,
    [paymentId]
  );

  await recomputeListingScheduleBalances(connection, listing);
};

export const getPaymentById = async (connection, project, listing, paymentId) => {
  const [rows] = await connection.query(
    `
      SELECT *
      FROM lot_project_payments
      WHERE lot_project_payment_id = ?
        AND lot_project_id = ?
        AND lot_project_listing_id = ?
      LIMIT 1
    `,
    [paymentId, project.lot_project_id, listing.lot_project_listing_id]
  );

  return rows[0] || null;
};

export const dateOrNull = (value) => {
  const clean = String(value || '').trim();
  return clean ? clean.slice(0, 10) : null;
};

export const parseMoneyValue = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  const numberValue = Number(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isNaN(numberValue) ? 0 : numberValue;
};

export const cleanBuyerType = (value) => {
  const clean = String(value || 'single').trim();
  return ['single', 'spouses', 'and_account'].includes(clean) ? clean : 'single';
};

export const cleanSecondBuyerRole = (value, buyerType) => {
  const clean = String(value || '').trim();
  if (['spouse', 'co_owner', 'second_buyer'].includes(clean)) return clean;
  return buyerType === 'spouses' ? 'spouse' : 'co_owner';
};

export const addIfColumnExists = async (connection, tableName, columns, values, columnName, value) => {
  if (await columnExists(connection, tableName, columnName)) {
    columns.push(columnName);
    values.push(value);
  }
};
