import crypto from 'node:crypto';
import { columnExists, tableExists } from '../_shared/lotProject.shared.js';

export const BUYER_FORM_LINK_STATUSES = new Set([
  'active',
  'opened',
  'submitted',
  'expired',
  'revoked',
  'superseded',
  'consumed',
]);

const profileTextFields = [
  'buyerType',
  'buyerFirstName',
  'buyerMiddleName',
  'buyerLastName',
  'buyerSuffix',
  'buyerName',
  'birthDate',
  'placeOfBirth',
  'citizenship',
  'gender',
  'civilStatus',
  'contactNo',
  'residencePhoneNumber',
  'email',
  'tin',
  'presentAddress',
  'presentZipCode',
  'permanentAddress',
  'permanentZipCode',
  'employmentStatus',
  'employerBusinessName',
  'employerZipCode',
  'natureOfWorkBusiness',
  'occupationPositionTitle',
  'monthlyIncome',
  'employerBusinessAddress',
  'secondBuyerRole',
  'secondBuyerFirstName',
  'secondBuyerMiddleName',
  'secondBuyerLastName',
  'secondBuyerSuffix',
  'secondBuyerName',
  'secondBuyerBirthDate',
  'secondBuyerPlaceOfBirth',
  'secondBuyerCitizenship',
  'secondBuyerGender',
  'secondBuyerCivilStatus',
  'secondBuyerContactNo',
  'secondBuyerResidencePhoneNumber',
  'secondBuyerEmail',
  'secondBuyerTin',
  'secondBuyerPresentAddress',
  'secondBuyerPresentZipCode',
  'secondBuyerPermanentAddress',
  'secondBuyerPermanentZipCode',
  'secondBuyerEmploymentStatus',
  'secondBuyerEmployerBusinessName',
  'secondBuyerEmployerZipCode',
  'secondBuyerNatureOfWorkBusiness',
  'secondBuyerOccupationPositionTitle',
  'secondBuyerMonthlyIncome',
  'secondBuyerEmployerBusinessAddress',
];

const principalRequiredFields = [
  ['buyerFirstName', 'Principal buyer first name'],
  ['buyerLastName', 'Principal buyer last name'],
  ['birthDate', 'Principal buyer birth date'],
  ['placeOfBirth', 'Principal buyer place of birth'],
  ['citizenship', 'Principal buyer citizenship'],
  ['gender', 'Principal buyer gender'],
  ['civilStatus', 'Principal buyer civil status'],
  ['contactNo', 'Principal buyer mobile number'],
  ['presentAddress', 'Principal buyer present address'],
  ['presentZipCode', 'Principal buyer present ZIP code'],
  ['employmentStatus', 'Principal buyer employment status'],
  ['monthlyIncome', 'Principal buyer monthly income'],
];

const secondBuyerRequiredFields = [
  ['secondBuyerRole', 'Spouse / second buyer role'],
  ['secondBuyerFirstName', 'Spouse / second buyer first name'],
  ['secondBuyerLastName', 'Spouse / second buyer last name'],
  ['secondBuyerBirthDate', 'Spouse / second buyer birth date'],
  ['secondBuyerPlaceOfBirth', 'Spouse / second buyer place of birth'],
  ['secondBuyerCitizenship', 'Spouse / second buyer citizenship'],
  ['secondBuyerGender', 'Spouse / second buyer gender'],
  ['secondBuyerCivilStatus', 'Spouse / second buyer civil status'],
  ['secondBuyerContactNo', 'Spouse / second buyer mobile number'],
  ['secondBuyerPresentAddress', 'Spouse / second buyer present address'],
  ['secondBuyerPresentZipCode', 'Spouse / second buyer present ZIP code'],
  ['secondBuyerEmploymentStatus', 'Spouse / second buyer employment status'],
  ['secondBuyerMonthlyIncome', 'Spouse / second buyer monthly income'],
];

const cleanText = (value, maxLength = 2000) =>
  String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);

const buildName = ({ firstName, middleName, lastName, suffix }) =>
  [firstName, middleName, lastName, suffix].map((value) => cleanText(value, 100)).filter(Boolean).join(' ');

const cleanBuyerType = (value) => {
  const candidate = cleanText(value, 30).toLowerCase();
  return ['single', 'spouses', 'and_account'].includes(candidate) ? candidate : 'single';
};

const cleanBuyerRole = (value, buyerType) => {
  const candidate = cleanText(value, 30).toLowerCase();
  if (['spouse', 'co_owner', 'second_buyer'].includes(candidate)) return candidate;
  return buyerType === 'spouses' ? 'spouse' : 'co_owner';
};

const isFutureDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const input = new Date(`${value}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Number.isFinite(input.getTime()) && input.getTime() > today.getTime();
};

const isValidDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00`);
  return Number.isFinite(date.getTime());
};

