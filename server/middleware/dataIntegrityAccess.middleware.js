import crypto from 'node:crypto';

export const DATA_INTEGRITY_ACCESS_COOKIE = 'data_integrity_access';
const DEFAULT_SESSION_MINUTES = 30;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const failedAttempts = new Map();
const isProduction = process.env.NODE_ENV === 'production';
const clean = (value) => String(value ?? '').trim();

const getSessionMinutes = () => {
  const parsed = Number(process.env.DATA_INTEGRITY_PIN_SESSION_MINUTES || DEFAULT_SESSION_MINUTES);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_MINUTES;
  return Math.min(Math.max(parsed, 5), 240);
};

const getSigningSecret = () => clean(process.env.DATA_INTEGRITY_PIN_SECRET || process.env.JWT_SECRET);

export const getDataIntegrityAccessCookieOptions = ({ includeMaxAge = true } = {}) => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/data-integrity',
  };

  if (includeMaxAge) {
    options.maxAge = getSessionMinutes() * 60 * 1000;
  }

  return options;
};

export const clearDataIntegrityAccessCookie = (res) => {
  res.clearCookie(
    DATA_INTEGRITY_ACCESS_COOKIE,
    getDataIntegrityAccessCookieOptions({ includeMaxAge: false })
  );
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const isDataIntegrityPinConfigured = () => Boolean(clean(process.env.DATA_INTEGRITY_PINCODE));

export const dataIntegrityPinMatches = (pin) => {
  const configuredPin = clean(process.env.DATA_INTEGRITY_PINCODE);
  const submittedPin = clean(pin);
  if (!configuredPin || !submittedPin) return false;
  return safeEqual(submittedPin, configuredPin);
};

const signPayload = (encodedPayload) => {
  const secret = getSigningSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
};

export const createDataIntegrityAccessToken = ({ userId } = {}) => {
  const secret = getSigningSecret();
  if (!secret) {
    const error = new Error('Data Integrity PIN signing is not configured. Set DATA_INTEGRITY_PIN_SECRET or JWT_SECRET.');
    error.statusCode = 503;
    error.code = 'DATA_INTEGRITY_PIN_NOT_CONFIGURED';
    throw error;
  }

  const now = Date.now();
  const payload = {
    type: 'data_integrity_access',
    userId: Number(userId || 0),
    issuedAt: now,
    expiresAt: now + (getSessionMinutes() * 60 * 1000),
    nonce: crypto.randomBytes(18).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encodedPayload);

  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
    sessionMinutes: getSessionMinutes(),
  };
};

export const verifyDataIntegrityAccessToken = (token, { userId } = {}) => {
  try {
    const [encodedPayload, providedSignature] = String(token || '').split('.');
    if (!encodedPayload || !providedSignature) return null;

    const expectedSignature = signPayload(encodedPayload);
    if (!expectedSignature || !safeEqual(providedSignature, expectedSignature)) return null;

    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload?.type !== 'data_integrity_access') return null;
    if (!Number.isFinite(Number(payload.expiresAt)) || Number(payload.expiresAt) <= Date.now()) return null;
    if (!Number(payload.userId) || Number(payload.userId) !== Number(userId || 0)) return null;
    return payload;
  } catch {
    return null;
  }
};

const getClientKey = (req) => `${Number(req.authUser?.id || 0)}:${clean(req.ip || req.socket?.remoteAddress || 'unknown')}`;

export const getDataIntegrityPinAttemptState = (req) => {
  const key = getClientKey(req);
  const current = failedAttempts.get(key);
  if (!current) return { key, locked: false, remainingMs: 0, attempts: 0 };

  const now = Date.now();
  if (current.lockedUntil && current.lockedUntil > now) {
    return { key, locked: true, remainingMs: current.lockedUntil - now, attempts: current.attempts || 0 };
  }

  if (
    (current.lockedUntil && current.lockedUntil <= now)
    || (current.lastAttemptAt && now - current.lastAttemptAt >= LOCKOUT_MS)
  ) {
    failedAttempts.delete(key);
    return { key, locked: false, remainingMs: 0, attempts: 0 };
  }

  return { key, locked: false, remainingMs: 0, attempts: current.attempts || 0 };
};

export const recordDataIntegrityPinFailure = (req) => {
  const state = getDataIntegrityPinAttemptState(req);
  const attempts = state.attempts + 1;
  const lockedUntil = attempts >= MAX_FAILED_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0;
  failedAttempts.set(state.key, { attempts, lockedUntil, lastAttemptAt: Date.now() });

  return {
    attempts,
    locked: Boolean(lockedUntil),
    remainingAttempts: Math.max(MAX_FAILED_ATTEMPTS - attempts, 0),
    lockedUntil,
  };
};

export const clearDataIntegrityPinFailures = (req) => {
  failedAttempts.delete(getClientKey(req));
};

export const getDataIntegrityAccessSession = (req) => {
  const token = req.cookies?.[DATA_INTEGRITY_ACCESS_COOKIE];
  return verifyDataIntegrityAccessToken(token, { userId: req.authUser?.id });
};

export const requireDataIntegrityPin = (req, res, next) => {
  const session = getDataIntegrityAccessSession(req);
  if (!session) {
    clearDataIntegrityAccessCookie(res);
    return res.status(401).json({
      success: false,
      code: 'DATA_INTEGRITY_PIN_REQUIRED',
      message: 'Enter the Data Integrity PIN to open this page.',
    });
  }

  req.dataIntegrityAccess = session;
  return next();
};
