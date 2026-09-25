import { db } from '../db/connect.js';
import { CONFIGURABLE_SYSTEM_ROLES, PERMISSIONS, roleHasPermission } from '../config/permissions.js';

const validPermissionKeys = new Set(Object.values(PERMISSIONS));

export const normalizePermissionKeys = (values = []) => [...new Set((Array.isArray(values) ? values : [])
  .map((value) => String(value || '').trim())
  .filter(Boolean))];

export const validatePermissionKeys = (values = []) => {
  const normalized = normalizePermissionKeys(values);
  const invalid = normalized.filter((value) => !validPermissionKeys.has(value));
  if (invalid.length) {
    throw Object.assign(new Error(`Unknown permission key${invalid.length === 1 ? '' : 's'}: ${invalid.join(', ')}`), {
      statusCode: 400,
      code: 'INVALID_PERMISSION_KEY',
      invalidPermissionKeys: invalid,
    });
  }
  return normalized;
};

export const hasPermission = (user, permission) => roleHasPermission(user, permission);

export const getUserPermissionKeys = async (userId, connection = db) => {
  const id = Number(userId || 0);
  if (!id) return [];
  const [rows] = await connection.query(
    `SELECT permission_key FROM user_permissions WHERE user_id = ? AND allowed = 1 ORDER BY permission_key`,
    [id]
  );
  return rows.map((row) => String(row.permission_key));
};

export const getRoleDefaultPermissionKeys = async (role, connection = db) => {
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(String(role || ''))) return [];
  const [rows] = await connection.query(
    `SELECT permission_key FROM role_permission_defaults WHERE role = ? AND allowed = 1 ORDER BY permission_key`,
    [role]
  );
  return rows.map((row) => String(row.permission_key));
};

export const replaceUserPermissions = async (connection, {
  userId,
  permissionKeys = [],
  changedByUserId = null,
}) => {
  const id = Number(userId || 0);
  if (!id) throw Object.assign(new Error('User id is required.'), { statusCode: 400 });
  const normalized = validatePermissionKeys(permissionKeys);
  await connection.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
  if (normalized.length) {
    const values = normalized.map(() => '(?, ?, 1, ?)').join(', ');
    const params = normalized.flatMap((key) => [id, key, changedByUserId || null]);
    await connection.query(
      `INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id) VALUES ${values}`,
      params
    );
  }
  return normalized;
};

export const copyRoleDefaultsToUser = async (connection, { userId, role, changedByUserId = null }) => {
  const defaults = await getRoleDefaultPermissionKeys(role, connection);
  return replaceUserPermissions(connection, { userId, permissionKeys: defaults, changedByUserId });
};

export const replaceRoleDefaults = async (connection, { role, permissionKeys = [], changedByUserId = null }) => {
  const normalizedRole = String(role || '');
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(normalizedRole)) {
    throw Object.assign(new Error('Only Admin, Marketing, Sales, Accounting, and Operations defaults are editable.'), { statusCode: 400 });
  }
  const normalized = validatePermissionKeys(permissionKeys);
  await connection.query('DELETE FROM role_permission_defaults WHERE role = ?', [normalizedRole]);
  if (normalized.length) {
    const values = normalized.map(() => '(?, ?, 1, ?)').join(', ');
    const params = normalized.flatMap((key) => [normalizedRole, key, changedByUserId || null]);
    await connection.query(
      `INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id) VALUES ${values}`,
      params
    );
  }
  return normalized;
};

export const getAllRoleDefaults = async (connection = db) => {
  const [rows] = await connection.query(
    `SELECT role, permission_key FROM role_permission_defaults WHERE allowed = 1 ORDER BY role, permission_key`
  );
  const defaults = Object.fromEntries(CONFIGURABLE_SYSTEM_ROLES.map((role) => [role, []]));
  for (const row of rows) if (defaults[row.role]) defaults[row.role].push(String(row.permission_key));
  return defaults;
};

export const hydrateUserPermissions = async (user, connection = db) => {
  if (!user) return user;
  if (String(user.role) === 'super_admin') return { ...user, permissions: Object.values(PERMISSIONS) };
  return { ...user, permissions: await getUserPermissionKeys(user.id, connection) };
};