const isValidEmail = (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export const getRequestIp = (req) =>
  String(req?.headers?.['x-forwarded-for'] || req?.ip || '')
    .split(',')[0]
    .trim()
    .slice(0, 45) || null;

export const hashBuyerFormToken = (token) =>
  crypto.createHash('sha256').update(String(token || '')).digest('hex');

export const createBuyerFormToken = () => crypto.randomBytes(32).toString('base64url');

export const parseJsonObject = (value, fallback = {}) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
};

export const sanitizeBuyerProfilePayload = (input = {}) => {
  const profile = {};
  for (const field of profileTextFields) {
    const maxLength = field.toLowerCase().includes('address') ? 2000 : 255;
    profile[field] = cleanText(input[field], maxLength);
  }

  profile.buyerType = cleanBuyerType(input.buyerType || input.buyer_type);
  profile.secondBuyerRole = cleanBuyerRole(input.secondBuyerRole || input.second_buyer_role, profile.buyerType);
  profile.buyerName = buildName({
    firstName: profile.buyerFirstName,
    middleName: profile.buyerMiddleName,
    lastName: profile.buyerLastName,
    suffix: profile.buyerSuffix,
  });
  profile.secondBuyerName = buildName({
    firstName: profile.secondBuyerFirstName,
    middleName: profile.secondBuyerMiddleName,
    lastName: profile.secondBuyerLastName,
    suffix: profile.secondBuyerSuffix,
  });

  if (profile.buyerType === 'single') {
    for (const field of profileTextFields.filter((field) => field.startsWith('secondBuyer'))) {
      profile[field] = '';
    }
    profile.secondBuyerRole = 'spouse';
  }

  return profile;
};

export const validateBuyerProfilePayload = (input = {}) => {
  const profile = sanitizeBuyerProfilePayload(input);
  const hasSecondBuyer = profile.buyerType === 'spouses' || profile.buyerType === 'and_account';
  const fields = hasSecondBuyer
    ? [...principalRequiredFields, ...secondBuyerRequiredFields]
    : principalRequiredFields;

  const missing = fields.find(([field]) => !cleanText(profile[field]));
  if (missing) return { ok: false, message: `${missing[1]} is required.`, field: missing[0], profile };

  const dateFields = [
    ['birthDate', 'Principal buyer birth date'],
    ...(hasSecondBuyer ? [['secondBuyerBirthDate', 'Spouse / second buyer birth date']] : []),
  ];

  for (const [field, label] of dateFields) {
    if (!isValidDate(profile[field])) return { ok: false, message: `${label} is invalid.`, field, profile };
    if (isFutureDate(profile[field])) return { ok: false, message: `${label} cannot be in the future.`, field, profile };
  }

  const incomeFields = [
    ['monthlyIncome', 'Principal buyer monthly income'],
    ...(hasSecondBuyer ? [['secondBuyerMonthlyIncome', 'Spouse / second buyer monthly income']] : []),
  ];

  for (const [field, label] of incomeFields) {
    const amount = Number(String(profile[field]).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount < 0) {
      return { ok: false, message: `${label} must be a valid non-negative amount.`, field, profile };
    }
    profile[field] = String(amount);
  }

  for (const [field, label] of [
    ['email', 'Principal buyer email'],
    ...(hasSecondBuyer ? [['secondBuyerEmail', 'Spouse / second buyer email']] : []),
  ]) {
    if (!isValidEmail(profile[field])) return { ok: false, message: `${label} is invalid.`, field, profile };
  }

  return { ok: true, profile };
};

export const hasBuyerFormSchema = async (connection) => (
  (await tableExists(connection, 'lot_project_buyer_form_links')) &&
  (await tableExists(connection, 'lot_project_buyer_form_submissions')) &&
  (await columnExists(connection, 'lot_project_listings', 'buyer_form_generation')) &&
  (await columnExists(connection, 'lot_project_listings', 'pending_buyer_form_submission_id'))
);

export const assertBuyerFormSchema = async (connection) => {
  const requiredTables = ['lot_project_buyer_form_links', 'lot_project_buyer_form_submissions'];
  const missing = [];

  for (const tableName of requiredTables) {
    if (!(await tableExists(connection, tableName))) missing.push(`table ${tableName}`);
  }

  for (const columnName of ['buyer_form_generation', 'pending_buyer_form_submission_id']) {
    if (!(await columnExists(connection, 'lot_project_listings', columnName))) {
      missing.push(`lot_project_listings.${columnName}`);
    }
  }

  if (missing.length) {
    const error = new Error(
      `Buyer form database migration is incomplete. Missing: ${missing.join(', ')}. Run server/migrations/20260715_add_buyer_form_links.sql.`
    );
    error.statusCode = 500;
    throw error;
  }
};

export const expireBuyerFormLinks = async (connection, listingId = null) => {
  const where = listingId ? 'AND lot_project_listing_id = ?' : '';
  await connection.query(
    `
      UPDATE lot_project_buyer_form_links
      SET link_status = 'expired', updated_at = NOW()
      WHERE link_status IN ('active', 'opened')
        AND expires_at <= NOW()
        ${where}
    `,
    listingId ? [listingId] : []
  );
};

