import express from 'express';
import { scanAttendance } from '../controllers/System/Employees/AttendanceSimple.controller.js';
import {
  ATTENDANCE_KIOSK_COOKIE,
  attendancePinMatches,
  clearAttendanceKioskCookie,
  clearAttendancePinFailures,
  createAttendanceKioskToken,
  getAttendanceKioskCookieOptions,
  getAttendanceKioskSession,
  getAttendancePinAttemptState,
  isAttendancePinConfigured,
  recordAttendancePinFailure,
  requireAttendanceKiosk,
} from '../middleware/attendanceKiosk.middleware.js';

const router = express.Router();

router.get('/session', (req, res) => {
  const session = getAttendanceKioskSession(req);
  if (!session) {
    clearAttendanceKioskCookie(res);
    return res.json({ success: true, unlocked: false });
  }
  return res.json({ success: true, unlocked: true, expiresAt: session.expiresAt });
});

router.post('/unlock', (req, res) => {
  if (!isAttendancePinConfigured()) {
    return res.status(503).json({
      success: false,
      code: 'ATTENDANCE_KIOSK_NOT_CONFIGURED',
      message: 'Attendance kiosk PIN is not configured on the server.',
    });
  }

  const attemptState = getAttendancePinAttemptState(req);
  if (attemptState.locked) {
    const minutes = Math.max(1, Math.ceil(attemptState.remainingMs / 60000));
    return res.status(429).json({
      success: false,
      code: 'ATTENDANCE_PIN_LOCKED',
      message: `Too many incorrect PIN attempts. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    });
  }

  if (!attendancePinMatches(req.body?.pin)) {
    const failure = recordAttendancePinFailure(req);
    if (failure.locked) {
      return res.status(429).json({
        success: false,
        code: 'ATTENDANCE_PIN_LOCKED',
        message: 'Too many incorrect PIN attempts. This station is locked for 15 minutes.',
      });
    }
    return res.status(401).json({
      success: false,
      code: 'ATTENDANCE_PIN_INVALID',
      message: `Incorrect attendance PIN. ${failure.remainingAttempts} attempt${failure.remainingAttempts === 1 ? '' : 's'} remaining before temporary lockout.`,
    });
  }

  clearAttendancePinFailures(req);
  const session = createAttendanceKioskToken();
  res.cookie(ATTENDANCE_KIOSK_COOKIE, session.token, getAttendanceKioskCookieOptions());
  return res.json({
    success: true,
    unlocked: true,
    expiresAt: session.expiresAt,
    message: 'Attendance station unlocked.',
  });
});

router.post('/lock', (_req, res) => {
  clearAttendanceKioskCookie(res);
  return res.json({ success: true, unlocked: false, message: 'Attendance station locked.' });
});

router.post('/scan', requireAttendanceKiosk, scanAttendance);

export default router;
