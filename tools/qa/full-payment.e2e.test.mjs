// Synthetic data only, guarded by both server port and the QA datadir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
const require = createRequire(new URL('../../SERVER/SYSTEM/package.json', import.meta.url));
const db = require('mysql2/promise').createPool({ host: '127.0.0.1', port: 13307, user: 'qa_system', password: 'qa-isolated-only-password', database: 'dc_prime_realty_system_db', dateStrings: true });
let cookie, headCookie, staffCookie;
async function api(path, body, method = body ? 'POST' : 'GET', auth = cookie) {
  const response = await fetch('http://127.0.0.1:5201/api/v1' + path, { method, headers: { origin: 'http://127.0.0.1:4179', ...(auth ? { cookie: auth } : {}), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
  return { status: response.status, data: await response.json(), headers: response.headers };
}
function ok(result, status = 200) { assert.equal(result.status, status, JSON.stringify(result.data)); return result.data; }
test.before(async () => {
  const [[server]] = await db.query('SELECT @@port AS port, @@datadir AS datadir');
  assert.equal(server.port, 13307); assert.equal(server.datadir.toLowerCase().replaceAll('\\', '/').replace(/\/$/, ''), resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\', '/'));
  await db.query("INSERT INTO users(account_category,first_name,last_name,email,password_hash,role,status,must_change_password,all_projects_access) SELECT 'system','QA','Accounting Head','full-payment-head@qa.invalid',password_hash,'accounting_head','active',0,1 FROM users WHERE id=1 ON DUPLICATE KEY UPDATE role='accounting_head'");
  const [[head]] = await db.query("SELECT id FROM users WHERE email='full-payment-head@qa.invalid'");
  for (const key of ['view', 'create', 'edit', 'delete']) await db.query('INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(?,?,1) ON DUPLICATE KEY UPDATE allowed=1', [head.id, 'lot_project.payments.' + key]);
  await db.query('INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(?,?,1) ON DUPLICATE KEY UPDATE allowed=1', [head.id, 'workflow.department.approve_protected_change']);
  for (const [email, save] of [['system@qa.invalid', false], ['full-payment-head@qa.invalid', true]]) {
    const login = await api('/user/login', { email, password: 'Synthetic-QA-only-2026!' }); ok(login);
    const value = login.headers.get('set-cookie').split(';')[0]; if (save) headCookie = value; else cookie = value;
  }
  await db.query("INSERT INTO users(account_category,first_name,last_name,email,password_hash,role,status,must_change_password,all_projects_access) SELECT 'system','QA','Accounting Staff','full-payment-staff@qa.invalid',password_hash,'accounting_staff','active',0,1 FROM users WHERE id=1 ON DUPLICATE KEY UPDATE role='accounting_staff'");
  const [[staff]] = await db.query("SELECT id FROM users WHERE email='full-payment-staff@qa.invalid'");
  for (const key of ['view', 'create', 'edit']) await db.query('INSERT INTO user_permissions(user_id,permission_key,allowed) VALUES(?,?,1) ON DUPLICATE KEY UPDATE allowed=1', [staff.id, 'lot_project.payments.' + key]);
  const login = await api('/user/login', { email: 'full-payment-staff@qa.invalid', password: 'Synthetic-QA-only-2026!' }); ok(login); staffCookie = login.headers.get('set-cookie').split(';')[0];
});
test.after(() => db.end());
async function fixture({ separate = false, due = '2026-12-01', penalty = 'none', discount = 0 } = {}) {
  const name = 'QA Full ' + randomUUID(), code = 'Q' + randomUUID().slice(0, 5).toUpperCase();
  ok(await api('/projects/lot-projects', { name, location: 'Synthetic Cavite', locationCode: code, cadastralLots: ['QA-1'] }), 201);
  const [[project]] = await db.query('SELECT * FROM lot_projects WHERE lot_project_name=?', [name]);
  ok(await api(`/projects/lot-projects/${project.lot_project_slug}/listings`, { unitNumber: '1', unitCode: code + '-1', installmentPricePerSqm: 10000, cashPricePerSqm: 9500, lotAreaSqm: 100, legalMiscRate: 5, reservationFee: 50000, status: 'available' }), 201);
  const [[listing]] = await db.query('SELECT * FROM lot_project_listings WHERE lot_project_id=?', [project.lot_project_id]);
  const [profile] = await db.query(`INSERT INTO lot_project_client_profiles(lot_project_id,lot_project_listing_id,buyer_full_name,soa_reservation_fee,soa_starting_date,soa_first_due_date,soa_downpayment_percentage,soa_downpayment_terms,soa_monthly_terms,soa_penalty_calculation_method,soa_penalty_rate_percent,soa_annual_interest_rate,soa_interest_rate_overridden,soa_legal_misc_fee_mode,soa_selected_lmf_amount,soa_selected_tcp) VALUES(?,?,'Synthetic QA Full Buyer',50000,'2026-07-01','2026-07-01',20,1,24,?,0.05,11.5,1,?,50000,1050000)`, [project.lot_project_id, listing.lot_project_listing_id, penalty, separate ? 'separate_soa_row' : 'include_in_monthly']);
  const [account] = await db.query("INSERT INTO lot_project_accounts(account_reference,lot_project_id,lot_project_listing_id,lot_project_client_profile_id,unit_id_snapshot) VALUES(?,?,?,?,'QA-FULL')", ['QA-' + randomUUID(), project.lot_project_id, listing.lot_project_listing_id, profile.insertId]);
  await db.query("UPDATE lot_project_listings SET current_account_id=?,lot_project_listing_status='sold' WHERE lot_project_listing_id=?", [account.insertId, listing.lot_project_listing_id]);
  if (discount) await db.query('UPDATE lot_project_client_profiles SET soa_dp_discount_percentage=? WHERE lot_project_client_profile_id=?', [discount, profile.insertId]);
  const path = `/projects/lot-projects/${project.lot_project_slug}/listings/${listing.lot_project_listing_id}`;
  ok(await api(path + '/soa-terms', { firstDueDate: due }, 'PUT'));
  return { path, accountId: account.insertId, profileId: profile.insertId, listingId: listing.lot_project_listing_id };
}
async function rows(f) { return (await db.query('SELECT * FROM lot_project_payment_schedules WHERE lot_project_account_id=? ORDER BY due_date,lot_project_payment_schedule_id', [f.accountId]))[0]; }
async function preview(f, extra = {}) { return ok(await api(f.path + '/payments/preview', { paymentType: 'Full Payment', paymentDate: '2026-11-18', ...extra })); }
async function post(f, amount, extra = {}, auth = cookie) { return api(f.path + '/payments', { paymentType: 'Full Payment', paymentDate: '2026-11-18', method: 'Cash', amount, requestKey: randomUUID(), ...extra }, 'POST', auth); }
test('principal-only payoff posts cash and an interest adjustment; replay, edit preview and void restore it', async () => {
  const f = await fixture(), before = await rows(f), p = await preview(f);
  assert.ok(p.fullSummary.excludedFutureInterest > 0); assert.equal(p.fullSummary.reviewRequired, false); assert.equal(p.fullPaymentAmount, 1050000);
  const key = randomUUID(); const payment = ok(await post(f, p.fullPaymentAmount, { requestKey: key }, headCookie), 201);
  const after = await rows(f); assert.ok(after.every(r => r.schedule_status === 'Paid'));
  assert.equal(after.reduce((n, r) => n + Math.round(Number(r.amount_paid) * 100), 0), Math.round(p.fullPaymentAmount * 100));
  assert.equal(after.reduce((n, r) => n + Number(r.interest_amount), 0), 0);
  const profile = ok(await api(f.path)).data;
  assert.equal(profile.financialSnapshot.receivable.remainingLotPrincipal, 0);
  assert.equal(profile.financialSnapshot.receivable.totalAccountOutstanding, 0);
  assert.equal(profile.payments.find(r => r.paymentId === payment.payment_id).settlement.totalPayable, p.fullPaymentAmount);
  const [[saved]] = await db.query('SELECT lot_project_payment_settlement_json AS settlement FROM lot_project_payments WHERE lot_project_payment_id=?', [payment.payment_id]);
  assert.equal(saved.settlement.excludedFutureInterest, p.fullSummary.excludedFutureInterest);
  ok(await post(f, p.fullPaymentAmount, { requestKey: key }, headCookie));
  const edit = await preview(f, { excludePaymentId: payment.payment_id }); assert.equal(edit.fullPaymentAmount, p.fullPaymentAmount); assert.equal(edit.fullSummary.excludedFutureInterest, p.fullSummary.excludedFutureInterest);
  assert.deepEqual(await rows(f), after, 'Preview must roll back every simulated change');
  ok(await api(f.path + `/payments/${payment.payment_id}`, { paymentType: 'Full Payment', paymentDate: '2026-11-17', method: 'Cash', amount: p.fullPaymentAmount, reason: 'Synthetic authorized settlement date correction' }, 'PUT', headCookie));
  assert.equal((await preview(f)).fullPaymentAmount, 0);
  ok(await api(f.path + `/payments/${payment.payment_id}/delete`, { reason: 'Synthetic authorized settlement reversal' }, 'POST', headCookie));
  const restored = await rows(f); assert.deepEqual(restored.map(r => [r.due_amount, r.interest_amount, r.principal_amount]), before.map(r => [r.due_amount, r.interest_amount, r.principal_amount]));
  assert.equal((await preview(f)).fullPaymentAmount, p.fullPaymentAmount);
});
test('separate LMF enters once and invalid amounts leave no receipt or adjustments', async () => {
  const f = await fixture({ separate: true }), p = await preview(f), before = await rows(f);
  assert.equal(p.fullSummary.principalOutstanding, 1000000); assert.equal(p.fullSummary.separateLmfOutstanding, 50000); assert.equal(p.fullPaymentAmount, 1050000);
  ok(await post(f, p.fullPaymentAmount + p.fullSummary.excludedFutureInterest), 409);
  assert.deepEqual(await rows(f), before);
  ok(await post(f, p.fullPaymentAmount), 201);
  assert.ok((await rows(f)).every(r => r.schedule_status === 'Paid'));
});
test('due interest and penalties block until reviewed, then collectible charges are included', async () => {
  const f = await fixture({ due: '2026-08-01', penalty: 'daily' }), p = await preview(f);
  assert.ok(p.fullSummary.interestOutstanding > 0); assert.ok(p.fullSummary.penaltyOutstanding > 0); assert.equal(p.fullSummary.reviewRequired, true);
  ok(await post(f, p.fullPaymentAmount), 409);
  const settlementReview = { interest: 'collectible', penalties: 'collectible', reason: 'Synthetic approved account charge rules' };
  const reviewed = await preview(f, { settlementReview }); assert.equal(reviewed.fullSummary.reviewRequired, false);
  assert.equal(reviewed.fullPaymentAmount, Math.round((reviewed.fullSummary.principalOutstanding + reviewed.fullSummary.interestOutstanding + reviewed.fullSummary.penaltyOutstanding) * 100) / 100);
  ok(await post(f, reviewed.fullPaymentAmount, { settlementReview }, headCookie), 201);
  assert.ok((await rows(f)).every(r => r.schedule_status === 'Paid'));
});
test('reviewed noncollectible due charges become adjustments and cannot resurrect after a read', async () => {
  const f = await fixture({ due: '2026-08-01', penalty: 'daily' });
  const settlementReview = { interest: 'not_collectible', penalties: 'not_collectible', reason: 'Synthetic Accounting decision: charges are not payable' };
  const p = await preview(f, { settlementReview });
  ok(await post(f, p.fullPaymentAmount, { settlementReview }, headCookie), 201);
  assert.equal((await preview(f)).fullPaymentAmount, 0);
  const after = await rows(f); assert.ok(after.every(r => r.schedule_status === 'Paid')); assert.equal(after.reduce((n, r) => n + Number(r.penalty_amount), 0), 0);
});
test('Full Payment equals balloon principal after reservation and downpayment are paid', async () => {
  const f = await fixture();
  for (const r of (await rows(f)).filter(r => !/monthly/i.test(r.description))) {
    ok(await post(f, Number(r.due_amount), { paymentType: /reservation/i.test(r.description) ? 'Reservation' : 'Downpayment', soaRowId: r.lot_project_payment_schedule_id }, headCookie), 201);
  }
  const full = await preview(f), balloon = await preview(f, { paymentType: 'Balloon' });
  assert.equal(full.fullPaymentAmount, balloon.balloonPrincipalCapacity);
  const paid = ok(await post(f, full.fullPaymentAmount, { paymentType: 'Balloon' }, headCookie), 201);
  assert.equal((await preview(f)).fullPaymentAmount, 0);
  ok(await api(f.path + `/payments/${paid.payment_id}/delete`, { reason: 'Synthetic full balloon reversal' }, 'POST', headCookie));
  assert.equal((await preview(f)).fullPaymentAmount, full.fullPaymentAmount);
});
test('parallel identical requests save one settlement and a changed charge review cannot reuse its key', async () => {
  const f = await fixture(), p = await preview(f), requestKey = randomUUID();
  const results = await Promise.all([post(f, p.fullPaymentAmount, { requestKey }), post(f, p.fullPaymentAmount, { requestKey })]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
  assert.equal(results[0].data.payment_id, results[1].data.payment_id);
  ok(await post(f, p.fullPaymentAmount, { requestKey, settlementReview: { interest: 'collectible', reason: 'Changed after posting' } }), 409);
});
test('a backdated settlement before an existing verified receipt is flagged for chronology review', async () => {
  const f = await fixture(), reservation = (await rows(f)).find(r => /reservation/i.test(r.description));
  ok(await post(f, Number(reservation.due_amount), { paymentType: 'Reservation', soaRowId: reservation.lot_project_payment_schedule_id }, headCookie), 201);
  const p = await preview(f, { paymentDate: '2026-11-17' });
  assert.equal(p.fullSummary.reviewRequired, true); assert.match(p.fullSummary.reviewReasons.join(' '), /chronology/);
  ok(await post(f, p.fullPaymentAmount, { paymentDate: '2026-11-17' }), 409);
});
test('staff charge decisions need Head approval for the exact quote before cash can post', async () => {
  const f = await fixture({ due: '2026-08-01', penalty: 'daily' });
  const settlementReview = { interest: 'collectible', penalties: 'not_collectible', reason: 'Synthetic approved contract charge treatment' };
  const p = await preview(f, { settlementReview }), requestKey = randomUUID(), before = await rows(f);
  const pending = ok(await post(f, p.fullPaymentAmount, { settlementReview, requestKey }, staffCookie), 202);
  assert.equal(pending.approval_required, true);
  const [[count]] = await db.query('SELECT COUNT(*) AS n FROM lot_project_payments WHERE lot_project_account_id=?', [f.accountId]); assert.equal(count.n, 0);
  assert.deepEqual(await rows(f), before);
  ok(await api(`/workflow/protected-changes/${pending.approval_request_id}/review`, { decision: 'approve', note: 'Synthetic reviewed account basis and amounts' }, 'POST', headCookie));
  const paid = ok(await post(f, p.fullPaymentAmount, { settlementReview, requestKey }, staffCookie), 201);
  const [[saved]] = await db.query('SELECT lot_project_payment_settlement_json AS settlement FROM lot_project_payments WHERE lot_project_payment_id=?', [paid.payment_id]);
  assert.equal(saved.settlement.authorization.type, 'head_approval');
  assert.equal((await preview(f)).fullPaymentAmount, 0);
});
test('partial future interest already collected stays cash while only its unpaid portion is adjusted', async () => {
  const f = await fixture(), before = await preview(f), monthly = (await rows(f)).find(r => /monthly/i.test(r.description));
  ok(await post(f, 1000, { paymentType: 'Monthly Amortization', soaRowId: monthly.lot_project_payment_schedule_id }, headCookie), 201);
  const p = await preview(f); assert.equal(p.fullPaymentAmount, before.fullPaymentAmount); assert.equal(p.fullSummary.excludedFutureInterest, before.fullSummary.excludedFutureInterest - 1000);
  const paid = ok(await post(f, p.fullPaymentAmount, {}, headCookie), 201);
  const settled = await rows(f); assert.equal(settled.reduce((n, r) => n + Math.round(Number(r.paid_interest_amount) * 100), 0), 100000);
  const edit = await preview(f, { excludePaymentId: paid.payment_id }); assert.equal(edit.fullPaymentAmount, p.fullPaymentAmount); assert.equal(edit.fullSummary.excludedFutureInterest, p.fullSummary.excludedFutureInterest);
});
test('ordinary corrections before a settled account preserve historical Full Payments that collected scheduled interest', async () => {
  const f = await fixture(), reservation = (await rows(f)).find(r => /reservation/i.test(r.description));
  const first = ok(await post(f, Number(reservation.due_amount), { paymentType: 'Reservation', soaRowId: reservation.lot_project_payment_schedule_id }, headCookie), 201);
  const pending = (await rows(f)).filter(r => r.schedule_status !== 'Paid');
  const gross = pending.reduce((n, r) => n + Math.round(Number(r.due_amount) * 100), 0) / 100;
  const [[account]] = await db.query('SELECT * FROM lot_project_accounts WHERE lot_project_account_id=?', [f.accountId]);
  const [legacy] = await db.query("INSERT INTO lot_project_payments(lot_project_id,lot_project_listing_id,lot_project_client_profile_id,lot_project_account_id,lot_project_payment_type,lot_project_payment_amount,lot_project_payment_date,lot_project_payment_method,lot_project_payment_status) VALUES(?,?,?,?,'full_payment',?,'2026-11-18','Cash','Verified')", [account.lot_project_id, f.listingId, f.profileId, f.accountId, gross]);
  for (const row of pending) {
    await db.query('INSERT INTO lot_project_payment_allocations(lot_project_payment_id,lot_project_payment_schedule_id,applied_amount) VALUES(?,?,?)', [legacy.insertId, row.lot_project_payment_schedule_id, row.due_amount]);
    await db.query("UPDATE lot_project_payment_schedules SET amount_paid=due_amount,schedule_status='Paid' WHERE lot_project_payment_schedule_id=?", [row.lot_project_payment_schedule_id]);
  }
  ok(await api(f.path + `/payments/${first.payment_id}`, { amount: Number(reservation.due_amount), paymentType: 'Reservation', soaRowId: reservation.lot_project_payment_schedule_id, paymentDate: '2026-11-18', method: 'Bank Transfer', bankName: 'Synthetic Bank', accountNumber: 'QA0000', referenceId: 'QA-' + randomUUID(), reason: 'Synthetic reference correction with historical settlement' }, 'PUT', headCookie));
  const after = await rows(f); assert.ok(after.every(r => r.schedule_status === 'Paid')); assert.ok(after.some(r => Number(r.interest_amount) > 0));
  const [[saved]] = await db.query('SELECT lot_project_payment_amount,lot_project_payment_settlement_json FROM lot_project_payments WHERE lot_project_payment_id=?', [legacy.insertId]);
  assert.equal(Number(saved.lot_project_payment_amount), gross); assert.equal(saved.lot_project_payment_settlement_json, null);
});
test('a partial balloon and its shortened schedule feed the same principal-only Full Payment', async () => {
  const f = await fixture(), original = await preview(f);
  ok(await post(f, 100000, { paymentType: 'Balloon' }, headCookie), 201);
  const p = await preview(f); assert.equal(p.fullPaymentAmount, original.fullPaymentAmount - 100000); assert.ok(p.fullSummary.excludedFutureInterest < original.fullSummary.excludedFutureInterest);
  ok(await post(f, p.fullPaymentAmount, {}, headCookie), 201);
  const profile = ok(await api(f.path)).data;
  assert.equal(profile.financialSnapshot.receivable.remainingLotPrincipal, 0); assert.equal(profile.financialSnapshot.receivable.totalAccountOutstanding, 0);
});
test('a downpayment discount reduces cash payoff and remains a principal credit after settlement', async () => {
  const f = await fixture({ discount: 5 }), p = await preview(f);
  assert.equal(p.fullPaymentAmount, 1039500);
  ok(await post(f, p.fullPaymentAmount, {}, headCookie), 201);
  const profile = ok(await api(f.path)).data;
  assert.equal(profile.financialSnapshot.receivable.remainingLotPrincipal, 0); assert.equal(profile.financialSnapshot.receivable.totalAccountOutstanding, 0);
  assert.equal(profile.financialSnapshot.receivable.verifiedCollections, 1039500);
});
