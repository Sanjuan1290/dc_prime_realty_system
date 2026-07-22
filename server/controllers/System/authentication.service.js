import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { getRequestIpAddress } from '../../utils/requestIp.js';

export const LOGIN_SESSION_SECONDS = 12 * 60 * 60;
export const REMEMBERED_SESSION_SECONDS = 30 * 24 * 60 * 60;
export const PASSWORD_RESET_CODE_EXPIRY_MINUTES = 10;
export const PASSWORD_RESET_RESEND_SECONDS = 60;
export const PASSWORD_RESET_MAX_ATTEMPTS = 5;

const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const getPasswordResetSecret = () => {
  const secret = String(
    process.env.PASSWORD_RESET_CODE_SECRET
      || process.env.PASSWORD_RESET_TOKEN_SECRET
      || process.env.JWT_SECRET
      || ''
  ).trim();

  if (!secret) {
    const error = new Error('Password reset security secret is not configured.');
    error.statusCode = 500;
    throw error;
  }

  return secret;
};

export const normalizeLoginRememberMe = (value) => (
  value === true
  || value === 1
  || String(value || '').trim().toLowerCase() === 'true'
  || String(value || '').trim() === '1'
);

export const getLoginSessionConfig = (rememberMeValue) => {
  const rememberMe = normalizeLoginRememberMe(rememberMeValue);
  const expiresInSeconds = rememberMe ? REMEMBERED_SESSION_SECONDS : LOGIN_SESSION_SECONDS;

  return {
    rememberMe,
    expiresInSeconds,
    cookieMaxAge: rememberMe ? expiresInSeconds * 1000 : null,
  };
};

export const normalizeResetEmail = (value) => String(value || '').trim().toLowerCase();

export const isValidResetEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeResetEmail(value));

export const generatePasswordResetCode = () => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

export const hashPasswordResetCode = ({ userId, code, secret = getPasswordResetSecret() }) => (
  crypto
    .createHmac('sha256', secret)
    .update(`${Number(userId)}:${String(code || '').trim()}`)
    .digest('hex')
);

