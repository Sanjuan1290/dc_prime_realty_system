import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('Create System User loads the role policy into the permission grid and summarizes cross-department access', async () => {
  const modal = await read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
  assert.match(modal, /const rolePolicy = roleData\?\.policies\?\.\[form\.role\]/);
  assert.match(modal, /policy=\{rolePolicy\}/);
  assert.match(modal, /baseline=\{roleDefaults\}/);
  assert.match(modal, />Customize</);
  assert.match(modal, /Additional \/ Cross-Department Permissions/);
  assert.match(modal, /outsideNormalPermissions/);
});

test('Permission grid keeps ordinary cross-department permissions selectable and warns instead of showing Not Allowed', async () => {
  const matrix = await read('client/src/components/System/userComponents/PermissionMatrix.jsx');
  assert.match(matrix, /ref\.current\.indeterminate/);
  assert.match(matrix, /\$\{grantedInGroup\} of \$\{assignableKeys\.length\}/);
  assert.match(matrix, /optionalViewKeys/);
  assert.match(matrix, /Search permissions/);
  assert.match(matrix, /Changed from default/);
  assert.match(matrix, /Reset to \{baselineLabel\}/);
  assert.match(matrix, /Needs Head approval/);
  assert.match(matrix, /Sensitive/);
  assert.match(matrix, /cleanPermissionLabel/);
  assert.match(matrix, /Outside normal role/);
  assert.match(matrix, /Usually System Admin only/);
  // 2026-10-06: one uniform grid; nothing is locked, restricted or hidden.
  assert.doesNotMatch(matrix, /Restricted governance/);
  assert.doesNotMatch(matrix, /Fixed by role/);
  assert.doesNotMatch(matrix, />Not Allowed</);
  assert.doesNotMatch(matrix, /Not available for this role/);
});

test('permission metadata classifies types and governed permissions', async () => {
  const meta = await read('client/src/utils/permissionMeta.js');
  assert.match(meta, /PERMISSIONS\.LOT_CANCELLATIONS_SETTLE/);
  assert.match(meta, /replace\(\/\\s\*\\\(Governed\\\)\\s\*\/g/);
  assert.match(meta, /marketing: \['Seller Groups'/);
});

test('Role & Access Control explains role defaults, cross-department grants, owner full access, and unsaved changes', async () => {
  const roleAccess = await read('client/src/components/System/settingsComponents/RoleAccessControl.jsx');
  assert.doesNotMatch(roleAccess, /<h2 className="text-xl font-black text-slate-950">Role & Access Control<\/h2>/);
  assert.match(roleAccess, /including permissions from other departments/);
  assert.match(roleAccess, /Outside normal role/);
  assert.match(roleAccess, /Super Admin and System Admin always have full access/);
  assert.match(roleAccess, /Compare Staff vs Head/);
  assert.match(roleAccess, /Discard and switch/);
  assert.match(roleAccess, /sticky bottom-0/);
});
