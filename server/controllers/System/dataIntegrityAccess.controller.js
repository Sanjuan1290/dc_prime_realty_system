import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import {
  DATA_INTEGRITY_ACCESS_COOKIE,
  clearDataIntegrityAccessCookie,
  clearDataIntegrityPinFailures,
  createDataIntegrityAccessToken,
  dataIntegrityPinMatches,
  getDataIntegrityAccessCookieOptions,
  getDataIntegrityAccessSession,
  getDataIntegrityPinAttemptState,
  isDataIntegrityPinConfigured,
  recordDataIntegrityPinFailure,
} from '../../middleware/dataIntegrityAccess.middleware.js';

const actorName = (user = {}) => [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ').trim() || user.email || 'Administrator';

export const getDataIntegrityAccessStatus = async (req, res) => {
  const configured = isDataIntegrityPinConfigured();
  const session = configured ? getDataIntegrityAccessSession(req) : null;

  if (!session) clearDataIntegrityAccessCookie(res);

  return res.json({
    success: true,
    data: {
      configured,
      unlocked: Boolean(session),
      expiresAt: session?.expiresAt || null,
    },
  });
};

export const unlockDataIntegrity = async (req, res) => {
  try {
    if (!isDataIntegrityPinConfigured()) {
      return res.status(503).json({
        success: false,
        code: 'DATA_INTEGRITY_PIN_NOT_CONFIGURED',
        message: 'Data Integrity PIN is not configured on the server.',
      });
    }

    const state = getDataIntegrityPinAttemptState(req);
    if (state.locked) {
      const minutes = Math.max(Math.ceil(state.remainingMs / 60_000), 1);
      return res.status(429).json({
        success: false,
        code: 'DATA_INTEGRITY_PIN_LOCKED',
        message: `Too many incorrect PIN attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      });
    }

    const pin = String(req.body?.pin || '').trim();
    if (!/^\d{4,12}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        code: 'DATA_INTEGRITY_PIN_INVALID_FORMAT',
        message: 'Enter the Data Integrity PIN.',
      });
    }

    if (!dataIntegrityPinMatches(pin)) {
      const failure = recordDataIntegrityPinFailure(req);
      return res.status(failure.locked ? 429 : 401).json({
        success: false,
        code: failure.locked ? 'DATA_INTEGRITY_PIN_LOCKED' : 'DATA_INTEGRITY_PIN_INCORRECT',
        message: failure.locked
          ? 'Too many incorrect PIN attempts. Data Integrity access is temporarily locked.'
          : `Incorrect PIN. ${failure.remainingAttempts} attempt${failure.remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout.`,
      });
    }

    clearDataIntegrityPinFailures(req);
    const session = createDataIntegrityAccessToken({ userId: req.authUser?.id });
    res.cookie(DATA_INTEGRITY_ACCESS_COOKIE, session.token, getDataIntegrityAccessCookieOptions());

    try {
      await writeAuditLog(db, req, {
        actor: req.authUser,
        action: 'view',
        module: 'Data Integrity',
        entityType: 'data_integrity_access',
        entityId: String(req.authUser?.id || ''),
        entityLabel: actorName(req.authUser),
        title: 'Data Integrity unlocked',
        description: `${actorName(req.authUser)} unlocked the PIN-protected Data Integrity page.`,
        metadata: { authorization: 'PIN', sessionMinutes: session.sessionMinutes },
      });
    } catch {
      // Access should not fail only because a non-mutating access audit could not be written.
    }

    return res.json({
      success: true,
      message: 'Data Integrity unlocked.',
      data: {
        unlocked: true,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      code: error.code || '',
      message: error?.message || 'Unable to unlock Data Integrity.',
    });
  }
};

export const lockDataIntegrity = async (req, res) => {
  clearDataIntegrityAccessCookie(res);
  return res.json({ success: true, message: 'Data Integrity locked.' });
};