export const passwordResetCodeMatches = ({ userId, code, expectedHash, secret = getPasswordResetSecret() }) => {
  const actual = Buffer.from(hashPasswordResetCode({ userId, code, secret }), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const validatePasswordResetValue = ({ newPassword, confirmPassword }) => {
  const password = String(newPassword || '');
  const confirmation = String(confirmPassword || '');

  if (!password || !confirmation) {
    const error = new Error('New password and confirmation are required.');
    error.statusCode = 400;
    throw error;
  }

  if (password.length < 8) {
    const error = new Error('New password must be at least 8 characters.');
    error.statusCode = 400;
    throw error;
  }

  if (password !== confirmation) {
    const error = new Error('New password and confirmation do not match.');
    error.statusCode = 400;
    throw error;
  }

  if (password.toLowerCase() === 'password') {
    const error = new Error('Do not use the temporary default password.');
    error.statusCode = 400;
    throw error;
  }

  return password;
};

export { getRequestIpAddress };

export const assertPasswordResetEmailConfigured = () => {
  const required = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'];
  const missing = required.filter((key) => !String(process.env[key] || '').trim());

  if (missing.length) {
    const error = new Error(`Password reset email is unavailable. Missing SMTP settings: ${missing.join(', ')}.`);
    error.statusCode = 503;
    throw error;
  }
};

export const buildPasswordResetEmail = ({ name, code }) => {
  const companyName = String(process.env.COMPANY_NAME || 'D&C Prime Realty').trim();
  const safeName = String(name || 'User').trim() || 'User';
  const safeHtmlName = escapeHtml(safeName);
  const safeCode = escapeHtml(code);
  const subject = `${companyName} password reset code`;
  const text = [
    `Hello ${safeName},`,
    '',
    'A password reset was requested for your D&C Prime account.',
    `Verification code: ${code}`,
    `This code expires in ${PASSWORD_RESET_CODE_EXPIRY_MINUTES} minutes.`,
    '',
    'Do not share this code. If you did not request a password reset, you can ignore this email.',
  ].join('\n');
  const html = `
    <div style="margin:0;background:#f8fafc;padding:28px 16px;color:#0f172a;font-family:Arial,Helvetica,sans-serif">
      <div style="max-width:560px;margin:0 auto;border:1px solid #e2e8f0;border-radius:16px;background:#ffffff;overflow:hidden">
        <div style="background:#0f172a;padding:22px 26px;color:#ffffff">
          <div style="font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:#93c5fd">D&amp;C Prime Realty</div>
          <h1 style="margin:8px 0 0;font-size:22px">Password reset code</h1>
        </div>
        <div style="padding:26px">
          <p style="margin:0 0 14px">Hello ${safeHtmlName},</p>
          <p style="margin:0 0 20px;line-height:1.6;color:#475569">Use this verification code to reset your account password.</p>
          <div style="margin:0 0 20px;border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;padding:18px;text-align:center;font-size:30px;font-weight:800;letter-spacing:.22em;color:#1d4ed8">${safeCode}</div>
          <p style="margin:0 0 10px;line-height:1.6;color:#475569">This code expires in ${PASSWORD_RESET_CODE_EXPIRY_MINUTES} minutes.</p>
          <p style="margin:0;line-height:1.6;color:#64748b">Do not share this code. If you did not request a password reset, you can ignore this email.</p>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
};

export const sendPasswordResetCodeEmail = async ({ to, name, code }) => {
  assertPasswordResetEmailConfigured();

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || '').toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  const message = buildPasswordResetEmail({ name, code });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    ...message,
  });
};

export const createPasswordResetToken = ({ userId, resetCodeId, authVersion = 0 }) => (
  jwt.sign(
    {
      purpose: 'password_reset',
      userId: Number(userId),
      resetCodeId: Number(resetCodeId),
      authVersion: Number(authVersion || 0),
    },
    String(process.env.PASSWORD_RESET_TOKEN_SECRET || process.env.JWT_SECRET),
    { expiresIn: `${PASSWORD_RESET_CODE_EXPIRY_MINUTES}m` }
  )
);

export const verifyPasswordResetToken = (token) => {
  const decoded = jwt.verify(
    String(token || ''),
    String(process.env.PASSWORD_RESET_TOKEN_SECRET || process.env.JWT_SECRET)
  );

  if (decoded?.purpose !== 'password_reset' || !decoded?.userId || !decoded?.resetCodeId) {
    const error = new Error('Invalid password reset session.');
    error.statusCode = 400;
    throw error;
  }

  return decoded;
};

export const ensurePasswordResetSchema = async (connection) => {
  const [authVersionColumns] = await connection.query(
    `
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'users'
        AND column_name = 'auth_version'
      LIMIT 1
    `
  );

  if (!authVersionColumns.length) {
    await connection.query(
      `ALTER TABLE users ADD COLUMN auth_version INT UNSIGNED NOT NULL DEFAULT 0 AFTER must_change_password`
    );
  }

  await connection.query(`
    CREATE TABLE IF NOT EXISTS user_password_reset_codes (
      user_password_reset_code_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      code_hash CHAR(64) NOT NULL,
      status ENUM('pending','verified','used','expired','locked') NOT NULL DEFAULT 'pending',
      attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
      max_attempts TINYINT UNSIGNED NOT NULL DEFAULT ${PASSWORD_RESET_MAX_ATTEMPTS},
      expires_at DATETIME NOT NULL,
      verified_at DATETIME NULL,
      used_at DATETIME NULL,
      request_ip VARCHAR(45) NULL,
      user_agent VARCHAR(255) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_password_reset_code_id),
      KEY idx_password_reset_user_created (user_id, created_at),
      KEY idx_password_reset_status_expiry (status, expires_at),
      CONSTRAINT fk_password_reset_code_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  `);
};
