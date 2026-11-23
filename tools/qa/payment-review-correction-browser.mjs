// Exercise the actual payment and review components with synthetic data only.
import { chromium } from 'playwright-core';
import { createServer } from '../../CLIENT/SYSTEM/node_modules/vite/dist/node/index.js';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('../../', import.meta.url));
const runtime = resolve(root, 'QA_REPORTS/.runtime/payment-review-correction');
const output = resolve(root, 'QA_REPORTS/evidence/payment-review-correction');
mkdirSync(runtime, { recursive: true });
mkdirSync(output, { recursive: true });
const file = path => resolve(root, path).replaceAll('\\', '/');
const entry = resolve(runtime, 'harness.jsx');
writeFileSync(entry, `
import React from 'react';
import { createRoot } from 'react-dom/client';
import AddSOAPaymentModal from ${JSON.stringify(file('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx'))};
import ReviewFormComparison from ${JSON.stringify(file('CLIENT/SYSTEM/src/components/Shared/ReviewFormComparison.jsx'))};
const params = new URLSearchParams(location.search);
const scenario = params.get('scenario') || 'edit';
const rows = [{ id: 90029, description: 'Downpayment', dueDate: '2026-11-22', dueAmount: 175500, totalDue: 175587.75, amountPaid: 0, penalty: 87.75, status: 'Overdue' }];
const initialPayment = { paymentId: 120002, soaRowId: 90029, paymentType: 'Downpayment', amount: scenario === 'partial' ? 50000 : 175587.75, paymentDate: '2026-11-23', method: 'Cash', referenceId: 'SYNTHETIC-QA-PAYMENT' };
window.savedPayments = [];
window.previewCalls = [];
const onPreview = async input => {
  window.previewCalls.push(input);
  if (scenario === 'slow') await new Promise(resolve => setTimeout(resolve, 500));
  const penalty = input.paymentDate === '2026-11-22' ? 0 : 87.75;
  return { paymentDate: input.paymentDate, selectedRow: { principalOutstanding: 175500, interestOutstanding: 0, penaltyOutstanding: penalty, penaltyDays: penalty ? 1 : 0, totalPayable: 175500 + penalty } };
};
const before = { scheduleId: 90028, scheduleDescription: 'Reservation Fee', scheduleDueDate: '2026-11-22', amount: 50000 };
const after = { scheduleId: 90029, scheduleDescription: 'Downpayment', scheduleDueDate: '2026-11-23', amount: 175587.75 };
createRoot(document.getElementById('root')).render(scenario.startsWith('review')
  ? <ReviewFormComparison entityType="lot_project_payment" beforeValue={scenario === 'review-legacy' ? { scheduleId: 90028 } : scenario === 'review-create' ? null : before} afterValue={after} lookups={{ schedule: { 90028: 'Live description must not replace history' } }} />
  : <AddSOAPaymentModal listing={{ unitCode: 'QA-0401', buyerName: 'Synthetic QA Buyer', projectName: 'QA Project' }} rows={rows} initialPayment={scenario === 'add' ? null : initialPayment} mode={scenario === 'add' ? 'add' : 'edit'} canWaivePenalty={scenario !== 'unauthorized'} onPreview={onPreview} onClose={() => {}} onSave={async value => window.savedPayments.push(value)} />);
`);
const css = readdirSync(resolve(root, 'CLIENT/SYSTEM/dist/assets')).find(name => name.startsWith('index-') && name.endsWith('.css'));
const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/@fs/${file('CLIENT/SYSTEM/dist/assets/' + css)}"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${entry.replaceAll('\\', '/')}"></script></body></html>`;
const server = await createServer({
  configFile: false, envDir: false, root: resolve(root, 'CLIENT/SYSTEM'),
  resolve: { dedupe: ['react', 'react-dom'] }, css: { postcss: { plugins: [] } },
  plugins: [{ name: 'payment-review-correction-harness', configureServer(dev) {
    dev.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0] !== '/') return next();
      res.setHeader('Content-Type', 'text/html'); res.end(html);
    });
  } }],
  server: { host: '127.0.0.1', port: 4189, strictPort: true, fs: { allow: [root] } },
});
await server.listen();
let browser;
const checks = [], errors = [], externalRequests = [];
try {
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.route('**/*', route => {
    if (new URL(route.request().url()).hostname === '127.0.0.1') return route.continue();
    externalRequests.push(route.request().url()); return route.abort();
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  await page.clock.setFixedTime(new Date('2026-11-23T04:00:00Z'));
  page.on('pageerror', error => errors.push(error.message));
  const amount = () => page.getByLabel(/^Amount/);
  const waive = () => page.getByRole('radio', { name: /Waive penalty for this payment/ });
  const apply = () => page.getByRole('radio', { name: /Apply calculated penalty/ });
  const save = () => page.getByRole('button', { name: 'Save Changes', exact: true });
  async function idle() {
    await page.waitForFunction(() => window.previewCalls.length > 0 && !document.body.textContent.includes('Calculating the amount as of'));
  }
  async function open(scenario = 'edit') {
    await page.goto('http://127.0.0.1:4189/?scenario=' + scenario);
    await page.getByRole('heading', { name: scenario === 'add' ? 'Add Payment' : 'Edit Payment', exact: true }).waitFor();
    await idle();
  }
  async function expectAmount(value) {
    await page.waitForFunction(value => document.querySelector('input[type="number"]')?.value === value, value);
    await idle(); assert.equal(await amount().inputValue(), value);
  }
  async function check(name, action) {
    try { await action(); checks.push({ name, status: 'PASS' }); }
    catch (error) {
      checks.push({ name, status: 'FAIL', reason: error.stack });
      await page.screenshot({ path: resolve(output, 'failure-' + checks.length + '.png') }).catch(() => {});
    }
    console.log(JSON.stringify(checks.at(-1)));
  }

  await check('Edit keeps the recorded amount on open and excludes that payment from preview', async () => {
    await open(); assert.equal(await amount().inputValue(), '175587.75');
    assert.equal(await page.getByText('Payment amount changed from the recorded amount', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.previewCalls[0].excludePaymentId), 120002);
    await open('partial'); assert.equal(await amount().inputValue(), '50000');
    await page.getByLabel(/^Payment Date/).fill('2026-11-22'); await idle();
    assert.equal(await amount().inputValue(), '50000');
  });
  await check('Waiving removes exactly 87.75 and applying restores it without repeated subtraction', async () => {
    await open();
    for (let i = 0; i < 2; i++) {
      await waive().check(); await expectAmount('175500.00');
      await apply().check(); await expectAmount('175587.75');
    }
    await waive().check(); await expectAmount('175500.00');
    await page.screenshot({ path: resolve(output, 'waived-edit-payment.png') });
  });
  await check('Corrected payload requires the waiver reason and retains date and identity', async () => {
    await open(); await waive().check(); await expectAmount('175500.00');
    assert.equal(await page.getByRole('checkbox', { name: /I verified that the entered amount is intentional/ }).count(), 0);
    await save().click(); await page.getByRole('alert').getByText(/Reason is required/).waitFor();
    assert.equal(await page.evaluate(() => window.savedPayments.length), 0);
    await page.getByLabel('Waiver Reason *', { exact: true }).fill('Approved synthetic waiver');
    await save().click(); await page.waitForFunction(() => window.savedPayments.length === 1);
    const saved = await page.evaluate(() => window.savedPayments[0]);
    assert.equal(saved.amount, 175500); assert.equal(saved.penaltyHandling, 'waive');
    assert.equal(saved.penaltyPreviewAmount, 87.75); assert.equal(saved.penaltyWaiverReason, 'Approved synthetic waiver');
    assert.equal(saved.paymentDate, '2026-11-23'); assert.equal(saved.paymentId, 120002); assert.equal(saved.soaRowId, '90029');
  });
  await check('Manual amounts survive penalty choices and still require override acknowledgment', async () => {
    await open(); await amount().fill('100000'); await waive().check(); await idle();
    assert.equal(await amount().inputValue(), '100000');
    await apply().check(); await idle(); assert.equal(await amount().inputValue(), '100000');
    await save().click(); await page.getByRole('alert').getByText(/Confirm the payment amount override/).waitFor();
    assert.equal(await page.evaluate(() => window.savedPayments.length), 0);
  });
  await check('Add Payment continues to recalculate automatically for both penalty choices', async () => {
    await open('add'); await expectAmount('175587.75');
    await waive().check(); await expectAmount('175500.00');
    await apply().check(); await expectAmount('175587.75');
  });
  await check('Rapid penalty toggles and date changes finish with the latest preview amount', async () => {
    await open('slow');
    await waive().check(); await apply().check(); await waive().check(); await expectAmount('175500.00');
    await page.getByLabel(/^Payment Date/).fill('2026-11-22'); await idle(); await expectAmount('175500.00');
    assert.equal(await waive().count(), 0);
    await page.getByLabel(/^Payment Date/).fill('2026-11-23'); await expectAmount('175587.75');
  });
  await check('The waiver choice remains unavailable without waiver permission', async () => {
    await open('unauthorized'); assert.equal(await waive().count(), 0);
    assert.equal(await amount().inputValue(), '175587.75');
  });
  await check('Changed Fields and Full Form show each side’s saved schedule description and date', async () => {
    await page.goto('http://127.0.0.1:4189/?scenario=review');
    await page.getByText('Reservation Fee · Due Nov 22, 2026', { exact: true }).waitFor();
    await page.getByText('Downpayment · Due Nov 23, 2026', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Full Form Comparison' }).click();
    await page.getByText('Reservation Fee · Due Nov 22, 2026', { exact: true }).waitFor();
    await page.getByText('Downpayment · Due Nov 23, 2026', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Schedule ID #/).count(), 0);
    await page.screenshot({ path: resolve(output, 'readable-schedules.png') });
  });
  await check('Legacy and new-record reviews retain truthful missing historical data', async () => {
    await page.goto('http://127.0.0.1:4189/?scenario=review-legacy');
    await page.getByText('Schedule ID #90028', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Full Form Comparison' }).click();
    await page.getByText('Schedule ID #90028', { exact: true }).waitFor();
    await page.getByText('Downpayment · Due Nov 23, 2026', { exact: true }).waitFor();
    assert.equal(await page.getByText('Live description must not replace history', { exact: true }).count(), 0);
    await page.goto('http://127.0.0.1:4189/?scenario=review-create');
    await page.getByRole('button', { name: 'Full Form Comparison' }).click();
    await page.getByText('No previous values were saved with this review', { exact: true }).waitFor();
    await page.getByText('Downpayment · Due Nov 23, 2026', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await page.screenshot({ path: resolve(output, 'review-mobile.png') });
  });
  assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
} finally {
  writeFileSync(resolve(output, 'browser-results.json'), JSON.stringify({ checks, errors, externalRequests }, null, 2));
  await browser?.close(); await server.close();
}
if (checks.some(check => check.status !== 'PASS')) process.exitCode = 1;
