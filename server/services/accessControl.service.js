import { db } from '../db/connect.js';
import {
  CONFIGURABLE_SYSTEM_ROLES,
  PERMISSIONS,
  ROLE_PARENT,
  ROLE_DEFAULT_EDITABLE_ROLES,
  getAuditorEnforcedPermissions,
  roleHasPermission,
} from '../config/permissions.js';
import {
  assertPermissionKeysWithinRoleCeiling,
  filterToRoleCeiling,
  getRequiredPermissionsForRole,
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

export const getRoleDefaultPermissionKeys = async (role, connection = db, seen = new Set()) => {
  const normalizedRole = String(role || '');
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(normalizedRole)) return [];
  if (seen.has(normalizedRole)) {
    throw Object.assign(new Error('Role inheritance loop detected.'), { statusCode: 500, code: 'ROLE_INHERITANCE_LOOP' });
  }
  seen.add(normalizedRole);

  const direct = await getDirectRoleDefaultPermissionKeys(normalizedRole, connection);
  const parentRole = ROLE_PARENT[normalizedRole] || null;
  const inherited = parentRole
    ? await getRoleDefaultPermissionKeys(parentRole, connection, seen)
    : [];
  const required = getRequiredPermissionsForRole(normalizedRole);
  return filterToRoleCeiling(normalizedRole, [...inherited, ...direct, ...required]).sort();
};

export const getUserPermissionKeys = async (userId, connection = db) => {
  const id = Number(userId || 0);
  if (!id) return [];
  const identity = await loadUserRole(connection, id);
  if (!identity || identity.status !== 'active') return [];
  if (identity.role === 'super_admin') return Object.values(PERMISSIONS);
  const direct = await getDirectUserPermissionKeys(id, connection);
  const parentRole = ROLE_PARENT[identity.role] || null;
  const inherited = parentRole
    ? await getRoleDefaultPermissionKeys(parentRole, connection)
    : [];
  const required = getRequiredPermissionsForRole(identity.role);
  return filterToRoleCeiling(identity.role, [...inherited, ...direct, ...required]).sort();
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
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(identity.role)) {
    throw Object.assign(new Error('This account does not use configurable system permissions.'), { statusCode: 400 });
  }
  const normalized = validatePermissionKeys(permissionKeys);
  assertPermissionKeysWithinRoleCeiling(identity.role, normalized);

  const parentRole = ROLE_PARENT[identity.role] || null;
  const inherited = new Set(parentRole ? await getRoleDefaultPermissionKeys(parentRole, connection) : []);
  const required = new Set(getRequiredPermissionsForRole(identity.role));
  const direct = filterToRoleCeiling(
    identity.role,
    normalized.filter((key) => !inherited.has(key) && !required.has(key))
  );

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
  if (![...ROLE_DEFAULT_EDITABLE_ROLES, 'system_admin', 'auditor'].includes(normalizedRole)) {
    throw Object.assign(new Error('This role default template is governed and cannot be edited here.'), {
      statusCode: 400,
      code: 'ROLE_DEFAULT_LOCKED',
    });
  }

  const normalized = validatePermissionKeys(permissionKeys);
  assertPermissionKeysWithinRoleCeiling(normalizedRole, normalized);

  const parentRole = ROLE_PARENT[normalizedRole] || null;
  const inherited = new Set(parentRole ? await getRoleDefaultPermissionKeys(parentRole, connection) : []);
  const required = new Set(getRequiredPermissionsForRole(normalizedRole));
  const direct = filterToRoleCeiling(
    normalizedRole,
    normalized.filter((key) => !inherited.has(key) && !required.has(key))
  );

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
  const inherited = staticPolicy.parentRole
    ? await getRoleDefaultPermissionKeys(staticPolicy.parentRole, connection)
    : [];
  const effectiveDefault = await getRoleDefaultPermissionKeys(role, connection);
  const inheritedSet = new Set(inherited);
  const requiredSet = new Set(staticPolicy.required);
  const ceilingSet = new Set(staticPolicy.ceiling);
  return {
    ...staticPolicy,
    inherited,
    effectiveDefault,
    optional: staticPolicy.ceiling.filter((key) => !inheritedSet.has(key) && !requiredSet.has(key)),
    forbidden: Object.values(PERMISSIONS).filter((key) => !ceilingSet.has(key)),
  };
};

export const hydrateUserPermissions = async (user, connection = db) => {
  if (!user) return user;
  if (String(user.role) === 'super_admin') return { ...user, permissions: Object.values(PERMISSIONS) };
  return { ...user, permissions: await getUserPermissionKeys(user.id, connection) };
};
