import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { deliverCommittedSettingsCode } from '../services/settingsVerification.service.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const controller = readFileSync(path.join(root, 'SERVER/SYSTEM/controllers/Lot_Projects/Settings/Settings.controller.js'), 'utf8');
const route = controller.split('export const requestLotProjectSettingsCode = async (req, res) => {')[1]
  ?.split('export const updateLotProjectSettings = async')[0] || '';

test('successful verification mail leaves the committed code active', async () => {
  const calls = [];
  const response = await deliverCommittedSettingsCode({
    deliver: async () => { calls.push('send'); return { id: 'sent' }; },
    invalidate: async () => calls.push('invalidate'),
  });
  assert.deepEqual(calls, ['send']);
  assert.deepEqual(response, { id: 'sent' });
});

test('delivery failure invalidates the challenge and propagates the delivery error', async () => {
  const calls = [];
  const error = Object.assign(new Error('provider unavailable'), { code: 'RESEND_SEND_FAILED' });
  await assert.rejects(deliverCommittedSettingsCode({
    deliver: async () => { calls.push('send'); throw error; },
    invalidate: async () => calls.push('invalidate'),
  }), (observed) => observed === error);
  assert.deepEqual(calls, ['send', 'invalidate']);
});

test('invalidation failure is logged without replacing the provider error', async () => {
  const observed = [];
  const error = new Error('provider timed out');
  await assert.rejects(deliverCommittedSettingsCode({
    deliver: async () => { throw error; },
    invalidate: async () => { throw new Error('database unreachable'); },
    onInvalidationError: (cleanupError) => observed.push(cleanupError.message),
  }), (actual) => actual === error);
  assert.deepEqual(observed, ['database unreachable']);
});

test('request commits and releases the TiDB connection before Resend is contacted', () => {
  const persist = route.indexOf('await createSensitiveActionVerification(connection');
  const commit = route.indexOf('await connection.commit();', persist);
  const release = route.indexOf('connection.release();', commit);
  const delivery = route.indexOf('await deliverCommittedSettingsCode(', release);
  assert.ok(persist >= 0 && commit > persist && release > commit && delivery > release);
  assert.match(route, /transactionOpen = false;\s*connection\.release\(\);\s*connection = null;/);
  assert.match(route, /stage = 'send_verification_email'/);
});

test('failed email expires only its own unused verification and returns a structured error', () => {
  assert.match(route, /WHERE destructive_action_verification_id = \?\s+AND user_id = \? AND action_type = \? AND status = 'pending'/);
  assert.match(route, /\[verificationId, actor\.id, LOT_PROJECT_SETTINGS_ACTION\]/);
  assert.match(route, /statusCode: 503,\s*code: 'SETTINGS_VERIFICATION_DELIVERY_FAILED'/);
  assert.match(route, /if \(transactionOpen && connection\)/);
  assert.match(route, /connection\?\.release\(\)/);
});

test('authorization, payload binding, and password checks remain mandatory', () => {
  assert.match(route, /canEditProjectSettings\(actor\)/);
  assert.match(route, /bcrypt\.compare\(password, actor\.password_hash\)/);
  assert.match(route, /buildProjectSettingsVerificationPayload/);
  assert.match(route, /createSensitiveActionVerification/);
  assert.match(route, /await connection\.commit\(\)/);
  assert.match(controller, /verifyAndConsumeSensitiveAction/);
  assert.match(controller, /PROJECT_COMPANY_EMAIL_REQUIRED_FOR_PAYMENT_NOTIFICATIONS/);
});


