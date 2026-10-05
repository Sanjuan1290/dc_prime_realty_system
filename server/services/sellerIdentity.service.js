// D&C Prime Realty
// Seller identity guard (2026-10-05 plan, items 8-12).
//
// One person must not be an ACTIVE accredited seller in two places at once.
// Email alone is not enough because the same person can be registered with a
// second email address, so active in-house sellers are also matched by:
//   * PRC No.  (required for in-house sellers, unique among active sellers)
//   * TIN      (optional, unique among active sellers when provided)
//   * Full name + contact number (warning only; names legitimately repeat)
//
// "Active seller" means users.status = 'active' AND
// accredited_sellers.accredited_seller_status = 'active'. Setting a seller
// Inactive frees their PRC/TIN, which matches the Network rule
// "set the seller Inactive in the old Network before adding them elsewhere".
//
// This is enforced in the application layer (inside the same DB transaction
// as the write) because PRC/TIN live on `users` while membership status lives
// on `accredited_sellers`; a pure database index would require duplicating the
// PRC onto a second table. Every seller write path calls this service.

export const IN_HOUSE_SELLER_ROLES = Object.freeze([
  'division_manager',
  'sales_director',
  'unit_manager',
  'sales_agent',
]);

const ROLE_SQL_LIST = IN_HOUSE_SELLER_ROLES.map((role) => `'${role}'`).join(', ');

/** Uppercase and strip spaces, dashes, dots and slashes: "123-456 789" -> "123456789". */
export const normalizeSellerIdentityNumber = (value) =>
  String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

export const normalizeSellerName = (value) =>
  String(value ?? '').trim().replace(/\s+/g, ' ').toLowerCase();

export const normalizeSellerContact = (value) => String(value ?? '').replace(/\D/g, '').slice(-10);

// SQL expression that mirrors normalizeSellerIdentityNumber for a column.
const normalizedNumberSql = (column) =>
  `UPPER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(TRIM(IFNULL(${column}, '')), '-', ''), ' ', ''), '.', ''), '/', ''), '_', ''))`;

const conflictError = (message, code) => Object.assign(new Error(message), { statusCode: 409, code });

