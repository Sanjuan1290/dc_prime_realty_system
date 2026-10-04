import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  analyzeNetworkMemberImport,
  sortNetworkMemberImportRows,
} from '../controllers/System/networkMemberImport.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..', '..');

const group = {
  seller_group_id: 10,
  seller_group_name: 'NA Realty Network',
  seller_group_type: 'in_house',
  seller_group_status: 'active',
  seller_group_head_user_id: 1,
};

const head = {
  accredited_seller_id: 101,
  user_id: 1,
  seller_group_id: 10,
  accredited_seller_status: 'active',
  is_system_dummy: 0,
  first_name: 'Rowena',
  last_name: 'Cortez',
  full_name: 'Rowena Cortez',
  email: 'rowena@example.com',
  role: 'division_manager',
  user_status: 'active',
};

const row = (overrides = {}) => ({
  first_name: 'Pedro',
  last_name: 'Reyes',
  email: 'pedro@example.com',
  role: 'Sales Agent',
  reports_under_email: 'maria@example.com',
  ...overrides,
});

const analyze = (rows, options = {}) => analyzeNetworkMemberImport({
  rows,
  group: options.group || group,
  currentMembers: options.currentMembers || [head],
  existingAccounts: options.existingAccounts || [],
});

test('out-of-order Excel rows resolve hierarchy from DM to SD to UM to SA without requiring spreadsheet sorting', () => {
  const result = analyze([
    row({ source_row: 2 }),
    row({ source_row: 3, first_name: 'Maria', last_name: 'Santos', email: 'maria@example.com', role: 'Unit Manager', reports_under_email: 'john@example.com' }),
    row({ source_row: 4, first_name: 'John', last_name: 'Cruz', email: 'john@example.com', role: 'Sales Director', reports_under_email: 'rowena@example.com' }),
  ]);
  assert.equal(result.canCommit, true);
  assert.deepEqual(result.summary, { total: 3, ready: 3, warnings: 0, errors: 0, create: 3, update: 0, transfer: 0 });
  assert.deepEqual(sortNetworkMemberImportRows(result.rows).map((item) => item.role), [
    'sales_director', 'unit_manager', 'sales_agent',
  ]);
});

test('missing Reports Under parent is blocked during Preview', () => {
  const result = analyze([row({ reports_under_email: 'missing@example.com' })]);
  assert.equal(result.canCommit, false);
  assert.match(result.rows[0].errors.join(' '), /not found as an existing member of this Network or in this Excel file/i);
});

test('active seller in another Network cannot be transferred through Excel', () => {
  const existing = {
    user_id: 22, accredited_seller_id: 222, seller_group_id: 99,
    accredited_seller_status: 'active', user_status: 'active', role: 'sales_agent',
    email: 'pedro@example.com', seller_group_name: 'Other Network', direct_report_count: 0,
  };
  const result = analyze([row()], { existingAccounts: [existing] });
  assert.equal(result.canCommit, false);
  assert.match(result.rows[0].errors.join(' '), /Active in Other Network/i);
});

test('inactive seller can transfer when role is unchanged and no dependencies remain', () => {
  const existing = {
    user_id: 22, accredited_seller_id: 222, seller_group_id: 99,
    accredited_seller_status: 'inactive', user_status: 'inactive', role: 'sales_agent',
    email: 'pedro@example.com', seller_group_name: 'Other Network', direct_report_count: 0,
  };
  const result = analyze([
    row(),
    row({ first_name: 'Maria', last_name: 'Santos', email: 'maria@example.com', role: 'Unit Manager', reports_under_email: 'john@example.com' }),
    row({ first_name: 'John', last_name: 'Cruz', email: 'john@example.com', role: 'Sales Director', reports_under_email: 'rowena@example.com' }),
  ], { existingAccounts: [existing] });
  assert.equal(result.canCommit, true);
  assert.equal(result.rows.find((item) => item.email === 'pedro@example.com').action, 'TRANSFER');
  assert.equal(result.summary.transfer, 1);
});

test('inactive seller transfer is blocked while seller still has direct reports', () => {
  const existing = {
    user_id: 22, accredited_seller_id: 222, seller_group_id: 99,
    accredited_seller_status: 'inactive', user_status: 'inactive', role: 'sales_agent',
    email: 'pedro@example.com', seller_group_name: 'Other Network', direct_report_count: 1,
  };
  const result = analyze([row()], { existingAccounts: [existing] });
  assert.equal(result.canCommit, false);
  assert.match(result.rows[0].errors.join(' '), /still has members reporting under them/i);
});

