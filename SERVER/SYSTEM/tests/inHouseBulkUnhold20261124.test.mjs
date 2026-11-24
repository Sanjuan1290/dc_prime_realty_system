import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { validateExactBulkRecipients } from '../services/inHouseBulkReleasePolicy.js';

const source = readFileSync(new URL('../controllers/Lot_Projects/Commissions/InHouseBulkUnhold.controller.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export const unholdAllInHouseMilestone =', 'globalThis.handle =');

const makeFixture = () => ({
  profit: { id: 9, lot_project_id: 13, lot_project_account_id: 42, seller_group_id: 7,
    seller_group_type: 'in_house', seller_group_status: 'active', account_status: 'active',
    unit: 'QA-01', network_name_snapshot: 'QA Network', payee_name_snapshot: 'QA Company' },
  company: { id: 90, release_status: 'Pending', release_amount: 1000 },
  sellers: [{ commissionId: 1, role: 'division_manager' }, { commissionId: 2, role: 'sales_agent' }],
  releases: [1, 2].map(id => ({ commissionId: id, paymentPercent: 100, paymentComplete: true, documentsComplete: true,
    computedStatus: 'On Hold', release: { lot_project_commission_id: id, lot_project_commission_release_id: id + 10,
      release_status: 'On Hold', net_release_amount: 1234.56, actual_release_date: null, released_by_user_id: null } })),
});
const request = () => ({ authUser: { id: 5, role: 'system_admin' }, params: { projectSlug: 'qa', profitId: '9' },
  body: { stage: 'Retention', confirmUnholdAll: true,
    recipients: [{ type: 'company' }, { type: 'seller', commissionId: 1 }, { type: 'seller', commissionId: 2 }] } });

const exercise = async ({ fixture = makeFixture(), req = request(), failReview = false, lock = false, conflict = false, signedIn = true } = {}) => {
  let saved = structuredClone(fixture), pending = null;
  const events = [], reviews = [], audits = [];
  const current = () => pending || saved;
  const connection = {
    async beginTransaction() { pending = structuredClone(saved); events.push('begin'); },
    async commit() { saved = pending; pending = null; events.push('commit'); },
    async rollback() { pending = null; events.push('rollback'); },
    release() { events.push('close'); },
    async query(sql, params) {
      const normalized = sql.replace(/\s+/g, ' ');
      events.push({ sql: normalized, params: Array.from(params) });
      if (normalized.includes('SELECT p.*')) {
        assert.deepEqual(Array.from(params), [9, 13]);
        return [[current().profit].filter(Boolean)];
      }
      if (normalized.includes('SELECT * FROM lot_project_network_profit_releases')) return [[current().company].filter(Boolean)];
      if (normalized.includes('AS commissionId')) return [current().sellers];
      if (normalized.includes('SELECT lot_project_commission_id FROM')) return [[{ lot_project_commission_id: params[0] }]];
      if (normalized.startsWith('UPDATE lot_project_commission_releases')) {
        if (conflict) return [{ affectedRows: 0 }];
        const loaded = current().releases.find(row => row.commissionId === params[1]);
        assert.equal(loaded.release.release_status, params[2]);
        loaded.release.release_status = 'Eligible'; loaded.computedStatus = 'Eligible';
        return [{ affectedRows: 1 }];
      }
      if (normalized.startsWith('UPDATE lot_project_network_profit_releases')) {
        current().company.release_status = 'Pending'; return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected query: ${normalized}`);
    },
  };
  const context = {
    db: { getConnection: async () => connection },
    randomUUID: () => 'qa-batch', getAuthenticatedUser: async () => signedIn ? req.authUser : null,
    getProjectBySlug: async () => ({ lot_project_id: 13 }), tableExists: async () => true,
    getErrorMessage: error => error.message, validateExactBulkRecipients,
    loadLiveSellerReleaseForBatch: async (_, args) => {
      assert.equal(args.accountId, 42); assert.equal(args.projectId, 13); assert.equal(args.stage, 'Retention');
      return current().releases.find(row => row.commissionId === args.commissionId) || null;
    },
    finishBatchSellerRelease: async (_, release, commissionId) => events.push({ reconciled: commissionId }),
    assertEntityNotReviewLocked: async () => { if (lock) throw Object.assign(new Error('Record is review locked.'), { statusCode: 409 }); },
    writeAuditLog: async (_, __, audit) => audits.push(audit),
    createOperationalReview: async (_, review) => {
      if (failReview && reviews.length) throw new Error('Review unavailable.');
      reviews.push(review);
    },
  };
  runInNewContext(source, context);
  const result = { status: 200 };
  const res = { status(code) { result.status = code; return this; }, json(body) { result.body = body; return this; } };
  await context.handle(req, res);
  return { ...result, saved, events, reviews, audits };
};

test('unholds the selected milestone for every held seller without paying them', async () => {
  const result = await exercise();
  assert.equal(result.status, 200);
  assert.equal(result.body.data.unheld.length, 2);
  assert.equal(result.saved.company.release_status, 'Pending');
  assert.ok(result.saved.releases.every(row => row.release.release_status === 'Eligible'));
  assert.ok(result.saved.releases.every(row => row.release.actual_release_date === null && row.release.released_by_user_id === null));
  assert.deepEqual(result.saved.releases.map(row => row.release.net_release_amount), [1234.56, 1234.56]);
  assert.equal(result.reviews.length, 2);
  assert.ok(result.reviews.every(row => row.actionKey === 'commission.unhold' && row.beforeSnapshot.status === 'On Hold' && row.afterSnapshot.status === 'Eligible'));
  assert.equal(result.events.at(-2), 'commit'); assert.equal(result.events.at(-1), 'close');
});

test('also removes a held Company Profit stage without releasing its payment', async () => {
  const fixture = makeFixture(); fixture.company.release_status = 'On Hold';
  const result = await exercise({ fixture });
  assert.equal(result.status, 200); assert.equal(result.body.data.unheld.length, 3);
  assert.equal(result.saved.company.release_status, 'Pending');
  assert.ok(result.reviews.some(row => row.entityType === 'lot_project_network_profit_release'));
});

test('completed recipients retain their original payment and receipt data', async () => {
  const fixture = makeFixture();
  fixture.company.release_status = 'Released';
  fixture.releases[0].computedStatus = 'Released';
  Object.assign(fixture.releases[0].release, { release_status: 'Released', actual_release_date: '2026-11-22', released_by_user_id: 8 });
  const original = structuredClone(fixture.releases[0]);
  const result = await exercise({ fixture });
  assert.equal(result.status, 200); assert.equal(result.body.data.unheld.length, 1);
  assert.deepEqual(result.saved.releases[0], original); assert.equal(result.saved.company.release_status, 'Released');
});

for (const [name, change] of [
  ['less than 100% payment', fixture => { fixture.releases[1].paymentPercent = 99.99; }],
  ['incomplete payment', fixture => { fixture.releases[1].paymentComplete = false; }],
  ['missing required documents', fixture => { fixture.releases[1].documentsComplete = false; }],
  ['cancelled account', fixture => { fixture.profit.account_status = 'cancelled'; }],
  ['inactive Network', fixture => { fixture.profit.seller_group_status = 'inactive'; }],
  ['External Network', fixture => { fixture.profit.seller_group_type = 'external'; }],
  ['unexpected seller role', fixture => { fixture.sellers[1].role = 'external_group'; }],
  ['missing milestone', fixture => { fixture.releases.pop(); }],
  ['forfeited stage', fixture => { fixture.releases[1].computedStatus = 'Forfeited on Cancellation'; }],
  ['receipt-dependent hold', fixture => { fixture.releases[1].release.external_receipt_hold_source_release_id = 123; }],
]) test(`rejects ${name} before any stage is changed`, async () => {
  const fixture = makeFixture(); change(fixture);
  const result = await exercise({ fixture });
  assert.equal(result.status, 409); assert.deepEqual(result.saved, fixture);
  assert.equal(result.reviews.length, 0); assert.ok(result.events.includes('rollback'));
  assert.equal(result.events.some(event => event.sql?.startsWith('UPDATE ')), false);
});

test('rejects forged recipients and requires explicit confirmation and authentication', async () => {
  for (const change of [
    req => { req.body.recipients[2].commissionId = 999; },
    req => { req.body.recipients.pop(); },
    req => { req.body.recipients.push({ type: 'seller', commissionId: 1 }); },
    req => { req.body.confirmUnholdAll = false; },
    req => { req.body.stage = 'all'; },
    req => { req.params.profitId = 'NaN'; },
  ]) {
    const req = request(); change(req);
    const result = await exercise({ req });
    assert.equal(result.status, 400); assert.deepEqual(result.saved, makeFixture());
    assert.equal(result.events.some(event => event.sql?.startsWith('UPDATE ')), false);
  }
  assert.equal((await exercise({ signedIn: false })).status, 401);
});

test('review locks, concurrent changes and later failures roll back the whole batch', async () => {
  for (const option of [{ lock: true }, { conflict: true }, { failReview: true }]) {
    const result = await exercise(option);
    assert.ok(result.status >= 400); assert.deepEqual(result.saved, makeFixture());
    assert.ok(result.events.includes('rollback')); assert.ok(!result.events.includes('commit'));
  }
});

test('a repeated request does not create duplicate changes, reviews or audits', async () => {
  const first = await exercise();
  const second = await exercise({ fixture: first.saved });
  assert.equal(second.status, 200); assert.equal(second.body.alreadyApplied, true);
  assert.equal(second.body.data.unheld.length, 0); assert.equal(second.reviews.length, 0); assert.equal(second.audits.length, 0);
  assert.deepEqual(second.saved, first.saved);
});

test('HTTP route requires the distinct Unhold permission', () => {
  const router = readFileSync(new URL('../routers/System/projects.routers.js', import.meta.url), 'utf8');
  assert.match(router, /\/unhold-all', requirePermission\(PERMISSIONS.LOT_COMMISSIONS_UNHOLD\), unholdAllInHouseMilestone/);
});
