import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readClient = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');
const readServer = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('user final double-check no longer depends on removed admin role name', () => {
  const source = readClient('components/Shared/DoubleCheckComponents/UserDoubleCheck.jsx');
  assert.doesNotMatch(source, /String\(role\)\s*===\s*['\"]admin['\"]/);
  assert.match(source, /all_projects_access/);
  assert.match(source, /projectNames/);
});

test('current role catalogs expose Staff Head Auditor and System Admin roles through the shared policy model', () => {
  const permissions = readServer('config/permissions.js');
  const defaults = readServer('config/recommendedRolePermissions.js');
  const policies = readServer('config/rolePolicies.js');
  for (const role of ['system_admin', 'auditor', 'accounting_staff', 'accounting_head', 'sales_staff', 'sales_head', 'operations_staff', 'operations_head']) {
    assert.match(permissions, new RegExp(role));
    assert.match(defaults, new RegExp(role));
  }
  assert.match(policies, /DEPARTMENT_STAFF_ROLES/);
  assert.match(policies, /DEPARTMENT_HEAD_ROLES/);
  assert.match(policies, /ROLE_PARENT/);
  assert.match(policies, /system_admin/);
  assert.match(policies, /auditor/);
});

test('Batch 4 protected modules are assigned to their intended departments', () => {
  const reservation = readServer('controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js');
  const listingProfile = readServer('controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  const payments = readServer('controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
  const settings = readServer('controllers/Lot_Projects/Settings/Settings.controller.js');
  assert.match(reservation, /department:\s*['\"]sales['\"]/);
  assert.match(listingProfile, /department:\s*['\"]accounting['\"]/);
  assert.match(payments, /department:\s*['\"]accounting['\"]/);
  assert.match(settings, /PROJECT_SETTINGS_DEPARTMENT\s*=\s*['\"]operations['\"]/);
});
