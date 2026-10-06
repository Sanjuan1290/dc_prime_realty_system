import { db } from '../db/connect.js';
import {
  CONFIGURABLE_SYSTEM_ROLES,
  PERMISSIONS,
  OWNER_ROLES,
  ROLE_DEFAULT_EDITABLE_ROLES,
  roleHasPermission,
} from '../config/permissions.js';
import {
  filterToRoleCeiling,
  getStaticRolePolicy,
} from '../config/rolePolicies.js';

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

const loadUserRole = async (connection, userId, { forUpdate = false } = {}) => {
  const id = Number(userId || 0);
  if (!id) return null;
  const [rows] = await connection.query(
    `SELECT id, role, status FROM users WHERE id = ? LIMIT 1${forUpdate ? ' FOR UPDATE' : ''}`,
    [id]
  );
  return rows[0] || null;
};

const getDirectRoleDefaultPermissionKeys = async (role, connection = db) => {
  const normalizedRole = String(role || '');
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(normalizedRole)) return [];
  const [rows] = await connection.query(
    `SELECT permission_key FROM role_permission_defaults WHERE role = ? AND allowed = 1 ORDER BY permission_key`,
    [normalizedRole]
  );
  return rows.map((row) => String(row.permission_key));
};

const getDirectUserPermissionKeys = async (userId, connection = db) => {
  const id = Number(userId || 0);
  if (!id) return [];
  const [rows] = await connection.query(
    `SELECT permission_key FROM user_permissions WHERE user_id = ? AND allowed = 1 ORDER BY permission_key`,
    [id]
  );
  return rows.map((row) => String(row.permission_key));
};

// Owner accounts (Super Admin, System Admin) always hold every permission.
// Every other role default and account holds exactly its saved rows: there is
// no runtime inheritance and nothing is force-added.
export const getRoleDefaultPermissionKeys = async (role, connection = db) => {
  const normalizedRole = String(role || '');
  if (OWNER_ROLES.includes(normalizedRole)) return Object.values(PERMISSIONS).sort();
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(normalizedRole)) return [];
  const direct = await getDirectRoleDefaultPermissionKeys(normalizedRole, connection);
  return filterToRoleCeiling(normalizedRole, direct).sort();
};

export const getUserPermissionKeys = async (userId, connection = db) => {
  const id = Number(userId || 0);
  if (!id) return [];
  const identity = await loadUserRole(connection, id);
  if (!identity || identity.status !== 'active') return [];
  if (OWNER_ROLES.includes(identity.role)) return Object.values(PERMISSIONS);
  const direct = await getDirectUserPermissionKeys(id, connection);
  return filterToRoleCeiling(identity.role, direct).sort();
};

export const replaceUserPermissions = async (connection, {
  userId,
  permissionKeys = [],
  changedByUserId = null,
}) => {
  const id = Number(userId || 0);
  if (!id) throw Object.assign(new Error('User id is required.'), { statusCode: 400 });

  const identity = await loadUserRole(connection, id, { forUpdate: true });
  if (!identity) throw Object.assign(new Error('User not found.'), { statusCode: 404 });
  if (OWNER_ROLES.includes(identity.role)) {
    // Owner accounts have full access; no per-account rows are kept.
    await connection.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
    return Object.values(PERMISSIONS);
  }
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(identity.role)) {
    throw Object.assign(new Error('This account does not use configurable system permissions.'), { statusCode: 400 });
  }
  const direct = filterToRoleCeiling(identity.role, validatePermissionKeys(permissionKeys));

  await connection.query('DELETE FROM user_permissions WHERE user_id = ?', [id]);
  if (direct.length) {
    const values = direct.map(() => '(?, ?, 1, ?)').join(', ');
    const params = direct.flatMap((key) => [id, key, changedByUserId || null]);
    await connection.query(
      `INSERT INTO user_permissions (user_id, permission_key, allowed, granted_by_user_id) VALUES ${values}`,
      params
    );
  }

  return getUserPermissionKeys(id, connection);
};

export const copyRoleDefaultsToUser = async (connection, { userId, role, changedByUserId = null }) => {
  const defaults = await getRoleDefaultPermissionKeys(role, connection);
  return replaceUserPermissions(connection, { userId, permissionKeys: defaults, changedByUserId });
};

export const replaceRoleDefaults = async (connection, { role, permissionKeys = [], changedByUserId = null }) => {
  const normalizedRole = String(role || '');
  if (!ROLE_DEFAULT_EDITABLE_ROLES.includes(normalizedRole)) {
    throw Object.assign(new Error('Super Admin and System Admin always have full access; their default cannot be edited.'), {
      statusCode: 400,
      code: 'ROLE_DEFAULT_LOCKED',
    });
  }

  const direct = filterToRoleCeiling(normalizedRole, validatePermissionKeys(permissionKeys));

  await connection.query('DELETE FROM role_permission_defaults WHERE role = ?', [normalizedRole]);
  if (direct.length) {
    const values = direct.map(() => '(?, ?, 1, ?)').join(', ');
    const params = direct.flatMap((key) => [normalizedRole, key, changedByUserId || null]);
    await connection.query(
      `INSERT INTO role_permission_defaults (role, permission_key, allowed, updated_by_user_id) VALUES ${values}`,
      params
    );
  }

  return getRoleDefaultPermissionKeys(normalizedRole, connection);
};

export const getAllRoleDefaults = async (connection = db) => {
  const entries = await Promise.all(
    CONFIGURABLE_SYSTEM_ROLES.map(async (role) => [role, await getRoleDefaultPermissionKeys(role, connection)])
  );
  return Object.fromEntries(entries);
};

export const getRolePolicyForAccessControl = async (role, connection = db) => {
  const staticPolicy = getStaticRolePolicy(role);
  const effectiveDefault = await getRoleDefaultPermissionKeys(role, connection);
  return {
    ...staticPolicy,
    inherited: [],
    required: [],
    effectiveDefault,
    optional: staticPolicy.fullAccess ? [] : [...staticPolicy.ceiling],
    restricted: [],
    forbidden: [],
  };
};

export const hydrateUserPermissions = async (user, connection = db) => {
  if (!user) return user;
  if (OWNER_ROLES.includes(String(user.role))) return { ...user, permissions: Object.values(PERMISSIONS) };
  return { ...user, permissions: await getUserPermissionKeys(user.id, connection) };
};
