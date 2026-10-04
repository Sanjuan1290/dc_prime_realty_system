import { ROLE_CODES } from '../config/permissions.js';

export const getAccountCodePrefix = ({ role }) => {
  const roleCode = ROLE_CODES[role] || String(role || 'USR').slice(0, 3).toUpperCase();
  return `${roleCode}-`;
};

export const formatUserIdForAccountCode = (userId) => {
  const numericId = Number(userId);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    throw new Error('A valid users table id is required to build an account code.');
  }
  return String(numericId).padStart(5, '0');
};

// Canonical visible account code = ROLECODE + users.id primary key.
// The surname is intentionally excluded because users.id is globally unique.
// person_key + role_sequence remain separate fields used only for historical
// identity/position tracking.
export const buildAccountCode = ({ role, userId, id }) =>
  `${getAccountCodePrefix({ role })}${formatUserIdForAccountCode(userId ?? id)}`;

export const getNextUserIdPreview = async (connection) => {
  // AUTO_INCREMENT is the best available preview of the next users.id. The final
  // account code is always rebuilt from insertId after INSERT, so concurrency can
  // never make the saved code disagree with the real primary key.
  try {
    const [rows] = await connection.query(`
      SELECT AUTO_INCREMENT AS next_id
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'users'
      LIMIT 1
    `);
    const nextId = Number(rows?.[0]?.next_id || 0);
    if (Number.isInteger(nextId) && nextId > 0) return nextId;
  } catch {
    // Fall through to a read-only estimate for environments where information_schema
    // does not expose AUTO_INCREMENT in the same way.
  }

  const [fallbackRows] = await connection.query(
    'SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM users'
  );
  const fallback = Number(fallbackRows?.[0]?.next_id || 1);
  return Number.isInteger(fallback) && fallback > 0 ? fallback : 1;
};

export const previewAccountCode = async (connection, { role }) => {
  const nextUserId = await getNextUserIdPreview(connection);
  return {
    accountCode: buildAccountCode({ role, userId: nextUserId }),
    userId: nextUserId,
  };
};
