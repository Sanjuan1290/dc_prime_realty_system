import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (name) => readFileSync(path.join(root, name), 'utf8');
const page = read('client/src/pages/Lot_Projects/Commission.jsx');
const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
const profitPanel = read('client/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx');
const group = read('client/src/utils/commissionRecords.js');
const backend = read('server/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js');
const selector = await import('../../client/src/utils/networkProfitSelector.js');

test('one Commission Records modal contains both personal sellers and Company Profit', () => {
  assert.match(page, /commissionGroup=\{selected\}/);
  assert.match(page, /projectSlug=\{projectSlug\}/);
  assert.doesNotMatch(page, /<NetworkCompanyProfitPanel/);
  assert.match(modal, /Company & Seller Commission/);
  assert.match(modal, /companyProfits\.map/);
  assert.match(modal, /sellers\.map/);
  assert.match(modal, /company:\$\{profit\.id\}/);
  assert.match(modal, /seller:\$\{seller\.commissionId/);
  assert.match(modal, /selectedProfit \? \(/);
  assert.match(modal, /<NetworkCompanyProfitPanel/);
  assert.match(modal, /embedded/);
  assert.match(modal, /profitRecord=\{selectedProfit\}/);
  assert.match(page, /View Company & Seller Commissions/);
});

test('profit record selection requires exact buyer account ID, avoiding resold unit mixups', () => {
  assert.match(modal, /selectCompanyProfitsForAccount\(profitResponse\?\.data, commissionGroup\?\.accountId\)/);
  const records = [{ id: 1, accountId: 101, unit: 'LA-1805' }, { id: 2, accountId: 202, unit: 'LA-1805' }, { id: 3, accountId: 101, unit: 'LA-1805' }];
  assert.deepEqual(selector.selectCompanyProfitsForAccount(records, 101).map((row) => row.id), [1, 3]);
  assert.deepEqual(selector.selectCompanyProfitsForAccount(records, 202).map((row) => row.id), [2]);
  assert.deepEqual(selector.selectCompanyProfitsForAccount(records, null), []);
  assert.deepEqual(selector.selectCompanyProfitsForAccount(records, 0), []);
  assert.match(modal, /enabled: Boolean\(projectSlug && commissionGroup\?\.accountId\)/);
  assert.doesNotMatch(modal, /profit\.unit === commissionGroup/);
  assert.match(group, /const key = accountId/);
});

test('Company Profit is never added to seller totals and has separate release approvals', () => {
  assert.match(page, /summary\.gross \+= Number\(item\.grossCommission/);
  assert.match(page, /summary\.released \+= Number\(item\.released/);
  assert.match(profitPanel, /enabled: Boolean\(projectSlug\) && !embedded/);
  assert.match(profitPanel, /queryClient\.invalidateQueries\(\{ queryKey \}/);
  assert.match(profitPanel, /doubleCheck: \{ type: 'commission-release'/);
  assert.match(profitPanel, /SignedCopyUploadModal/);
  assert.match(profitPanel, /Print Acknowledgment/);
  assert.match(backend, /WHERE id = \? AND profit_account_id = \? AND release_status = 'Pending'/);
});
