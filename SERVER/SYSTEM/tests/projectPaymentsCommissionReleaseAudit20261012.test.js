import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mapSellerReleaseAuditRow, mapCompanyProfitAuditRow, combineProjectPaymentAudit,
} from '../services/projectPaymentAuditEvents.js';

const root = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const source = (path) => readFileSync(resolve(root, path), 'utf8');
const controllerSource = source('SERVER/SYSTEM/controllers/Lot_Projects/PaymentLogs/PaymentLogs.controller.js');
const clientSource = source('CLIENT/SYSTEM/src/pages/Lot_Projects/PaymentLogs.jsx');

const sellerRelease = {
  release_id: 53, commission_role: 'unit_manager', release_stage: '1st Release', release_entry_mode: 'historical',
  net_release_amount: 2496, actual_release_date: '2026-09-07', action_at: '2026-10-12 10:00:00', recorded_at: '2026-10-12 10:00:00',
  seller_display_name_snapshot: 'Rowena Moreno', account_reference: 'ACCT-1', account_status: 'active',
  unit: 'LA-1805', buyer: 'Buyer A', receipt_reference: 'POI-53', first_name: 'Admin', last_name: 'Accountant',
};
const companyRelease = {
  release_id: 98, release_stage: '1st Release', release_amount: 1560, actual_release_date: '2026-10-12',
  action_at: '2026-10-12 11:00:00', recorded_at: '2026-10-12 11:00:00', payee_name: 'Network Payee', network_name_snapshot: 'North Star Network',
  account_reference: 'ACCT-1', account_status: 'active', unit: 'LA-1805', buyer: 'Buyer A',
  payment_method: 'Bank Transfer', payment_reference: 'NCP-98', first_name: 'Admin', last_name: 'Accountant',
};
const buyerPayment = {
  id: 'buyer-payment-4', category: 'buyer_payment', direction: 'incoming', amount: 100000,
  action: 'created', actionAt: '2026-10-12 09:00:00',
};

test('each released commission produces a traceable outgoing entry with its own recipient and amount', () => {
  const row = mapSellerReleaseAuditRow(sellerRelease, 'Bailen Project', String);
  assert.equal(row.id, 'seller-release-53');
  assert.equal(row.category, 'seller_commission');
  assert.equal(row.direction, 'outgoing');
  assert.equal(row.amount, 2496);
  assert.equal(row.payee, 'Rowena Moreno');
  assert.equal(row.referenceId, 'POI-53');
  assert.match(row.actionDescription, /Historical seller commission/);
  assert.match(row.actionDescription, /2026-09-07/);
  assert.equal(row.encodedBy, 'Admin Accountant');
});

test('historical release without a recording timestamp labels the fallback release date accurately', () => {
  const row = mapSellerReleaseAuditRow({ ...sellerRelease, recorded_at: null }, 'Bailen Project', String);
  assert.equal(row.actionAtText, '2026-09-07 (release date)');
});

test('external Network commission keeps its original payee, without becoming Company Profit', () => {
  const row = mapSellerReleaseAuditRow({ ...sellerRelease, release_id: 54, commission_role: 'external_group', seller_group_name_snapshot: 'External Realty' }, 'Bailen Project', String);
  assert.equal(row.category, 'seller_commission');
  assert.equal(row.payee, 'External Realty');
  assert.match(row.paymentType, /External Group/);
});

test('cancelled account archive retains its released milestone without inventing the recorder', () => {
  const row = mapSellerReleaseAuditRow({ ...sellerRelease, archived: 1, receipt_reference: 'ORIGINAL-REF' }, 'Bailen Project', String);
  assert.equal(row.encodedBy, 'Not retained in archive');
  assert.match(row.actionDescription, /Archived cancellation settlement/);
  assert.equal(row.referenceId, 'ORIGINAL-REF');
});

test('Company Profit is a separate outgoing category with saved bank reference and network', () => {
  const row = mapCompanyProfitAuditRow(companyRelease, 'Bailen Project', String);
  assert.equal(row.id, 'company-profit-98');
  assert.equal(row.category, 'company_profit');
  assert.equal(row.direction, 'outgoing');
  assert.equal(row.referenceId, 'NCP-98');
  assert.equal(row.paymentMethod, 'Bank Transfer');
  assert.equal(row.amount, 1560);
  assert.match(row.actionDescription, /North Star Network/);
});

test('missing seller Proof of Income reference is identified, never invented', () => {
  const row = mapSellerReleaseAuditRow({ ...sellerRelease, receipt_reference: null }, 'Bailen Project', String);
  assert.equal(row.referenceId, 'Release #53');
  assert.match(row.actionDescription, /No linked Proof of Income/);
});

