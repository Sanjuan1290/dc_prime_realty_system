import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('backend email transport is Resend-only with no SMTP or Nodemailer dependency', () => {
  const packageJson = read('server/package.json');
  const packageLock = read('server/package-lock.json');
  const env = read('server/.env.example');
  const emailService = read('server/services/email.service.js');
  const emailControllers = [
    'server/controllers/System/authentication.service.js',
    'server/controllers/System/notifications.controller.js',
    'server/controllers/System/auditLogs.controller.js',
    'server/controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js',
    'server/controllers/Lot_Projects/Accounts/Accounts.controller.js',
  ].map(read).join('\n');

  assert.doesNotMatch(packageJson, /nodemailer/i);
  assert.doesNotMatch(packageLock, /node_modules\/nodemailer/i);
  assert.doesNotMatch(env, /SMTP_(HOST|PORT|SECURE|USER|PASS|FROM)/);
  assert.doesNotMatch(emailControllers, /nodemailer|SMTP_(HOST|PORT|SECURE|USER|PASS|FROM)/i);
  assert.match(emailService, /https:\/\/api\.resend\.com\/emails/);
  assert.match(emailService, /RESEND_API_KEY/);
  assert.match(emailService, /EMAIL_FROM/);
  assert.match(emailService, /'User-Agent': 'dc-prime-realty\/1\.0'/);
});

test('Resend service preserves PDF attachment support by base64 encoding buffers', () => {
  const emailService = read('server/services/email.service.js');
  const notifications = read('server/controllers/System/notifications.controller.js');

  assert.match(emailService, /Buffer\.isBuffer\(rawContent\)/);
  assert.match(emailService, /toString\('base64'\)/);
  assert.match(emailService, /payload\.attachments = attachments\.map\(normalizeAttachment\)/);
  assert.match(notifications, /content:\s*pdfBuffer/);
  assert.match(notifications, /contentType:\s*'application\/pdf'/);
});

test('all email-producing controllers route through the shared Resend service', () => {
  const auth = read('server/controllers/System/authentication.service.js');
  const notifications = read('server/controllers/System/notifications.controller.js');
  const audit = read('server/controllers/System/auditLogs.controller.js');
  const buyerForms = read('server/controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js');
  const accounts = read('server/controllers/Lot_Projects/Accounts/Accounts.controller.js');

  for (const source of [auth, notifications, audit, buyerForms, accounts]) {
    assert.match(source, /email\.service\.js/);
    assert.match(source, /sendEmail/);
  }
});

test('shared Resend service sends through the HTTPS API and base64 encodes Buffer attachments', async () => {
  const originalFetch = global.fetch;
  const originalApiKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;
  let request = null;

  process.env.RESEND_API_KEY = 're_test_key';
  process.env.EMAIL_FROM = 'D&C Prime Realty <noreply@example.com>';
  global.fetch = async (url, options) => {
    request = { url, options };
    return {
      ok: true,
      status: 200,
      json: async () => ({ id: 'email_test_123' }),
    };
  };

  try {
    const { sendEmail } = await import('../services/email.service.js');
    const result = await sendEmail({
      to: 'buyer@example.com',
      subject: 'Test PDF',
      text: 'Attached.',
      html: '<p>Attached.</p>',
      attachments: [{ filename: 'test.pdf', content: Buffer.from('pdf-bytes') }],
    });

    assert.equal(result.id, 'email_test_123');
    assert.equal(request.url, 'https://api.resend.com/emails');
    assert.equal(request.options.headers['User-Agent'], 'dc-prime-realty/1.0');
    const body = JSON.parse(request.options.body);
    assert.deepEqual(body.to, ['buyer@example.com']);
    assert.equal(body.from, 'D&C Prime Realty <noreply@example.com>');
    assert.equal(body.attachments[0].filename, 'test.pdf');
    assert.equal(body.attachments[0].content, Buffer.from('pdf-bytes').toString('base64'));
  } finally {
    global.fetch = originalFetch;
    if (originalApiKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalApiKey;
    if (originalFrom === undefined) delete process.env.EMAIL_FROM;
    else process.env.EMAIL_FROM = originalFrom;
  }
});
