import { ROLE_CODES } from '../config/permissions.js';

export const sanitizeAccountSurname = (value = '') => {
  const clean = String(value || '')
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  return clean || 'USER';
};

export const getAccountCodePrefix = ({ lastName, role }) => {
  const roleCode = ROLE_CODES[role] || String(role || 'USR').slice(0, 3).toUpperCase();
  return `${sanitizeAccountSurname(lastName)}-${roleCode}-`;
};

export const buildAccountCode = ({ lastName, role, sequence }) =>
  `${getAccountCodePrefix({ lastName, role })}${String(Math.max(1, Number(sequence || 1))).padStart(3, '0')}`;

const canonicalSequenceFromCode = (accountCode, prefix) => {
  const code = String(accountCode || '').toUpperCase();
  if (!code.startsWith(prefix)) return null;
  const numericPart = code.slice(prefix.length);
  if (!/^\d+$/.test(numericPart)) return null;
  const value = Number(numericPart);
  return Number.isInteger(value) && value > 0 ? value : null;
};

export const chooseNextAccountCodeSequence = ({
  existingAccountCodes = [],
  lastName,
  role,
  minimumSequence = 1,
}) => {
  const prefix = getAccountCodePrefix({ lastName, role });
  const codes = existingAccountCodes
    .map((value) => String(value || '').toUpperCase())
    .filter((value) => value.startsWith(prefix));

  const canonicalSequences = codes
    .map((code) => canonicalSequenceFromCode(code, prefix))
    .filter((value) => Number.isInteger(value));

  const highestCanonical = canonicalSequences.length ? Math.max(...canonicalSequences) : 0;
  // Count every historical matching account, including legacy collision codes such as
  // CORTEZ-ADM-001-2, so a new canonical code never reuses that account's logical slot.
  let nextSequence = Math.max(
    1,
    Number(minimumSequence || 1),
    highestCanonical + 1,
    codes.length + 1,
  );

  const occupied = new Set(codes);
  while (occupied.has(buildAccountCode({ lastName, role, sequence: nextSequence }))) {
    nextSequence += 1;
  }
  return nextSequence;
};

export const generateUniqueAccountCode = async (
  connection,
  { lastName, role, sequence = 1, lock = false },
) => {
  const prefix = getAccountCodePrefix({ lastName, role });
  const [rows] = await connection.query(
    `SELECT account_code FROM users WHERE account_code LIKE ?${lock ? ' FOR UPDATE' : ''}`,
    [`${prefix}%`],
  );

  const nextSequence = chooseNextAccountCodeSequence({
    existingAccountCodes: rows.map((row) => row.account_code),
    lastName,
    role,
    minimumSequence: sequence,
  });

  return buildAccountCode({ lastName, role, sequence: nextSequence });
};