const describeSeller = (row = {}) => {
  const name = [row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ').trim() || row.email || `User #${row.user_id}`;
  const network = row.seller_group_name ? ` in ${row.seller_group_name}` : '';
  return `${name}${network}`;
};

/**
 * Loads active in-house sellers that share a PRC/TIN with any of the given values.
 * Returns plain rows so the pure analyzer (Excel import) can reuse them.
 */
export const loadActiveSellerIdentityMatches = async (connection, { prcNumbers = [], tinNumbers = [], lock = false } = {}) => {
  const prcs = [...new Set(prcNumbers.map(normalizeSellerIdentityNumber).filter(Boolean))];
  const tins = [...new Set(tinNumbers.map(normalizeSellerIdentityNumber).filter(Boolean))];
  if (!prcs.length && !tins.length) return [];

  const clauses = [];
  const params = [];
  if (prcs.length) {
    clauses.push(`${normalizedNumberSql('user.prc_no')} IN (${prcs.map(() => '?').join(', ')})`);
    params.push(...prcs);
  }
  if (tins.length) {
    clauses.push(`${normalizedNumberSql('user.tin_no')} IN (${tins.map(() => '?').join(', ')})`);
    params.push(...tins);
  }

  const [rows] = await connection.query(
    `SELECT user.id AS user_id, user.first_name, user.middle_name, user.last_name, user.email,
            user.contact_no, user.prc_no, user.tin_no, user.role,
            group_row.seller_group_name
       FROM users user
       INNER JOIN accredited_sellers seller ON seller.user_id = user.id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
      WHERE user.status = 'active'
        AND seller.accredited_seller_status = 'active'
        AND COALESCE(seller.is_system_dummy, 0) = 0
        AND user.role IN (${ROLE_SQL_LIST})
        AND (${clauses.join(' OR ')})${lock ? ' FOR UPDATE' : ''}`,
    params
  );
  return rows.map((row) => ({
    ...row,
    prc_normalized: normalizeSellerIdentityNumber(row.prc_no),
    tin_normalized: normalizeSellerIdentityNumber(row.tin_no),
  }));
};

/**
 * Pure check used by the API paths and the Excel analyzer.
 * Returns { errors: string[] } for the candidate against already-loaded matches.
 */
export const findSellerIdentityConflicts = ({ prcNo, tinNo, excludeUserIds = [], matches = [] }) => {
  const prc = normalizeSellerIdentityNumber(prcNo);
  const tin = normalizeSellerIdentityNumber(tinNo);
  const excluded = new Set(excludeUserIds.map(Number).filter(Boolean));
  const errors = [];
  const others = matches.filter((row) => !excluded.has(Number(row.user_id)));
  const prcOwner = prc ? others.find((row) => row.prc_normalized === prc) : null;
  const tinOwner = tin ? others.find((row) => row.tin_normalized === tin) : null;
  if (prcOwner) {
    errors.push(`PRC No. ${prcNo} already belongs to an active seller: ${describeSeller(prcOwner)}. Set that seller Inactive first, or update the existing seller instead of creating a new one.`);
  }
  if (tinOwner) {
    errors.push(`TIN ${tinNo} already belongs to an active seller: ${describeSeller(tinOwner)}. Set that seller Inactive first, or update the existing seller instead of creating a new one.`);
  }
  return { errors };
};

/** Non-blocking warning: same full name AND same contact number as another active seller. */
export const findSellerNameContactWarnings = async (connection, { firstName, middleName, lastName, contactNo, excludeUserIds = [] }) => {
  const contact = normalizeSellerContact(contactNo);
  if (!contact || !firstName || !lastName) return [];
  const fullName = normalizeSellerName([firstName, middleName, lastName].filter(Boolean).join(' '));
  const [rows] = await connection.query(
    `SELECT user.id AS user_id, user.first_name, user.middle_name, user.last_name, user.email,
            user.contact_no, group_row.seller_group_name
       FROM users user
       INNER JOIN accredited_sellers seller ON seller.user_id = user.id
       LEFT JOIN seller_groups group_row ON group_row.seller_group_id = seller.seller_group_id
      WHERE user.status = 'active'
        AND seller.accredited_seller_status = 'active'
        AND COALESCE(seller.is_system_dummy, 0) = 0
        AND user.role IN (${ROLE_SQL_LIST})
        AND LOWER(TRIM(user.last_name)) = LOWER(TRIM(?))
      LIMIT 200`,
    [lastName]
  );
  const excluded = new Set(excludeUserIds.map(Number).filter(Boolean));
  return rows
    .filter((row) => !excluded.has(Number(row.user_id)))
    .filter((row) => normalizeSellerName([row.first_name, row.middle_name, row.last_name].filter(Boolean).join(' ')) === fullName)
    .filter((row) => normalizeSellerContact(row.contact_no) === contact)
    .map((row) => `Possible duplicate: ${describeSeller(row)} has the same full name and contact number. Check that this is a different person.`);
};

/**
 * API-path guard for Create User / Edit User / Add Member.
 * - PRC No. is required for in-house seller roles.
 * - PRC/TIN must not belong to another ACTIVE seller.
 * Only runs the uniqueness check when the record will be active and
 * checkUniqueness is true (Edit User passes false for unrelated edits so a
 * legacy duplicate never blocks fixing an address or phone number).
 * Returns { warnings } (name + contact matches) for the response.
 */
export const assertSellerIdentityAvailable = async (connection, {
  role,
  status = 'active',
  userId = null,
  firstName,
  middleName,
  lastName,
  contactNo,
  prcNo,
  tinNo,
  checkUniqueness = true,
}) => {
  if (!IN_HOUSE_SELLER_ROLES.includes(String(role || ''))) return { warnings: [] };
  if (!normalizeSellerIdentityNumber(prcNo)) {
    throw Object.assign(new Error('PRC No. is required for in-house sellers.'), { statusCode: 400, code: 'SELLER_PRC_REQUIRED' });
  }
  if (String(status || 'active') !== 'active' || !checkUniqueness) return { warnings: [] };

  const matches = await loadActiveSellerIdentityMatches(connection, { prcNumbers: [prcNo], tinNumbers: [tinNo], lock: true });
  const { errors } = findSellerIdentityConflicts({ prcNo, tinNo, excludeUserIds: [userId], matches });
  if (errors.length) throw conflictError(errors.join(' '), 'SELLER_IDENTITY_IN_USE');

  const warnings = await findSellerNameContactWarnings(connection, {
    firstName, middleName, lastName, contactNo, excludeUserIds: [userId],
  });
  return { warnings };
};
