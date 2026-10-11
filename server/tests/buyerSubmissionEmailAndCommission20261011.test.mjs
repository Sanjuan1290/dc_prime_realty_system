import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildBuyerSubmissionNotice,
  getReservationNotificationRecipient,
  sendBuyerFormSubmissionNotice,
} from '../controllers/Lot_Projects/BuyerForms/buyerFormSubmissionNotice.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('Reservation contact per project overrides global contact', async () => {
  const calls = [];
  const db = { query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('lot_project_settings')) return [[{ reservation_contact_email: ' project@dcprime.test ' }]];
    return [[{ reservation_contact_email: 'global@dcprime.test' }]];
  } };
  assert.equal(await getReservationNotificationRecipient(db, 9), 'project@dcprime.test');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].params, [9]);
});

test('Global Reservation Contact Email used if project contact not set', async () => {
  const db = { query: async (sql) => [sql.includes('lot_project_settings')
    ? [{ reservation_contact_email: '  ' }]
    : [{ reservation_contact_email: 'fallback@dcprime.test' }]] };
  assert.equal(await getReservationNotificationRecipient(db, 10), 'fallback@dcprime.test');
});

test('No configured contact does not send to an invented address', async () => {
  const db = { query: async () => [[]] };
  assert.equal(await getReservationNotificationRecipient(db, 10), null);
});

test('Email template escapes externally supplied labels and omits sensitive profile information', () => {
  const message = buildBuyerSubmissionNotice({ projectName: '<Bad & Co>', unitId: 'LA-1805', buyerName: '<img src=x>' });
  assert.match(message.subject, /LA-1805/);
  assert.match(message.text, /temporary hold/i);
  assert.match(message.html, /&lt;Bad &amp; Co&gt;/);
  assert.match(message.html, /&lt;img src=x&gt;/);
  assert.doesNotMatch(message.html, /<img src=x>/);
  assert.doesNotMatch(message.html, /full buyer profile|government ID/i);
});

test('Successful submission calls contact notice only after transaction commit', () => {
  const s = source('server/controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js');
  const submission = s.slice(s.indexOf('export const submitPublicBuyerForm'));
  assert.ok(submission.indexOf('await connection.commit()') < submission.indexOf('await sendBuyerFormSubmissionNotice'));
  assert.match(submission, /catch \(notificationError\)/);
  assert.match(submission, /return res.status\(201\)/);
  assert.match(submission, /lot_project_listing_status = 'hold'/);
  assert.match(submission, /privacyConsent !== true/);
  // Review routing is intentionally untouched.
  assert.match(s, /actionKey: 'buyer_form.approve'/);
  assert.doesNotMatch(s, /getReservationReviewRouting/);
});

test('Successful Resend delivery is addressed only to the configured contact with an idempotency key', async () => {
  const savedEnv = { RESEND_API_KEY: process.env.RESEND_API_KEY, EMAIL_FROM: process.env.EMAIL_FROM };
  const savedFetch = globalThis.fetch;
  let request;
  try {
    process.env.RESEND_API_KEY = 'test-key';
    process.env.EMAIL_FROM = 'D&C Prime Realty <verified@example.com>';
    globalThis.fetch = async (url, opts) => {
      request = { url, opts };
      return { ok: true, json: async () => ({ id: 'test-resend-id' }) };
    };
    const connection = { query: async (sql) => [[{ reservation_contact_email: 'reservations@dcprime.test' }]] };
    assert.deepEqual(await sendBuyerFormSubmissionNotice({
      connection, projectId: 7, submissionId: 123, projectName: 'Bailen Project',
      unitId: 'LA-1805', buyerName: 'Client Example',
    }), { sent: true });
    const payload = JSON.parse(request.opts.body);
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.deepEqual(payload.to, ['reservations@dcprime.test']);
    assert.match(payload.subject, /LA-1805/);
    assert.match(payload.html, /Bailen Project/);
    assert.equal(request.opts.headers['Idempotency-Key'], 'dcprime-buyer-submission-123');
  } finally {
    globalThis.fetch = savedFetch;
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key]; else process.env[key] = val;
    }
  }
});

test('Company Profit percentage and estimate use existing API keys', () => {
  const s = source('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservationPreviewPanels.jsx');
  assert.match(s, /label="Company Profit \(%\)" value=\{`\$\{Number\(preview\?\.companyProfitRate/);
  assert.match(s, /label="Estimated Company Profit" value=\{money\(preview\?\.estimatedCompanyProfit\)\}/);
  assert.doesNotMatch(s, /companyProfitRate \* 100/);
});