test('bulk import refuses to change an existing seller role', () => {
  const existing = {
    user_id: 22, accredited_seller_id: 222, seller_group_id: 10,
    accredited_seller_status: 'active', user_status: 'active', role: 'unit_manager',
    email: 'pedro@example.com', seller_group_name: 'NA Realty Network', direct_report_count: 0,
  };
  const result = analyze([row()], { existingAccounts: [existing] });
  assert.equal(result.canCommit, false);
  assert.match(result.rows[0].errors.join(' '), /Bulk import cannot change seller roles/i);
});

test('Excel import cannot add or replace the Division Manager hierarchy head', () => {
  const result = analyze([row({ role: 'Division Manager', reports_under_email: '', email: 'newdm@example.com' })]);
  assert.equal(result.canCommit, false);
  assert.match(result.rows[0].errors.join(' '), /already has Rowena Cortez as its hierarchy head/i);
});

test('existing hierarchy head can appear in the file only as the same top-level role', () => {
  const existingHead = {
    ...head,
    email: 'rowena@example.com',
    seller_group_name: 'NA Realty Network',
    direct_report_count: 1,
  };
  const result = analyze([row({
    first_name: 'Rowena', last_name: 'Cortez', email: 'rowena@example.com',
    role: 'Division Manager', reports_under_email: '',
  })], { existingAccounts: [existingHead] });
  assert.equal(result.canCommit, true);
  assert.equal(result.rows[0].action, 'UPDATE');
});

test('duplicate email rows are rejected', () => {
  const result = analyze([
    row(),
    row({ first_name: 'Pedro 2' }),
  ]);
  assert.equal(result.canCommit, false);
  assert.equal(result.summary.errors, 2);
  assert.match(result.rows[0].errors.join(' '), /appears more than once/i);
});

test('External or inactive Network cannot accept member import', () => {
  const external = analyze([row()], { group: { ...group, seller_group_type: 'external' } });
  assert.equal(external.canCommit, false);
  assert.match(external.rows[0].errors.join(' '), /only for In-House Networks/i);

  const inactive = analyze([row()], { group: { ...group, seller_group_status: 'inactive' } });
  assert.equal(inactive.canCommit, false);
  assert.match(inactive.rows[0].errors.join(' '), /Activate this Network/i);
});

test('Network details UI exposes Import Members and the template contains a safe sample row plus the full DM to SA example chain', async () => {
  const details = await fs.readFile(path.join(root, 'client/src/pages/System/SellerGroupDetails.jsx'), 'utf8');
  const modal = await fs.readFile(path.join(root, 'client/src/components/System/sellerGroupComponents/NetworkMemberImportModal.jsx'), 'utf8');
  assert.match(details, /Add Member[\s\S]*Import Members/);
  assert.match(modal, /const HEADERS = \[[\s\S]*'Reports Under Email'[\s\S]*'PRC Number'/);
  const headersBlock = modal.match(/const HEADERS = \[([\s\S]*?)\]\n/)?.[1] || '';
  assert.doesNotMatch(headersBlock, /Network Name|Status/);
  assert.match(modal, /SAMPLE - DELETE THIS ROW/);
  assert.match(modal, /aoa_to_sheet\(\[HEADERS, sampleMemberRow\]\)/);
  assert.match(modal, /String\(row\['First Name'\][\s\S]*SAMPLE_ROW_MARKER/);
  assert.match(modal, /'Division Manager'[\s\S]*exampleHeadEmail[\s\S]*'Division Manager'[\s\S]*'Sales Director'[\s\S]*'Unit Manager'[\s\S]*'Sales Agent'/);
  assert.doesNotMatch(modal, /Columns intentionally exclude Network Name and Status/);
  assert.doesNotMatch(modal, /Instructions and Examples for SD → UM → SA reporting/);
  assert.match(modal, /Download Template \(\.xlsx\)/);
  assert.match(modal, /All successful rows become Active/);
});

test('server routes provide preview and transactional commit endpoints with seller/group permissions', async () => {
  const router = await fs.readFile(path.join(root, 'server/routers/System/sellerGroup.routers.js'), 'utf8');
  assert.match(router, /\/:groupId\/members\/import\/preview/);
  assert.match(router, /\/:groupId\/members\/import\/commit/);
  assert.match(router, /SYSTEM_SELLER_GROUPS_MANAGE/);
  assert.match(router, /SYSTEM_USERS_CREATE/);
  assert.match(router, /SYSTEM_USERS_EDIT/);
});

test('Accredited Sellers includes Export Excel endpoint and UI action', async () => {
  const router = await fs.readFile(path.join(root, 'server/routers/System/accredited.routers.js'), 'utf8');
  const page = await fs.readFile(path.join(root, 'client/src/pages/System/Accredited.jsx'), 'utf8');
  assert.match(router, /router\.get\('\/export'/);
  assert.match(page, /Export Excel/);
  assert.match(page, /\/accredited\/export/);
});
