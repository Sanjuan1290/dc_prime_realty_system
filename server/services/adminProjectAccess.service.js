// Backward-compatible import surface for older controllers/tests.
// The authoritative implementation lives in projectAccess.service.js.
// Do not duplicate scope logic here: persisted-role checks and forced global
// scope for Super Admin / Auditor and project-scoped System Admin behavior must remain centralized.
import {
  isSuperAdmin,
  hasForcedAllProjectsAccess,
  isProjectScopedSystemUser,
  getUserProjectAccess,
  canAccessProject,
  getAccessibleProjectIds,
  replaceUserProjectAccess,
  hydrateUserProjectAccess,
  describeUserProjectAccess,
  grantProjectAccessToUser,
  grantAdminProjectAccess,
} from './projectAccess.service.js';

export {
  isSuperAdmin,
  hasForcedAllProjectsAccess,
  isProjectScopedSystemUser,
  getUserProjectAccess,
  canAccessProject,
  getAccessibleProjectIds,
  replaceUserProjectAccess,
  hydrateUserProjectAccess,
  describeUserProjectAccess,
  grantAdminProjectAccess,
};

// Legacy symbol aliases retained while old call-sites are migrated.
export const isOperationalAdmin = isProjectScopedSystemUser;
export const getAdminProjectAccess = getUserProjectAccess;
export const replaceAdminProjectAccess = replaceUserProjectAccess;
export const hydrateAdminProjectAccess = hydrateUserProjectAccess;
export const describeAdminProjectAccess = describeUserProjectAccess;
export const grantProjectAccessToAdmin = grantProjectAccessToUser;