test('mixed audit entries sort by recorded action timestamp and do not combine incoming/outgoing currency amounts', () => {
  const result = combineProjectPaymentAudit(
    [buyerPayment],
    [mapSellerReleaseAuditRow(sellerRelease, 'Bailen', String)],
    [mapCompanyProfitAuditRow(companyRelease, 'Bailen', String)],
  );
  assert.deepEqual(result.entries.map((entry) => entry.category), ['company_profit', 'seller_commission', 'buyer_payment']);
  assert.equal(result.stats.total, 3);
  assert.equal(result.stats.buyerPaymentLogs, 1);
  assert.equal(result.stats.sellerReleases, 1);
  assert.equal(result.stats.companyProfitReleases, 1);
  assert.equal(result.stats.released, 2);
  assert.equal(Object.hasOwn(result.stats, 'amount'), false, 'incoming buyer cash must not be summed with outgoing payouts');
});

test('audit feed caps latest events globally, not 300 from each financial source', () => {
  const result = combineProjectPaymentAudit([buyerPayment], [mapSellerReleaseAuditRow(sellerRelease, 'Bailen', String)], [mapCompanyProfitAuditRow(companyRelease, 'Bailen', String)], 2);
  assert.equal(result.entries.length, 2);
  assert.equal(result.stats.total, 2);
});

