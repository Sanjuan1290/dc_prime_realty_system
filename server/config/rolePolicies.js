import {
  CONFIGURABLE_SYSTEM_ROLES,
  DEPARTMENT_HEAD_ROLES,
  DEPARTMENT_STAFF_ROLES,
  PERMISSIONS,
  OWNER_ROLES,
  ROLE_PARENT,
  ROLE_DEFAULT_EDITABLE_ROLES,
  SYSTEM_ADMIN_MANAGEABLE_ROLES,
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

// Permission model (2026-10-06):
// - Super Admin and System Admin are owner-level accounts with every permission.
// - Every other role (Auditor, Staff, Head) uses the same model: any permission
//   can be granted, the role default is only the pre-filled starting point, and
//   anything beyond the default is shown as a warning, never blocked.
// - Head defaults are their own full template (they start from the Staff
//   template); nothing is inherited or force-added at runtime.

// Starting-point templates. These fold in what used to be "Required" or
// "From Staff Role" so the defaults keep the same content.
const staffBaseline = [];

const recommendedForRole = (role) => {
  if (role === 'system_admin') return [...allPermissionKeys];
  if (role === 'auditor') return [...getAuditorEnforcedPermissions(), ...(RECOMMENDED_ROLE_PERMISSIONS.auditor || [])];
  if (DEPARTMENT_STAFF_ROLES.includes(role)) return [...staffBaseline, ...(RECOMMENDED_ROLE_PERMISSIONS[role] || [])];
  if (DEPARTMENT_HEAD_ROLES.includes(role)) {
    const staffRole = ROLE_PARENT[role];
    return [...recommendedForRole(staffRole), ...(RECOMMENDED_ROLE_PERMISSIONS[role] || []), ...headRequired];
  }
  return [];
};

// Owner-level permissions. Granting one of these to a non-owner role is allowed
// but carries an extra warning, because they are normally System Admin work.
const ownerLevelPermissions = new Set([
  PERMISSIONS.AUDIT_LOGS_ARCHIVE,
  PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE,
  PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
  PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY,
  PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE,
]);

export const getOwnerLevelPermissions = () => [...ownerLevelPermissions];

export const getStaticRolePolicy = (role) => {
  const normalizedRole = String(role || '');
  const known = CONFIGURABLE_SYSTEM_ROLES.includes(normalizedRole);
  const fullAccess = OWNER_ROLES.includes(normalizedRole);
  return {
    role: normalizedRole,
    parentRole: null,
    // Nothing is locked or restricted for any role any more.
    ceiling: known || fullAccess ? [...allPermissionKeys] : [],
    required: fullAccess ? [...allPermissionKeys] : [],
    recommended: unique(recommendedForRole(normalizedRole)).filter((key) => allPermissionSet.has(key)),
    ownerLevel: fullAccess ? [] : [...ownerLevelPermissions],
    fullAccess,
    fixed: fullAccess,
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
    throw Object.assign(new Error(`One or more permissions are restricted governance permissions for this role: ${invalid.join(', ')}`), {
      statusCode: 400,
      code: 'ROLE_PERMISSION_GOVERNANCE_RESTRICTION',
      invalidPermissionKeys: invalid,
    });
  }
  return policy;
};

export const getRequiredPermissionsForRole = (role) => getStaticRolePolicy(role).required;


