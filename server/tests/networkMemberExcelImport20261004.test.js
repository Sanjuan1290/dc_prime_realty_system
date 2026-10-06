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

// PRC No. became required for in-house sellers on 2026-10-05; each fixture row
// gets a unique PRC derived from its email unless a test sets one explicitly.
const row = (overrides = {}) => ({
  first_name: 'Pedro',
  last_name: 'Reyes',
  email: 'pedro@example.com',
  role: 'SA',
  reports_under_email: 'maria@example.com',
  prc_number: `PRC-${String(overrides.email || 'pedro@example.com').split('@')[0]}`,
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
    row({ source_row: 3, first_name: 'Maria', last_name: 'Santos', email: 'maria@example.com', role: 'UM', reports_under_email: 'john@example.com' }),
    row({ source_row: 4, first_name: 'John', last_name: 'Cruz', email: 'john@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
  ]);
  assert.equal(result.canCommit, true);
  assert.deepEqual(result.summary, { total: 3, ready: 3, warnings: 0, errors: 0, existingUpdates: 0, create: 3, update: 0, transfer: 0 });
  assert.deepEqual(sortNetworkMemberImportRows(result.rows).map((item) => item.role), [
    'sales_director', 'unit_manager', 'sales_agent',
  ]);
});

test('Role column accepts DM, SD, UM, SA without case or spacing sensitivity and keeps full names backward compatible', () => {
  const result = analyze([
    row({ email: 'dm@example.com', role: ' dm ', reports_under_email: '' }),
    row({ email: 'sd@example.com', role: 'sd', reports_under_email: 'rowena@example.com' }),
    row({ email: 'um@example.com', role: ' Um ', reports_under_email: 'sd@example.com' }),
    row({ email: 'sa@example.com', role: 'SA', reports_under_email: 'um@example.com' }),
    row({ email: 'legacy@example.com', role: 'Sales Agent', reports_under_email: 'um@example.com' }),
  ]);
  assert.equal(result.rows[0].role, 'division_manager');
  assert.equal(result.rows[1].role, 'sales_director');
  assert.equal(result.rows[2].role, 'unit_manager');
  assert.equal(result.rows[3].role, 'sales_agent');
  assert.equal(result.rows[4].role, 'sales_agent');
});

test('missing Reports Under parent is blocked during Preview', () => {
  const result = analyze([row({ reports_under_email: 'missing@example.com' })]);
  assert.equal(result.canCommit, false);
  assert.match(result.rows[0].errors.join(' '), /not found as an existing member of this Network or in this Excel file/i);
});


test('existing employee/system account can also become an accredited seller without replacing the system account', () => {
  const systemAccount = {
    user_id: 700,
    accredited_seller_id: null,
    seller_group_id: null,
    accredited_seller_status: null,
    user_status: 'active',
    role: 'system_admin',
    account_category: 'system',
    person_key: 'person-employee-1',
    is_system_account: 0,
    email: 'employee@example.com',
  };
  const result = analyze([
    row({
      first_name: 'Employee', last_name: 'Seller', email: 'employee@example.com',
      role: 'SD', reports_under_email: 'rowena@example.com',
    }),
  ], { existingAccounts: [systemAccount] });
  assert.equal(result.canCommit, true);
  assert.equal(result.rows[0].action, 'CREATE');
  assert.equal(result.rows[0].existingUserId, null);
  assert.equal(result.rows[0].sourcePersonUserId, 700);
  assert.equal(result.rows[0].sourcePersonKey, 'person-employee-1');
  assert.match(result.rows[0].warnings.join(' '), /employee\/system account will be preserved/i);
});

test('existing seller-role user without accreditation is accredited instead of rejected as a non-seller account', () => {
  const sellerUser = {
    user_id: 701,
    accredited_seller_id: null,
    seller_group_id: null,
    accredited_seller_status: null,
    user_status: 'active',
    role: 'sales_director',
    account_category: 'seller',
    person_key: 'person-seller-1',
    is_system_account: 0,
    email: 'selleruser@example.com',
  };
  const result = analyze([
    row({
      first_name: 'Existing', last_name: 'Seller', email: 'selleruser@example.com',
      role: 'SD', reports_under_email: 'rowena@example.com',
    }),
  ], { existingAccounts: [sellerUser] });
  assert.equal(result.canCommit, true);
  assert.equal(result.rows[0].action, 'UPDATE');
  assert.equal(result.rows[0].existingUserId, 701);
  assert.equal(result.rows[0].existingAccreditedSellerId, null);
  assert.match(result.rows[0].warnings.join(' '), /Seller accreditation will be added/i);
});

