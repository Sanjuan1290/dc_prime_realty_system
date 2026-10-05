import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  PERMISSIONS,
  SYSTEM_ADMIN_MANAGEABLE_ROLES,
  isFullAccessAdministrator,
  roleHasPermission,
} from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';
import { authorizeGovernedAction } from '../services/governedAction.service.js';

const read = (relative) => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const readClient = (relative) => readFileSync(new URL(`../../client/src/${relative}`, import.meta.url), 'utf8');

test('System Admin has the full permission catalog while Super Admin identity remains protected', () => {
  const systemAdmin = { id: 22, role: 'system_admin', permissions: [] };
  assert.equal(isFullAccessAdministrator(systemAdmin), true);
  for (const permission of Object.values(PERMISSIONS)) {
    assert.equal(roleHasPermission(systemAdmin, permission), true, permission);
  }
  const policy = getStaticRolePolicy('system_admin');
  assert.deepEqual(new Set(policy.ceiling), new Set(Object.values(PERMISSIONS)));
  assert.deepEqual(new Set(policy.required), new Set(Object.values(PERMISSIONS)));
  assert.equal(policy.fixed, true);
  assert.ok(SYSTEM_ADMIN_MANAGEABLE_ROLES.includes('auditor'));
  assert.ok(!SYSTEM_ADMIN_MANAGEABLE_ROLES.includes('system_admin'));
  assert.ok(!SYSTEM_ADMIN_MANAGEABLE_ROLES.includes('super_admin'));
});

test('System Admin is project-scoped while Super Admin and Auditor remain global', () => {
  const projectAccess = read('services/projectAccess.service.js');
  const auth = read('middleware/auth.middleware.js');
  assert.match(projectAccess, /hasForcedAllProjectsAccess[\s\S]*\['super_admin', 'auditor'\]/);
  assert.doesNotMatch(projectAccess, /hasForcedAllProjectsAccess[\s\S]*\['super_admin', 'system_admin', 'auditor'\]/);
  assert.match(auth, /\['super_admin','auditor'\]\.includes\(req\.authUser\?\.role\)/);
});

test('Super Admin can assign System Admin project scope in account access UI', () => {
  const create = readClient('components/System/userComponents/CreateSystemUserModal.jsx');
  const access = readClient('components/System/userComponents/UserAccessModal.jsx');
  const changePosition = readClient('components/System/userComponents/ChangePositionModal.jsx');
  const users = readClient('pages/System/Users.jsx');
  assert.match(create, /enabled: canCreateSystemUsers && !\['super_admin','auditor'\]\.includes\(form\.role\)/);
  assert.match(create, /all_projects_access: \['super_admin','auditor'\]\.includes\(form\.role\) \? true : allProjects/);
  assert.match(access, /const forcedAllProjects = \['super_admin', 'auditor'\]\.includes\(user\.role\)/);
  assert.match(access, /System Admin has every system permission\. Super Admin controls which projects this account can operate on\./);
  assert.match(changePosition, /const forcedAll = role === 'auditor'/);
  assert.match(users, /\['super_admin','auditor'\]\.includes\(user\.role\) \|\| user\.all_projects_access/);
});

test('Role & Access uses From Staff Role instead of Inherited wording', () => {
  const matrix = readClient('components/System/userComponents/PermissionMatrix.jsx');
  const roleAccess = readClient('components/System/settingsComponents/RoleAccessControl.jsx');
  assert.match(matrix, /From Staff Role/);
  assert.doesNotMatch(matrix, />Inherited<\/span>/);
  assert.match(roleAccess, /includes all access from/);
});

test('System Admin can perform protected governed actions directly and still goes to audit', async () => {
  const result = await authorizeGovernedAction({}, {
    actor: { id: 22, role: 'system_admin' },
    actionKey: 'payment.edit',
    projectId: 7,
    entityId: 99,
    payload: { amount: 1000 },
  });
  assert.equal(result.authorized, true);
  assert.equal(result.authorizationType, 'system_admin_direct');
  const reviewService = read('services/operationalReview.service.js');
  assert.match(reviewService, /SYSTEM_ADMIN_DIRECT: 'system_admin_direct'/);
  assert.match(reviewService, /was entered by System Admin and needs independent audit/);
});

test('formerly owner-only operational tools accept System Admin authority', () => {
  for (const file of ['routers/System/systemSettings.routers.js','routers/System/auditLogs.router.js','routers/System/projects.routers.js']) {
    const source = read(file);
    assert.match(source, /requireExactRole\('super_admin','system_admin'\)/, file);
  }
  const settingsPage = readClient('pages/System/Settings.jsx');
  const auditPage = readClient('pages/System/AuditLogs.jsx');
  assert.match(settingsPage, /\['super_admin','system_admin'\]\.includes\(actor\.role\)/);
  assert.match(auditPage, /\['super_admin','system_admin'\]\.includes\(currentUserData\?\.user\?\.role\)/);
});
