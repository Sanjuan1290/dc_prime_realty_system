import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { traceSellerReportingChain } from '../services/sellerReportingChain.service.js';
import { updateMemberParent } from '../services/networkMemberChange.service.js';
import { validateSellerReportingChain } from '../controllers/System/sellerHierarchyRules.js';

const row = (sellerId, userId, role, parentUserId = null) => ({
  accredited_seller_id: sellerId,
  user_id: userId,
  role,
  accredited_seller_reports_under_user_id: parentUserId,
  seller_group_id: 90001,
  accredited_seller_status: 'active',
  user_status: 'active',
});
const members = [
  row(90004, 150013, 'sales_agent', 150014),
  row(90005, 150014, 'unit_manager', 150011),
  row(90002, 150011, 'sales_director', 150010),
  row(90001, 150010, 'division_manager', null),
];
const readByUser = (sellerRows) => async (userId) => sellerRows.find(r => Number(r.user_id) === Number(userId)) || null;

test('normal SA → UM → SD → DM chain ends at developer: it is not a reporting loop', async () => {
  const chain = await traceSellerReportingChain(members[0], readByUser(members));
  assert.deepEqual(chain.map(r => r.role), ['sales_agent', 'unit_manager', 'sales_director', 'division_manager']);
  assert.equal(validateSellerReportingChain(chain.map((r,i) => i===3 ? {...r,is_group_head:true} : r), {requireGroupHead:true}), true);
});

test('actual circular relationships are still rejected', async () => {
  const rows = [
    row(1, 101, 'sales_agent', 102),
    row(2, 102, 'unit_manager', 103),
    row(3, 103, 'sales_director', 102),
  ];
  await assert.rejects(traceSellerReportingChain(rows[0], readByUser(rows)), /reporting loop/i);
});

test('self-reporting is still rejected', async () => {
  const rows = [row(1, 101, 'sales_agent', 101)];
  await assert.rejects(traceSellerReportingChain(rows[0], readByUser(rows)), /reporting loop/i);
});

test('missing manager remains invalid rather than silently approving incomplete hierarchy', async () => {
  const chain = await traceSellerReportingChain(row(1, 101, 'sales_agent', 102), async () => null);
  assert.deepEqual(chain.map(r => r.role), ['sales_agent']);
  assert.throws(() => validateSellerReportingChain(chain, {requireGroupHead:true}), /Complete the Sales Agent/i);
});

test('network member reassignment updates reporting links only, never existing commission or buyer-account data', async () => {
  const calls = [];
  const conn = {query: async (sql, params) => {
    calls.push({sql,params});
    if (sql.startsWith('UPDATE accredited_sellers')) return [{affectedRows:1}];
    return [{affectedRows:1}];
  }};
  await updateMemberParent(conn, {accredited_seller_id: 90004, user_id: 150013}, 150012, {accredited_seller_id: 90005, user_id: 150014});
  assert.equal(calls.length, 3);
  assert.ok(calls.every(({sql}) => !/lot_project_(?:commissions|client_profiles|payments|accounts|payment_schedules|commission_releases)/i.test(sql)));
  assert.match(calls[0].sql, /^UPDATE accredited_sellers SET accredited_seller_reports_under_user_id=/);
  assert.match(calls[1].sql, /^DELETE FROM accredited_seller_managed_sellers/);
  assert.match(calls[2].sql, /^INSERT INTO accredited_seller_managed_sellers/);
});

test('bulk reassign and manager replacement code paths do not mutate reservation or commission tables', () => {
  const files = [
    '../controllers/System/networkMemberChange.controller.js',
    '../controllers/System/sellerManagerReplacement.controller.js',
  ];
  for (const path of files) {
    const contents = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.doesNotMatch(contents, /(?:UPDATE|DELETE\s+FROM|INSERT\s+INTO|REPLACE\s+INTO)\s+lot_project_(?:commissions|client_profiles|payments|accounts|commission_releases|payment_schedules)/i, path);
  }
});
