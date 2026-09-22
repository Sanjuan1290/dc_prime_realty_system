import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('listing profile exposes the canonical financial snapshot and SOA consumes it first', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  const profile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

  assert.match(controller, /buildAccountFinancialSnapshot/);
  assert.match(controller, /financialSnapshot\s*=\s*buildAccountFinancialSnapshot\(/);
  assert.match(controller, /financialSnapshot,/);
  assert.match(profile, /profile\.financialSnapshot/);
  assert.match(payments, /listing\?\.financialSnapshot\?\.receivable/);
  assert.match(payments, /canonicalReceivable\?\.totalAccountOutstanding \?\? localTotalDue/);
  assert.match(payments, /canonicalCash\?\.verifiedCollections \?\? localTotalPaid/);
});

test('commission, reports, and Data Integrity share canonical financial services', () => {
  const commission = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  const reports = read('server/controllers/System/reports.controller.js');
  const integrity = read('server/controllers/System/dataIntegrity.controller.js');

  assert.match(commission, /commissionReconciliation\.service\.js/);
  assert.match(commission, /reconcileCommission\(\{/);
  assert.match(commission, /buildAccountContext\(\{ account: row \}\)\.isHistoricalEntry/);

  assert.match(reports, /summarizeContractFinancials/);
  assert.match(reports, /reconcileCommissionCohort/);
  assert.match(reports, /resolveCommissionReleaseStatusAsOf/);

  assert.match(integrity, /buildAccountContext/);
  assert.match(integrity, /reconcileCommission\(\{/);
  assert.match(integrity, /canonical release-stage reconciliation/);
});

test('account history is not silently treated as an explicitly historical entry', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  const integrity = read('server/controllers/System/dataIntegrity.controller.js');

  assert.doesNotMatch(controller, /row\.isHistoricalAccount\s*=\s*readOnly/);
  assert.doesNotMatch(controller, /isHistoricalAccount:\s*true/);
  assert.match(controller, /isHistoricalEntry:\s*accountContext\.isHistoricalEntry/);
  assert.match(controller, /isAccountHistory:\s*true/);

  assert.match(integrity, /isHistorical:\s*accountContext\.isHistoricalEntry/);
  assert.match(integrity, /isAccountHistory:\s*accountContext\.isAccountHistory/);
});
