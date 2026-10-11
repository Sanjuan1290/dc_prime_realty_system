import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertCompanyProfitWithinPolicy,
  getMaxCompanyProfitRate,
  validateGroupFixedRateStructure,
} from '../controllers/System/groupFixedCommissionRates.service.js';
import {
  findSellerIdentityConflicts,
  normalizeSellerIdentityNumber,
} from '../services/sellerIdentity.service.js';
import { analyzeNetworkMemberImport } from '../controllers/System/networkMemberImport.service.js';

const readProjectFile = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');
const allocation = (pool, cp) => validateGroupFixedRateStructure({ seller_group_pool_rate: pool, company_profit_rate: cp }, {});

test('Company Profit cap defaults to 50% of the Pool Rate and allows 4 decimals', () => {
  assert.equal(getMaxCompanyProfitRate(8, 50), 4);
  assert.equal(getMaxCompanyProfitRate(9.1234, 50), 4.5617);
  assert.doesNotThrow(() => assertCompanyProfitWithinPolicy(allocation(8, 4), {}));
  assert.doesNotThrow(() => assertCompanyProfitWithinPolicy(allocation(8, 2.1234), {}));
  assert.throws(() => assertCompanyProfitWithinPolicy(allocation(8, 4.0001), {}), /at most 4\.0000%/);
});

test('Company Profit may not leave any role at 0%', () => {
  assert.throws(
    () => assertCompanyProfitWithinPolicy(allocation(8, 7.9999), { maxPercentOfPool: 100 }),
    /leaves Division Manager with 0%/
  );
});

test('External Networks have no Company Profit policy', () => {
  const external = validateGroupFixedRateStructure({ seller_group_pool_rate: 8 }, { groupType: 'external' });
  assert.doesNotThrow(() => assertCompanyProfitWithinPolicy(external, { groupType: 'external' }));
});

test('Spec example still distributes exactly: 8% pool, 2% CP', () => {
  const rates = allocation(8, 2);
  assert.deepEqual(
    [rates.division_manager_rate, rates.sales_director_rate, rates.unit_manager_rate, rates.sales_agent_rate, rates.allocated_rate],
    [0.8508, 0.9492, 1.2, 3, 6]
  );
});

test('PRC/TIN normalization ignores case, spaces, dashes and dots', () => {
  assert.equal(normalizeSellerIdentityNumber(' prc-00.12 345 '), 'PRC0012345');
  assert.equal(normalizeSellerIdentityNumber('123-456-789-000'), '123456789000');
});

test('PRC/TIN conflicts are reported against other active sellers only', () => {
  const matches = [{ user_id: 7, first_name: 'Ana', last_name: 'Cruz', seller_group_name: 'Alpha', prc_normalized: 'PRC1', tin_normalized: '999' }];
  assert.equal(findSellerIdentityConflicts({ prcNo: 'prc-1', matches }).errors.length, 1);
  assert.equal(findSellerIdentityConflicts({ prcNo: 'prc-1', excludeUserIds: [7], matches }).errors.length, 0);
  assert.match(findSellerIdentityConflicts({ prcNo: 'X', tinNo: '9-9-9', matches }).errors[0], /TIN 9-9-9 already belongs to an active seller: Ana Cruz in Alpha/);
});

const importGroup = { seller_group_id: 1, seller_group_type: 'in_house', seller_group_status: 'active', seller_group_head_user_id: 10 };
const importHead = { user_id: 10, email: 'dm@x.com', role: 'division_manager', full_name: 'Head DM', user_status: 'active', accredited_seller_status: 'active' };
const sdRow = (extra = {}) => ({ first_name: 'Juan', last_name: 'Santos', email: 'sd@x.com', role: 'SD', reports_under_email: 'dm@x.com', ...extra });

test('Excel import requires PRC No. for new members', () => {
  const result = analyzeNetworkMemberImport({ rows: [sdRow()], group: importGroup, currentMembers: [importHead] });
  assert.equal(result.canCommit, false);
  assert.ok(result.rows[0].errors.includes('PRC No. is required for in-house sellers.'));
});

test('Excel import blocks a PRC used by another active seller and duplicates inside the file', () => {
  const identityMatches = [{ user_id: 55, first_name: 'Other', last_name: 'Person', seller_group_name: 'Beta', prc_normalized: 'PRC9', tin_normalized: '' }];
  const blocked = analyzeNetworkMemberImport({ rows: [sdRow({ prc_number: 'prc-9' })], group: importGroup, currentMembers: [importHead], identityMatches });
  assert.match(blocked.rows[0].errors.join(' '), /PRC No\. prc-9 already belongs to an active seller: Other Person in Beta/);

  const twice = analyzeNetworkMemberImport({
    rows: [sdRow({ prc_number: 'A1' }), sdRow({ first_name: 'Pedro', email: 'sd2@x.com', prc_number: 'a-1' })],
    group: importGroup,
    currentMembers: [importHead],
  });
  assert.ok(twice.rows.every((row) => row.errors.some((message) => /appears more than once/.test(message))));
});

test('Excel import accepts a valid new member with a PRC No.', () => {
  const ok = analyzeNetworkMemberImport({ rows: [sdRow({ prc_number: 'PRC-77' })], group: importGroup, currentMembers: [importHead] });
  assert.equal(ok.canCommit, true);
});

test('Broker Name is no longer unique; License, Realty and PRC still are', async () => {
  const controller = await readProjectFile('server/controllers/System/sellerGroup.controller.js');
  const migration = await readProjectFile('server/migrations/20261005_batch5_broker_name_and_company_profit_cap.sql');
  assert.doesNotMatch(controller, /conflicts\.push\('Broker Name'\)/);
  assert.match(controller, /is already the broker of/);
  assert.match(migration, /DROP INDEX IF EXISTS uq_network_broker_name_normalized/);
});

test('Rate inputs accept 4 decimals', async () => {
  const fields = await readProjectFile('client/src/components/System/sellerGroupComponents/ProjectAccreditationFields.jsx');
  const settings = await readProjectFile('client/src/components/System/settingsComponents/SystemSettingsForm.jsx');
  assert.doesNotMatch(fields, /step="0\.01"/);
  assert.doesNotMatch(settings, /max="100" step="0\.01"/);
  assert.match(settings, /maxCompanyProfitPercentOfPool/);
});

test('Network page offers Export Members in the import layout and gates Import Members', async () => {
  const page = await readProjectFile('client/src/pages/System/SellerGroupDetails.jsx');
  const util = await readProjectFile('client/src/utils/networkMemberExcel.js');
  assert.match(page, /Export Members/);
  assert.match(page, /!isExternal && canImportMembers/);
  assert.match(util, /NETWORK_MEMBER_EXCEL_HEADERS/);
});