test('payment log controller reads released statuses only and remains project-scoped', () => {
  assert.match(controllerSource, /r\.release_status = 'Released'/);
  assert.match(controllerSource, /c\.lot_project_id = \?/);
  assert.match(controllerSource, /p\.lot_project_id = \?/);
  assert.match(controllerSource, /JOIN lot_project_network_profit_accounts p ON p\.id = r\.profit_account_id/);
  assert.match(controllerSource, /LEFT JOIN lot_project_commission_receipt_items ri/);
  assert.match(controllerSource, /AND receipt\.receipt_status = 'active'/);
  assert.match(controllerSource, /FROM lot_project_archived_commission_releases ar/);
  assert.match(controllerSource, /NOT EXISTS \(/);
  assert.doesNotMatch(controllerSource, /INSERT INTO|UPDATE lot_project_commission_releases|DELETE FROM/);
});

test('audit UI distinguishes source category and incoming/outgoing, with a released action filter', () => {
  assert.match(clientSource, /value="seller_commission"/);
  assert.match(clientSource, /value="company_profit"/);
  assert.match(clientSource, /value="released"/);
  assert.match(clientSource, /Outgoing payout/);
  assert.match(clientSource, /log\.payee/);
  assert.match(clientSource, /log\.category/);
  assert.match(clientSource, /unavailableCategories/);
});

test('commission changes invalidate the existing payment-audit query', () => {
  assert.match(source('CLIENT/SYSTEM/src/pages/Lot_Projects/Commission.jsx'), /invalidateQueries\(\{ queryKey: \['lot-payment-logs', projectSlug\] \}\)/);
  assert.match(source('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx'), /invalidateQueries\(\{ queryKey: \['lot-payment-logs', projectSlug\] \}\)/);
});

const handlerBody = controllerSource.slice(controllerSource.indexOf('export const getLotProjectPaymentLogs ='))
  .replace('export const getLotProjectPaymentLogs =', 'const getLotProjectPaymentLogs =');
const buildHandler = (permission, exists = true, archivedRows = []) => {
  const queries = [];
  let released = false;
  const db = { getConnection: async () => ({
    query: async (sql, params) => {
      queries.push({ sql, params });
      if (sql.includes('FROM lot_project_payment_logs pl')) return [[{
        lot_project_payment_log_id: 4, action_type: 'created', action_description: 'Buyer payment',
        action_at: '2026-10-12 09:00:00', lot_project_payment_id: 9,
        lot_project_payment_amount: 100000, lot_project_payment_type: 'downpayment',
        lot_project_payment_method: 'Bank', lot_project_payment_reference_id: 'PAY9',
        account_reference: 'ACCT-1', account_status: 'active', lot_project_listing_unit_id: 'LA-1805',
        buyer_full_name: 'Buyer A', lot_project_name: 'Bailen Project', first_name: 'Admin', last_name: 'Accountant',
      }]];
      if (sql.includes('FROM lot_project_commission_releases r')) return [[sellerRelease]];
      if (sql.includes('FROM lot_project_network_profit_releases r')) return [[companyRelease]];
      if (sql.includes('FROM lot_project_archived_commission_releases ar')) return [archivedRows];
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    release: () => { released = true; },
  }) };
  const dependencies = {
    db, getProjectBySlug: async () => ({ lot_project_id: 14, lot_project_name: 'Bailen Project', lot_project_slug: 'bailen' }),
    getErrorMessage: (err) => err.message,
    tableExists: async (_connection, table) => exists || ['lot_project_payment_logs', 'lot_project_payments', 'lot_project_listings'].includes(table),
    getUserFullName: () => 'Admin Accountant',
    dateTimeText: String, titleCase: (name) => name, dateOnly: (value) => String(value || '').slice(0, 10),
    toNumber: Number, isDateOnly: (value) => /^\d{4}-\d{2}-\d{2}$/.test(value),
    resolveAuditCategory: (value) => ['buyer_payment', 'seller_commission', 'company_profit'].includes(value) ? value : 'all',
    mapSellerReleaseAuditRow, mapCompanyProfitAuditRow, combineProjectPaymentAudit,
    roleHasPermission: () => permission, PERMISSIONS: { LOT_COMMISSIONS_VIEW: 'lot_project.commissions.view' },
  };
  const handler = new Function(...Object.keys(dependencies), `${handlerBody}\nreturn getLotProjectPaymentLogs;`)(...Object.values(dependencies));
  return { handler, queries, isReleased: () => released };
};

const invoke = async (handler, query = {}) => {
  const output = { status: 200 };
  const response = { status(status) { output.status = status; return this; }, json(data) { output.body = data; return this; } };
  await handler({ params: { projectSlug: 'bailen' }, query, authUser: { id: 1, role: 'accounting_staff' } }, response);
  return output;
};

test('runtime: payment log endpoint returns buyer payment, seller release, and Company Profit release', async () => {
  const testCase = buildHandler(true);
  const response = await invoke(testCase.handler);
  assert.equal(response.status, 200);
  assert.equal(response.body.data.length, 3);
  assert.equal(response.body.stats.released, 2);
  assert.ok(testCase.queries.some(({ sql }) => sql.includes('FROM lot_project_commission_releases r')));
  assert.ok(testCase.queries.some(({ sql }) => sql.includes('FROM lot_project_network_profit_releases r')));
  assert.equal(testCase.isReleased(), true);
});

test('runtime: category and action filters prevent unrelated financial-source queries', async () => {
  const testCase = buildHandler(true);
  const response = await invoke(testCase.handler, { category: 'seller_commission', action: 'released', search: 'Rowena', dateFrom: '2026-10-01' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((item) => item.category), ['seller_commission']);
  const sql = testCase.queries.find((entry) => entry.sql.includes('FROM lot_project_commission_releases r'));
  assert.deepEqual(sql.params.slice(0, 2), [14, '2026-10-01 00:00:00']);
  assert.equal(sql.params.length, 11); // 1 project + 1 date + 9 search parameters
  assert.equal(testCase.queries.some(({ sql: q }) => q.includes('FROM lot_project_payment_logs pl')), false);
});

test('runtime: payment-audit-only permission cannot expose confidential commissions', async () => {
  const testCase = buildHandler(false);
  const response = await invoke(testCase.handler);
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((item) => item.category), ['buyer_payment']);
  assert.equal(response.body.canViewCommissionReleases, false);
  assert.equal(testCase.queries.some(({ sql }) => sql.includes('FROM lot_project_commission_releases r')), false);
  const explicit = await invoke(testCase.handler, { category: 'company_profit' });
  assert.equal(explicit.status, 403);
  assert.equal(testCase.isReleased(), true);
});

test('runtime: missing optional Company Profit migration is disclosed, without hiding buyer payment logs', async () => {
  const testCase = buildHandler(true, false);
  const response = await invoke(testCase.handler);
  assert.equal(response.status, 200);
  assert.deepEqual([...response.body.unavailableCategories], ['Seller Commission Releases', 'Network Company Profit Releases']);
  assert.equal(response.body.data.length, 1);
});


test('runtime: cancelled sale release archive is queried only with seller release category, never when viewing buyer payments', async () => {
  const audit = buildHandler(true);
  await invoke(audit.handler, { category: 'seller_commission' });
  assert.equal(audit.queries.some(({ sql }) => sql.includes('FROM lot_project_archived_commission_releases ar')), true);
  const buyerOnly = buildHandler(true);
  await invoke(buyerOnly.handler, { category: 'buyer_payment' });
  assert.equal(buyerOnly.queries.some(({ sql }) => sql.includes('FROM lot_project_archived_commission_releases ar')), false);
});


test('runtime: cancelled sale historical payout remains one outgoing entry with its original release ID', async () => {
  const testCase = buildHandler(true, true, [{ ...sellerRelease, release_id: 88, archived: 1,
    receipt_reference: 'ARCH-88', recorded_at: null, action_at: '2026-09-07 00:00:00',
  }]);
  const response = await invoke(testCase.handler, { category: 'seller_commission' });
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.data.map((item) => item.id), ['seller-release-53', 'seller-release-88']);
  assert.equal(response.body.stats.sellerReleases, 2);
  assert.equal(response.body.data[1].encodedBy, 'Not retained in archive');
  assert.equal(response.body.data[1].referenceId, 'ARCH-88');
});


