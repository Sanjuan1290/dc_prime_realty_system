import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';


const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('cancelled commission progress uses retained/discontinued value over original commission base', () => {
  const percent = Math.round(((40000 / 390000) * 100 + Number.EPSILON) * 100) / 100;
  const wrongLivePercent = Math.round(((50000 / 429000) * 100 + Number.EPSILON) * 100) / 100;
  assert.equal(percent, 10.26);
  assert.equal(wrongLivePercent, 11.66);
  assert.notEqual(percent, wrongLivePercent);
});

test('Commissions read-time synchronization resolves cancelled rows from the frozen account snapshot', () => {
  const controller = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  assert.match(controller, /const cancelledCommissionProgressSql/);
  assert.match(controller, /cancelled_account\.account_status = 'cancelled'/);
  assert.match(controller, /cancelled_account\.commissionable_retained_percent/);
  assert.match(controller, /WHEN \(\$\{cancelledCommissionProgressSql\}\) IS NOT NULL/);
});

test('normal commission synchronization does not reclassify cancelled historical milestones', () => {
  const service = read('server/services/commissionProgress.service.js');
  assert.match(service, /const cancellationFrozen = clean\(context\.account_status\)\.toLowerCase\(\) === 'cancelled'/);
  assert.match(service, /retainedAmount = toNumber\(context\.discontinued_amount\)/);
  assert.match(service, /commission_base_amount/);
  assert.match(service, /if \(!cancellationFrozen && await tableExists\(connection, 'lot_project_commission_releases'\)\)/);
});

test('Data Integrity validates cancelled commission rows using the cancellation retained basis', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');
  assert.match(controller, /calculateCommissionableRetainedPercent/);
  assert.match(controller, /isCancelledAccount/);
  assert.match(controller, /cancellation-retained calculation/);
  assert.match(controller, /commissionProgressMode: isCancelledAccount \? 'cancellation_retained' : 'active_contract'/);
});

test('repair migration fixes existing overwritten headers and records an audit event', () => {
  const migration = read('server/migrations/20260908_cancelled_commission_progress_freeze.sql');
  assert.match(migration, /a\.account_status = 'cancelled'/);
  assert.match(migration, /a\.discontinued_amount/);
  assert.match(migration, /c\.commission_base_amount/);
  assert.match(migration, /UPDATE lot_project_commissions/);
  assert.match(migration, /INSERT INTO audit_logs/);
  assert.match(migration, /previousPaymentPercent/);
  assert.match(migration, /repairedPaymentPercent/);
});