test('a system account and its seller identity may share one email without duplicate-account import errors', () => {
  const systemAccount = {
    user_id: 702, user_status: 'active', role: 'sales', account_category: 'system',
    person_key: 'person-shared-1', is_system_account: 0, email: 'dual@example.com',
  };
  const sellerIdentity = {
    user_id: 703, accredited_seller_id: 903, seller_group_id: 10,
    accredited_seller_status: 'active', user_status: 'active', role: 'sales_director',
    account_category: 'seller', person_key: 'person-shared-1', is_system_account: 0,
    email: 'dual@example.com', seller_group_name: 'NA Realty Network', direct_report_count: 0,
  };
  const result = analyze([
    row({ first_name: 'Dual', last_name: 'Role', email: 'dual@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
  ], { existingAccounts: [systemAccount, sellerIdentity] });
  assert.equal(result.canCommit, true);
  assert.equal(result.rows[0].existingUserId, 703);
  assert.equal(result.rows[0].action, 'UPDATE');
  assert.doesNotMatch(result.rows[0].errors.join(' '), /Multiple existing accounts/i);
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
    row({ first_name: 'Maria', last_name: 'Santos', email: 'maria@example.com', role: 'UM', reports_under_email: 'john@example.com' }),
    row({ first_name: 'John', last_name: 'Cruz', email: 'john@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
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
  const result = analyze([row({ role: 'DM', reports_under_email: '', email: 'newdm@example.com' })]);
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
    role: 'DM', reports_under_email: '',
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

test('duplicate full names with different emails are allowed with a duplicate-name warning', () => {
  const result = analyze([
    row({ source_row: 2, first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan', email: 'robert1@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
    row({ source_row: 3, first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan', email: 'robert2@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
  ]);
  assert.equal(result.canCommit, true);
  assert.equal(result.summary.errors, 0);
  assert.equal(result.summary.warnings, 2);
  assert.match(result.rows[0].warnings.join(' '), /Possible duplicate name/i);
  assert.match(result.rows[0].warnings.join(' '), /Row 3 \(robert2@example\.com\)/i);
  assert.match(result.rows[1].warnings.join(' '), /Row 2 \(robert1@example\.com\)/i);
});

test('duplicate-name warning ignores letter case and repeated spacing', () => {
  const result = analyze([
    row({ source_row: 2, first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan', email: 'robert1@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
    row({ source_row: 3, first_name: '  robert ', middle_name: ' CORTEZ ', last_name: ' san   juan ', email: 'robert2@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
  ]);
  assert.equal(result.canCommit, true);
  assert.match(result.rows[1].warnings.join(' '), /Possible duplicate name/i);
});

test('full name matching another Accredited Seller in the target Network is allowed with a warning when email is different', () => {
  const existingMember = {
    accredited_seller_id: 150, user_id: 50, seller_group_id: 10,
    accredited_seller_status: 'active', is_system_dummy: 0,
    first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan',
    full_name: 'Robert Cortez San Juan', email: 'existing-robert@example.com',
    role: 'sales_director', user_status: 'active',
  };
  const result = analyze([
    row({ first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan', email: 'new-robert@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
  ], { currentMembers: [head, existingMember] });
  assert.equal(result.canCommit, true);
  assert.match(result.rows[0].warnings.join(' '), /Possible duplicate name/i);
  assert.match(result.rows[0].warnings.join(' '), /existing-robert@example\.com/i);
});

test('updating the same existing seller does not conflict with its own full name', () => {
  const existingMember = {
    accredited_seller_id: 151, user_id: 51, seller_group_id: 10,
    accredited_seller_status: 'active', is_system_dummy: 0,
    first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan',
    full_name: 'Robert Cortez San Juan', email: 'same-robert@example.com',
    role: 'sales_director', user_status: 'active', direct_report_count: 0,
    seller_group_name: 'NA Realty Network',
  };
  const result = analyze([
    row({ first_name: 'Robert', middle_name: 'Cortez', last_name: 'San Juan', email: 'same-robert@example.com', role: 'SD', reports_under_email: 'rowena@example.com' }),
  ], { currentMembers: [head, existingMember], existingAccounts: [existingMember] });
  assert.equal(result.canCommit, true);
  assert.equal(result.rows[0].action, 'UPDATE');
  assert.equal(result.rows[0].requiresExistingSellerUpdateConfirmation, true);
  assert.equal(result.summary.existingUpdates, 1);
  assert.match(result.rows[0].criticalWarnings.join(' '), /EXISTING SELLER WILL BE UPDATED/i);
  assert.doesNotMatch(result.rows[0].errors.join(' '), /Full Name/i);
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
  // Headers moved to a shared util so Export Members uses the same layout (2026-10-05).
  const excelUtil = await fs.readFile(path.join(root, 'client/src/utils/networkMemberExcel.js'), 'utf8');
  assert.match(modal, /NETWORK_MEMBER_EXCEL_HEADERS as HEADERS/);
  assert.match(excelUtil, /NETWORK_MEMBER_EXCEL_HEADERS = Object\.freeze\(\[[\s\S]*'Reports Under Email'[\s\S]*'PRC Number'/);
  const headersBlock = excelUtil.match(/NETWORK_MEMBER_EXCEL_HEADERS = Object\.freeze\(\[([\s\S]*?)\]\)/)?.[1] || '';
  assert.doesNotMatch(headersBlock, /Network Name|Status/);
  assert.match(modal, /SAMPLE - DELETE THIS ROW/);
  assert.match(modal, /aoa_to_sheet\(\[HEADERS, sampleMemberRow\]\)/);
  assert.match(modal, /String\(row\['First Name'\][\s\S]*SAMPLE_ROW_MARKER/);
  assert.match(modal, /'DM'[\s\S]*exampleHeadEmail[\s\S]*'SD'[\s\S]*'UM'[\s\S]*'SA'/);
  assert.match(modal, /formula1: '\"DM,SD,UM,SA\"'/);
  assert.doesNotMatch(modal, /Columns intentionally exclude Network Name and Status/);
  assert.doesNotMatch(modal, /Instructions and Examples for SD → UM → SA reporting/);
  assert.match(modal, /Download Template \(\.xlsx\)/);
  assert.match(modal, /All successful rows become Active/);
});


test('existing seller overwrites are shown as red risk and repeated in Final Double-Check', async () => {
  const modal = await fs.readFile(path.join(root, 'client/src/components/System/sellerGroupComponents/NetworkMemberImportModal.jsx'), 'utf8');
  const doubleCheck = await fs.readFile(path.join(root, 'client/src/components/Shared/DoubleCheckComponents/NetworkMemberImportDoubleCheck.jsx'), 'utf8');
  assert.match(modal, /UPDATE EXISTING/);
  assert.match(modal, /Overwrite Risk/);
  assert.match(modal, /criticalWarnings/);
  assert.match(modal, /existingUpdateMembers/);
  assert.match(doubleCheck, /Existing Seller Records Will Be Updated/);
  assert.match(doubleCheck, /tone="red"/);
  assert.match(doubleCheck, /existingUpdateMembers/);
});


test('commit requires Final Double-Check acknowledgement for exact existing seller update emails', async () => {
  const controller = await fs.readFile(path.join(root, 'server/controllers/System/sellerGroup.controller.js'), 'utf8');
  const modal = await fs.readFile(path.join(root, 'client/src/components/System/sellerGroupComponents/NetworkMemberImportModal.jsx'), 'utf8');
  assert.match(controller, /acknowledgedExistingSellerUpdateEmails/);
  assert.match(controller, /EXISTING_SELLER_UPDATE_CONFIRMATION_REQUIRED/);
  assert.match(controller, /newlyUnacknowledgedExistingUpdates/);
  assert.match(modal, /acknowledgedExistingSellerUpdateEmails: existingUpdateRows\.map/);
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


test('member import Preview is approved as validation-only technical mutation and Commit uses Final Double-Check', async () => {
  const apiClient = await fs.readFile(path.join(root, 'client/src/utils/apiClient.js'), 'utf8');
  const modal = await fs.readFile(path.join(root, 'client/src/components/System/sellerGroupComponents/NetworkMemberImportModal.jsx'), 'utf8');
  const doubleCheck = await fs.readFile(path.join(root, 'client/src/utils/doubleCheck.js'), 'utf8');
  const provider = await fs.readFile(path.join(root, 'client/src/components/Shared/DoubleCheckComponents/core/DoubleCheckProvider.jsx'), 'utf8');

  assert.match(apiClient, /seller-groups\\\/\\d\+\\\/members\\\/import\\\/preview/);
  assert.match(modal, /type: 'network-member-import'/);
  assert.match(doubleCheck, /'network-member-import'/);
  assert.match(provider, /'network-member-import': NetworkMemberImportDoubleCheck/);
});

test('member import Preview surfaces exact Excel row validation messages like Listing import', async () => {
  const modal = await fs.readFile(path.join(root, 'client/src/components/System/sellerGroupComponents/NetworkMemberImportModal.jsx'), 'utf8');
  assert.match(modal, /Row \${row\.sourceRow}: \${row\.errors\.join\(' '\)}/);
  assert.match(modal, /shown in the preview below/);
  assert.match(modal, /row\.errors\?\.map/);
});


test('commit preserves an existing employee/system login by creating a non-login seller identity and can attach seller accreditation to an existing seller user', async () => {
  const controller = await fs.readFile(path.join(root, 'server/controllers/System/sellerGroup.controller.js'), 'utf8');
  assert.match(controller, /preserveExistingLogin = Boolean\(row\.sourcePersonUserId\)/);
  assert.match(controller, /VALUES \('seller', \?, \?,[\s\S]*preserveExistingLogin \? 0 : 1/);
  assert.match(controller, /if \(accreditedSellerId\)[\s\S]*UPDATE accredited_sellers[\s\S]*else \{[\s\S]*INSERT INTO accredited_sellers/);
  assert.match(controller, /UPDATE employees[\s\S]*linked_user_id = COALESCE\(linked_user_id, \?\)/);
});
