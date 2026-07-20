import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LOGIN_SESSION_SECONDS,
  REMEMBERED_SESSION_SECONDS,
  buildPasswordResetEmail,
  generatePasswordResetCode,
  getLoginSessionConfig,
  hashPasswordResetCode,
  passwordResetCodeMatches,
  validatePasswordResetValue,
} from '../controllers/System/authentication.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const testSecret = 'test-password-reset-secret-that-is-long-enough';

test('Remember Me creates a 30-day persistent cookie while normal login uses a browser session cookie', () => {
  const normal = getLoginSessionConfig(false);
  const remembered = getLoginSessionConfig(true);

  assert.equal(normal.expiresInSeconds, LOGIN_SESSION_SECONDS);
  assert.equal(normal.cookieMaxAge, null);
  assert.equal(remembered.expiresInSeconds, REMEMBERED_SESSION_SECONDS);
  assert.equal(remembered.cookieMaxAge, REMEMBERED_SESSION_SECONDS * 1000);
});

test('password reset codes are six digits and stored as non-reversible hashes', () => {
  const code = generatePasswordResetCode();
  assert.match(code, /^\d{6}$/);

  const codeHash = hashPasswordResetCode({ userId: 7, code, secret: testSecret });
  assert.equal(codeHash.length, 64);
  assert.notEqual(codeHash, code);
  assert.equal(passwordResetCodeMatches({ userId: 7, code, expectedHash: codeHash, secret: testSecret }), true);
  assert.equal(passwordResetCodeMatches({ userId: 7, code: '999999', expectedHash: codeHash, secret: testSecret }), false);
});

test('password reset validation rejects weak and mismatched passwords', () => {
  assert.throws(
    () => validatePasswordResetValue({ newPassword: 'short', confirmPassword: 'short' }),
    /at least 8 characters/i
  );
  assert.throws(
    () => validatePasswordResetValue({ newPassword: 'new-password', confirmPassword: 'different-password' }),
    /do not match/i
  );
  assert.throws(
    () => validatePasswordResetValue({ newPassword: 'password', confirmPassword: 'password' }),
    /temporary default password/i
  );
  assert.equal(
    validatePasswordResetValue({ newPassword: 'SecurePass123', confirmPassword: 'SecurePass123' }),
    'SecurePass123'
  );
});

test('password reset email includes the verification code and expiry guidance', () => {
  const email = buildPasswordResetEmail({ name: 'Test User', code: '123456' });
  assert.match(email.subject, /password reset code/i);
  assert.match(email.text, /123456/);
  assert.match(email.text, /expires in 10 minutes/i);
  assert.match(email.html, /123456/);
});

test('public password reset routes and Login UI are connected', () => {
  const router = read('server/routers/System/users.routers.js');
  const login = read('client/src/auth/Login.jsx');
  const modal = read('client/src/auth/ForgotPasswordModal.jsx');

  assert.match(router, /forgot-password\/request/);
  assert.match(router, /forgot-password\/verify/);
  assert.match(router, /forgot-password\/reset/);
  assert.match(login, /rememberMe/);
  assert.match(login, /Remember me for 30 days/);
  assert.match(login, /ForgotPasswordModal/);
  assert.match(modal, /6-digit verification code/);
  assert.match(modal, /resetToken/);
});

test('migration creates reset-code storage and auth versioning', () => {
  const migration = read('server/migrations/20260720_login_remember_me_and_password_reset.sql');
  const controller = read('server/controllers/System/users.controllers.js');
  const sharedAuth = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');

  assert.match(migration, /ADD COLUMN auth_version/i);
  assert.match(migration, /CREATE TABLE IF NOT EXISTS user_password_reset_codes/i);
  assert.match(migration, /attempt_count/i);
  assert.match(migration, /expires_at/i);
  assert.match(controller, /auth_version = COALESCE\(auth_version, 0\) \+ 1/i);
  assert.match(sharedAuth, /decoded\.authVersion/);
});

