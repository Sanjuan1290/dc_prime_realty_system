import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('Create System User loads the role policy into the permission grid (bug fix)', async () => {
  const modal = await read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
  assert.match(modal, /const rolePolicy = roleData\?\.policies\?\.\[form\.role\]/);
  assert.match(modal, /policy=\{rolePolicy\}/);
  assert.match(modal, /baseline=\{roleDefaults\}/);
  assert.match(modal, />Customize</);
});

test('Permission grid: partial state, counts, view-only select, search, filters, diff, tags', async () => {
  const matrix = await read('client/src/components/System/userComponents/PermissionMatrix.jsx');
  assert.match(matrix, /ref\.current\.indeterminate/);
  assert.match(matrix, /\$\{grantedInGroup\} of \$\{allowedKeys\.length\}/);
  assert.match(matrix, /optionalViewKeys/);
  assert.match(matrix, /Search permissions/);
  assert.match(matrix, /Changed from default/);
  assert.match(matrix, /Reset to \{baselineLabel\}/);
  assert.match(matrix, /Needs Head approval/);
  assert.match(matrix, /Sensitive/);
  assert.match(matrix, /cleanPermissionLabel/);
  assert.match(matrix, /Not available for this role/);
});

test('permission metadata classifies types and governed permissions', async () => {
  const meta = await read('client/src/utils/permissionMeta.js');
  assert.match(meta, /PERMISSIONS\.LOT_CANCELLATIONS_SETTLE/);
  assert.match(meta, /replace\(\/\\s\*\\\(Governed\\\)\\s\*\/g/);
  assert.match(meta, /marketing: \['Seller Groups'/);
});

test('Role & Access Control: single title, editing header, comparison, unsaved guard, sticky save', async () => {
  const roleAccess = await read('client/src/components/System/settingsComponents/RoleAccessControl.jsx');
  assert.doesNotMatch(roleAccess, /<h2 className="text-xl font-black text-slate-950">Role & Access Control<\/h2>/);
  assert.match(roleAccess, /Inherits everything from/);
  assert.match(roleAccess, /Compare Staff vs Head/);
  assert.match(roleAccess, /Discard and switch/);
  assert.match(roleAccess, /sticky bottom-0/);
});
