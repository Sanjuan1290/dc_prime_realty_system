import {randomBytes, randomInt, scryptSync, timingSafeEqual, createHash} from 'node:crypto';

export const UNDO_WINDOW_SECONDS = 24 * 60 * 60;
export const UNDO_CODE_TTL_SECONDS = 10 * 60;
export const UNDO_CODE_MAX_ATTEMPTS = 5;
export const UNDO_CODE_SEND_LIMIT = 3;
export const UNDO_CODE_SEND_WINDOW_MINUTES = 15;

function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string' || !value.trim()) return Number.NaN;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? value.replace(' ', 'T') + 'Z'
    : value;
  return Date.parse(normalized);
}

export function isUndoLocked(committedAt, now = Date.now()) {
  const committed = timestamp(committedAt);
  return !Number.isFinite(committed) || Number(now) >= committed + UNDO_WINDOW_SECONDS * 1000;
}

export function undoSecondsRemaining(committedAt, now = Date.now()) {
  const committed = timestamp(committedAt);
  if (!Number.isFinite(committed)) return 0;
  return Math.max(0, Math.ceil((committed + UNDO_WINDOW_SECONDS * 1000 - Number(now)) / 1000));
}

export function maskEmail(value) {
  const email = String(value || '');
  const at = email.lastIndexOf('@');
  if (at < 1) return 'your registered email';
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const visible = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(2, Math.min(8, local.length - visible.length)))}@${domain}`;
}

export function createUndoVerificationCode() {
  return String(randomInt(100000, 1000000));
}

export function hashUndoVerificationCode(code, salt = randomBytes(16).toString('hex')) {
  if (!/^[0-9]{6}$/.test(String(code)) || !/^[a-f0-9]{32}$/.test(String(salt))) {
    throw new TypeError('Invalid undo verification code material.');
  }
  return {salt, hash: scryptSync(String(code), salt, 32).toString('hex')};
}

export function verifyUndoVerificationCode(code, salt, expectedHash) {
  if (!/^[0-9]{6}$/.test(String(code)) || !/^[a-f0-9]{32}$/.test(String(salt || '')) || !/^[a-f0-9]{64}$/.test(String(expectedHash || ''))) return false;
  const candidate = scryptSync(String(code), salt, 32);
  return timingSafeEqual(candidate, Buffer.from(expectedHash, 'hex'));
}

export function hashUndoReviewToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export function validUndoAuthorizationId(value) {
  return /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(String(value || ''));
}