export const revokeOpenBuyerFormLinks = async (
  connection,
  listingId,
  { status = 'superseded', excludeLinkId = null } = {}
) => {
  const normalizedStatus = ['revoked', 'superseded', 'consumed'].includes(status) ? status : 'superseded';
  const params = [normalizedStatus, listingId];
  const excludeSql = excludeLinkId ? 'AND lot_project_buyer_form_link_id <> ?' : '';
  if (excludeLinkId) params.push(excludeLinkId);

  await connection.query(
    `
      UPDATE lot_project_buyer_form_links
      SET link_status = ?,
          revoked_at = CASE WHEN ? = 'revoked' THEN NOW() ELSE revoked_at END,
          updated_at = NOW()
      WHERE lot_project_listing_id = ?
        AND link_status IN ('active', 'opened')
        ${excludeSql}
    `,
    [normalizedStatus, normalizedStatus, listingId, ...(excludeLinkId ? [excludeLinkId] : [])]
  );
};

export const resetBuyerFormsForAvailable = async (connection, listingId) => {
  await assertBuyerFormSchema(connection);

  await connection.query(
    `
      UPDATE lot_project_buyer_form_links
      SET link_status = CASE
            WHEN link_status = 'consumed' THEN link_status
            ELSE 'superseded'
          END,
          updated_at = NOW()
      WHERE lot_project_listing_id = ?
        AND link_status <> 'consumed'
    `,
    [listingId]
  );

  await connection.query(
    `
      UPDATE lot_project_buyer_form_submissions
      SET submission_status = CASE
            WHEN submission_status = 'approved' THEN 'archived'
            WHEN submission_status IN ('submitted', 'pending_review') THEN 'cancelled'
            ELSE submission_status
          END,
          updated_at = NOW()
      WHERE lot_project_listing_id = ?
    `,
    [listingId]
  );

  await connection.query(
    `
      UPDATE lot_project_listings
      SET buyer_form_generation = buyer_form_generation + 1,
          pending_buyer_form_submission_id = NULL
      WHERE lot_project_listing_id = ?
    `,
    [listingId]
  );
};

export const getBuyerFormAdminState = async (connection, listingId, accountId = 0) => {
  await assertBuyerFormSchema(connection);
  await expireBuyerFormLinks(connection, listingId);

  const [linkRows] = await connection.query(
    `
      SELECT
        lot_project_buyer_form_link_id AS id,
        link_status AS status,
        generation_number AS generation,
        expires_at AS expiresAt,
        generated_at AS generatedAt,
        first_opened_at AS firstOpenedAt,
        last_opened_at AS lastOpenedAt,
        submitted_at AS submittedAt,
        recipient_email AS recipientEmail,
        recipient_mobile_number AS recipientMobileNumber
      FROM lot_project_buyer_form_links
      WHERE lot_project_listing_id = ?
        AND (? = 0 OR lot_project_account_id = ?)
      ORDER BY lot_project_buyer_form_link_id DESC
      LIMIT 1
    `,
    [listingId, Number(accountId || 0), Number(accountId || 0)]
  );

  const [submissionRows] = await connection.query(
    `
      SELECT
        lot_project_buyer_form_submission_id AS id,
        lot_project_buyer_form_link_id AS linkId,
        submission_status AS status,
        buyer_full_name AS buyerName,
        buyer_email AS buyerEmail,
        buyer_contact_number AS buyerContactNumber,
        buyer_type AS buyerType,
        submitted_payload_json AS submittedPayload,
        approved_payload_json AS approvedPayload,
        submitted_at AS submittedAt,
        reviewed_at AS reviewedAt,
        approved_at AS approvedAt,
        rejected_at AS rejectedAt,
        rejection_reason AS rejectionReason
      FROM lot_project_buyer_form_submissions
      WHERE lot_project_listing_id = ?
        AND (? = 0 OR lot_project_account_id = ?)
      ORDER BY lot_project_buyer_form_submission_id DESC
      LIMIT 1
    `,
    [listingId, Number(accountId || 0), Number(accountId || 0)]
  );

  const submission = submissionRows[0]
    ? {
        ...submissionRows[0],
        submittedPayload: parseJsonObject(submissionRows[0].submittedPayload),
        approvedPayload: parseJsonObject(submissionRows[0].approvedPayload),
      }
    : null;

  return {
    currentLink: linkRows[0] || null,
    latestSubmission: submission,
    pendingSubmission:
      submission && ['submitted', 'pending_review'].includes(submission.status) ? submission : null,
  };
};

export const getPublicBuyerFormUrl = (req, token) => {
  const explicit = String(process.env.PUBLIC_APP_URL || '').trim().replace(/\/$/, '');
  if (explicit) return `${explicit}/buyer-form/${token}`;

  const corsOrigin = String(process.env.CORS_ORIGIN || '')
    .split(',')
    .map((value) => value.trim())
    .find(Boolean);
  const origin = String(req?.headers?.origin || corsOrigin || 'http://localhost:5174').replace(/\/$/, '');
  return `${origin}/buyer-form/${token}`;
};


