import crypto from 'node:crypto';

export const ATTENDANCE_KIOSK_COOKIE = 'attendance_kiosk_session';
const DEFAULT_SESSION_HOURS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

const failedAttempts = new Map();

const isProduction = process.env.NODE_ENV === 'production';

const clean = (value) => String(value ?? '').trim();

const getSessionHours = () => {
  const parsed = Number(process.env.ATTENDANCE_KIOSK_SESSION_HOURS || DEFAULT_SESSION_HOURS);
  if (!Number.isFinite(parsed)) return DEFAULT_SESSION_HOURS;
  return Math.min(Math.max(parsed, 1), 24);
};

const getSigningSecret = () => clean(process.env.ATTENDANCE_KIOSK_SECRET || process.env.JWT_SECRET);

export const getAttendanceKioskCookieOptions = ({ includeMaxAge = true } = {}) => {
  const options = {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/api/v1/attendance-kiosk',
  };

  if (includeMaxAge) {
    options.maxAge = getSessionHours() * 60 * 60 * 1000;
  }

  return options;
};

export const clearAttendanceKioskCookie = (res) => {
  res.clearCookie(ATTENDANCE_KIOSK_COOKIE, getAttendanceKioskCookieOptions({ includeMaxAge: false }));
};

const safeEqual = (left, right) => {
  const leftBuffer = Buffer.from(String(left || ''), 'utf8');
  const rightBuffer = Buffer.from(String(right || ''), 'utf8');
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

export const isAttendancePinConfigured = () => Boolean(clean(process.env.ATTENDANCE_PINCODE));

export const attendancePinMatches = (pin) => {
  const configuredPin = clean(process.env.ATTENDANCE_PINCODE);
  const submittedPin = clean(pin);
  if (!configuredPin || !submittedPin) return false;
  return safeEqual(submittedPin, configuredPin);
};

const signPayload = (encodedPayload) => {
  const secret = getSigningSecret();
  if (!secret) return '';
  return crypto.createHmac('sha256', secret).update(encodedPayload).digest('base64url');
};

export const createAttendanceKioskToken = () => {
  const secret = getSigningSecret();
  if (!secret) {
    const error = new Error('Attendance kiosk signing is not configured. Set ATTENDANCE_KIOSK_SECRET or JWT_SECRET.');
    error.statusCode = 503;
    error.code = 'ATTENDANCE_KIOSK_NOT_CONFIGURED';
    throw error;
  }

  const now = Date.now();
  const payload = {
    type: 'attendance_kiosk',
    issuedAt: now,
    expiresAt: now + (getSessionHours() * 60 * 60 * 1000),
    nonce: crypto.randomBytes(18).toString('base64url'),
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signPayload(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: payload.expiresAt,
  };
};

export const verifyAttendanceKioskToken = (token) => {
  try {
    const [encodedPayload, providedSignature] = String(token || '').split('.');
    if (!encodedPayload || !providedSignature) return null;
    const expectedSignature = signPayload(encodedPayload);
    if (!expectedSignature || !safeEqual(providedSignature, expectedSignature)) return null;
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));
    if (payload?.type !== 'attendance_kiosk') return null;
    if (!Number.isFinite(Number(payload.expiresAt)) || Number(payload.expiresAt) <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
};

const getClientKey = (req) => clean(req.ip || req.socket?.remoteAddress || 'unknown');

export const getAttendancePinAttemptState = (req) => {
  const key = getClientKey(req);
  const current = failedAttempts.get(key);
  if (!current) return { key, locked: false, remainingMs: 0, attempts: 0 };

  const now = Date.now();
  if (current.lockedUntil && current.lockedUntil > now) {
    return { key, locked: true, remainingMs: current.lockedUntil - now, attempts: current.attempts || 0 };
  }

  // Failed attempts decay after the same 15-minute safety window so an old
  // typo does not count against a future workday.
  if (
    (current.lockedUntil && current.lockedUntil <= now)
    || (current.lastAttemptAt && now - current.lastAttemptAt >= LOCKOUT_MS)
  ) {
    failedAttempts.delete(key);
    return { key, locked: false, remainingMs: 0, attempts: 0 };
  }

  return { key, locked: false, remainingMs: 0, attempts: current.attempts || 0 };
};

export const recordAttendancePinFailure = (req) => {
  const state = getAttendancePinAttemptState(req);
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

export const clearAttendancePinFailures = (req) => {
  failedAttempts.delete(getClientKey(req));
};

export const getAttendanceKioskSession = (req) => {
  const token = req.cookies?.[ATTENDANCE_KIOSK_COOKIE];
  return verifyAttendanceKioskToken(token);
};

export const requireAttendanceKiosk = (req, res, next) => {
  const session = getAttendanceKioskSession(req);
  if (!session) {
    clearAttendanceKioskCookie(res);
    return res.status(401).json({
      success: false,
      code: 'ATTENDANCE_PIN_REQUIRED',
      message: 'Enter the attendance PIN to unlock this station.',
    });
  }

  req.attendanceKiosk = session;
  // Deliberately not a database user. This only gives scanAttendance a safe
  // audit identity while leaving updated_by_user_id NULL for kiosk scans.
  req.authUser = {
    id: null,
    first_name: 'Attendance',
    last_name: 'Kiosk',
    email: null,
    role: 'attendance_kiosk',
  };
  return next();
};
