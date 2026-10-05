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

const systemAdminRequired = Object.freeze([
  PERMISSIONS.SYSTEM_DASHBOARD_VIEW,
  PERMISSIONS.SYSTEM_USERS_VIEW,
  PERMISSIONS.SYSTEM_USERS_CREATE,
  PERMISSIONS.SYSTEM_USERS_EDIT,
  PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD,
  PERMISSIONS.SYSTEM_USERS_DEACTIVATE,
  PERMISSIONS.SYSTEM_SETTINGS_VIEW,
  PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW,
  PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE,
  PERMISSIONS.SYSTEM_ACCESS_CONTROL_VIEW,
  PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE,
  PERMISSIONS.AUDIT_LOGS_VIEW,
  PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW,
  PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY,
  PERMISSIONS.LOT_LISTINGS_EDIT,
  PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE,
  PERMISSIONS.LOT_PAYMENTS_EDIT,
  PERMISSIONS.LOT_PAYMENT_DELETE,
  PERMISSIONS.LOT_RESERVATION_CORRECT,
  PERMISSIONS.LOT_BUYER_PROFILE_EDIT,
  PERMISSIONS.LOT_PRINTOUTS_USE,
  PERMISSIONS.LOT_COMMISSIONS_ADJUST,
  PERMISSIONS.LOT_PENALTY_CORRECT,
  PERMISSIONS.LOT_SETTINGS_MANAGE,
]);

const auditorRequired = Object.freeze(getAuditorEnforcedPermissions());
const auditorCeiling = Object.freeze(getAuditorAllowedPermissions());

// Department roles use their role template as a recommended starting point, not
// as a hard business-permission ceiling. This makes deliberate cross-department
// assignments possible (for example, Marketing Staff who also helps Sales).
//
// Governance/security authority remains role-bound. Those keys define who may
// approve, audit, change access-control policy, use owner emergency authority,
// or change protected system settings; they are not ordinary cross-department
// operational permissions.
const departmentRestrictedGovernancePermissions = new Set([
  PERMISSIONS.AUDIT_LOGS_ARCHIVE,
  PERMISSIONS.SYSTEM_ACCESS_CONTROL_VIEW,
  PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE,
  PERMISSIONS.SYSTEM_SETTINGS_MANAGE,
  PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW,
  PERMISSIONS.WORKFLOW_DEPARTMENT_RETURN_FOR_CORRECTION,
  PERMISSIONS.WORKFLOW_DEPARTMENT_APPROVE_PROTECTED_CHANGE,
  PERMISSIONS.WORKFLOW_DEPARTMENT_CASE_RESPOND,
  PERMISSIONS.WORKFLOW_AUDIT_REVIEW,
  PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE,
  PERMISSIONS.WORKFLOW_AUDIT_CASE_RESOLVE,
  PERMISSIONS.WORKFLOW_AUDIT_CORRECTION_VERIFY,
  PERMISSIONS.WORKFLOW_SYSTEM_CORRECTION_APPLY,
  PERMISSIONS.WORKFLOW_EMERGENCY_OVERRIDE,
]);

const departmentBusinessCeiling = Object.freeze(
  allPermissionKeys.filter((key) => !departmentRestrictedGovernancePermissions.has(key))
);

// System Admin remains a governance/case-correction role rather than a second
// Super Admin. This policy is intentionally separate from the flexible
// department-role business-permission model above.
const systemAdminCeiling = unique([
  ...(RECOMMENDED_ROLE_PERMISSIONS.system_admin || []),
  ...systemAdminRequired,
]);

const roleCeiling = (role) => {
  if (role === 'system_admin') return systemAdminCeiling;
  if (role === 'auditor') return auditorCeiling;
  if (DEPARTMENT_STAFF_ROLES.includes(role)) {
    return unique([...departmentBusinessCeiling, PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW]);
  }
  if (DEPARTMENT_HEAD_ROLES.includes(role)) {
    return unique([...departmentBusinessCeiling, ...headRequired]);
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
  const recommended = unique(RECOMMENDED_ROLE_PERMISSIONS[normalizedRole] || []).filter((key) => ceiling.includes(key));
  return {
    role: normalizedRole,
    parentRole: ROLE_PARENT[normalizedRole] || null,
    ceiling,
    required,
    recommended,
    fixed: false,
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
