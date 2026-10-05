import {
  CONFIGURABLE_SYSTEM_ROLES,
  DEPARTMENT_HEAD_ROLES,
  DEPARTMENT_STAFF_ROLES,
  PERMISSIONS,
  ROLE_PARENT,
  ROLE_DEFAULT_EDITABLE_ROLES,
  SYSTEM_ADMIN_MANAGEABLE_ROLES,
  getAuditorAllowedPermissions,
  getAuditorEnforcedPermissions,
} from './permissions.js';
import { RECOMMENDED_ROLE_PERMISSIONS } from './recommendedRolePermissions.js';

const allPermissionKeys = Object.freeze(Object.values(PERMISSIONS));
const allPermissionSet = new Set(allPermissionKeys);

const unique = (values = []) => [...new Set(values.filter(Boolean))];

const headRequired = Object.freeze([
  PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW,
  PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW,
  PERMISSIONS.WORKFLOW_DEPARTMENT_RETURN_FOR_CORRECTION,
  PERMISSIONS.WORKFLOW_DEPARTMENT_APPROVE_PROTECTED_CHANGE,
  PERMISSIONS.WORKFLOW_DEPARTMENT_CASE_RESPOND,
]);

const systemAdminRequired = Object.freeze([...allPermissionKeys]);

const auditorRequired = Object.freeze(getAuditorEnforcedPermissions());
const auditorCeiling = Object.freeze(getAuditorAllowedPermissions());

// System Admin is the day-to-day full administrator. The permission ceiling is
// intentionally the complete catalog; project scope determines which projects a
// System Admin can operate on. Super Admin controls each System Admin's project scope.
const systemAdminCeiling = [...allPermissionKeys];

const roleCeiling = (role) => {
  if (role === 'system_admin') return systemAdminCeiling;
  if (role === 'auditor') return auditorCeiling;
  if (DEPARTMENT_STAFF_ROLES.includes(role)) {
    return unique([...(RECOMMENDED_ROLE_PERMISSIONS[role] || []), PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW]);
  }
  if (DEPARTMENT_HEAD_ROLES.includes(role)) {
    const parent = ROLE_PARENT[role];
    return unique([
      ...(RECOMMENDED_ROLE_PERMISSIONS[parent] || []),
      ...(RECOMMENDED_ROLE_PERMISSIONS[role] || []),
      ...headRequired,
    ]);
  }
  return [];
};

const requiredForRole = (role) => {
  if (role === 'system_admin') return [...systemAdminRequired];
  if (role === 'auditor') return [...auditorRequired];
  if (DEPARTMENT_HEAD_ROLES.includes(role)) return [...headRequired];
  if (DEPARTMENT_STAFF_ROLES.includes(role)) return [PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW];
  return [];
};

export const getStaticRolePolicy = (role) => {
  const normalizedRole = String(role || '');
  const ceiling = unique(roleCeiling(normalizedRole)).filter((key) => allPermissionSet.has(key));
  const required = unique(requiredForRole(normalizedRole)).filter((key) => ceiling.includes(key));
  return {
    role: normalizedRole,
    parentRole: ROLE_PARENT[normalizedRole] || null,
    ceiling,
    required,
    fixed: normalizedRole === 'system_admin',
    defaultEditable: ROLE_DEFAULT_EDITABLE_ROLES.includes(normalizedRole),
    systemAdminManageable: SYSTEM_ADMIN_MANAGEABLE_ROLES.includes(normalizedRole),
  };
};

export const filterToRoleCeiling = (role, permissionKeys = []) => {
  const policy = getStaticRolePolicy(role);
  const ceiling = new Set(policy.ceiling);
  return unique(permissionKeys).filter((key) => ceiling.has(key));
};

export const assertPermissionKeysWithinRoleCeiling = (role, permissionKeys = []) => {
  if (!CONFIGURABLE_SYSTEM_ROLES.includes(String(role || ''))) {
    throw Object.assign(new Error('This role does not use configurable system permissions.'), { statusCode: 400, code: 'ROLE_NOT_CONFIGURABLE' });
  }
  const policy = getStaticRolePolicy(role);
  const ceiling = new Set(policy.ceiling);
  const invalid = unique(permissionKeys).filter((key) => !ceiling.has(key));
  if (invalid.length) {
    throw Object.assign(new Error(`One or more permissions are not allowed for this role: ${invalid.join(', ')}`), {
      statusCode: 400,
      code: 'ROLE_PERMISSION_CEILING',
      invalidPermissionKeys: invalid,
    });
  }
  return policy;
};

export const getRequiredPermissionsForRole = (role) => getStaticRolePolicy(role).required;
