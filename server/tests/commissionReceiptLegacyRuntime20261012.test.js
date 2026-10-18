import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const source = readFileSync(resolve(root, 'server/controllers/Lot_Projects/Commissions/CommissionReleaseReceipt.controller.js'), 'utf8')
  .replace(/^import .*;\s*\n/, '')
  .replace('export const getCommissionReleaseReceipt =', 'globalThis.handle =');

const fakeRequest = { params: { projectSlug: 'bailen-project', commissionId: '8', releaseId: '11' } };

const exercise = async (queryRows) => {
  const events = [];
  const db = { getConnection: async () => ({
    query: async (sql, params) => {
      events.push({sql, params});
      return [queryRows.shift() || []];
    },
    release: () => events.push({released: true}),
  }) };
  const context = { db, getProjectBySlug: async () => ({lot_project_id: 13}), getErrorMessage: (err) => err.message };
  runInNewContext(source, context, {filename: 'CommissionReleaseReceipt.controller.js'});
  const result = {status: 200};
  const res = {
    status(code) { result.status = code; return this; },
    json(data) { result.data = data; return this; },
  };
  await context.handle(fakeRequest, res);
  return { ...result, events };
};

test('previously paid stage without a receipt returns a scoped receipt-only path', async () => {
  const outcome = await exercise([[], [{accredited_seller_id: 25, sale_owner_accredited_seller_id: 28, commission_rate_type:'direct', actual_release_date:'2026-10-11'}]]);
  assert.equal(outcome.status, 404);
  assert.equal(outcome.data.code, 'RELEASE_RECEIPT_NOT_FOUND');
  assert.equal(outcome.data.legacyReceipt.sellerId, 28);
  assert.deepEqual(Array.from(outcome.events[0].params), [13, 8, 11]);
  assert.deepEqual(Array.from(outcome.events[1].params), [13, 8, 11]);
  assert.equal(outcome.events.at(-1).released, true);
});

test('unpaid stage does not expose a path for a historical receipt', async () => {
  const outcome = await exercise([[], []]);
  assert.equal(outcome.status, 404);
  assert.equal(outcome.data.legacyReceipt, undefined);
  assert.equal(outcome.events.at(-1).released, true);
});

test('a receipt covering two paid milestones prints both and preserves its total', async () => {
  const outcome = await exercise([[{
    lot_project_commission_receipt_id: 44,
    accredited_seller_id: 27, bank_name:'BPI',account_number:'12345',receipt_date:'2026-10-12',
    reference_number:'REF123',witness_name:'Witness',total_amount:12480,
    unit_id:'LA-1805', buyer_name:'Buyer', commission_role:'unit_manager',
    commission_rate:1.6,gross_commission:12480,
    release_stage:'1st Release',release_percent:20,release_trigger_percent:20,net_release_amount:2496,
  }], [
    {release_stage:'1st Release',release_percent:20,release_trigger_percent:20,release_amount:2496},
    {release_stage:'2nd Release',release_percent:20,release_trigger_percent:40,release_amount:2496},
  ]]);
  assert.equal(outcome.status, 200);
  assert.equal(outcome.data.data.receipt.totalAmount, 12480);
  assert.equal(outcome.data.data.receipt.releasePercent, 40);
  assert.equal(outcome.data.data.receipt.cumulativeTargetPercent, 40);
  assert.equal(outcome.data.data.receipt.releases.length, 2);
  assert.equal(outcome.data.data.accreditedSellerId, 27);
  assert.deepEqual(Array.from(outcome.events[1].params), [44, 13, 8]);
});

