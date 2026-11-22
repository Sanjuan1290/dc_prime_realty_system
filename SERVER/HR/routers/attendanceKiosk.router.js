import express from 'express';
import {db} from '../db/connect.js';
import {loadKioskCredential,kioskCredentialStatus,validateKioskPassword} from '../services/attendanceKioskCredential.service.js';
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

router.get('/session', async (req, res,next) => {
 try{
  res.set('Cache-Control','no-store');
  const state=kioskCredentialStatus(await loadKioskCredential(db));
  const session = await getAttendanceKioskSession(req);
  if (!session) {
    clearAttendanceKioskCookie(res);
    return res.json({ success: true, unlocked: false,passwordExpired:state.expired,passwordExpiresAt:state.expiresAt,expiringSoon:state.expiringSoon });
  }
  return res.json({ success: true, unlocked: true, expiresAt: session.expiresAt,passwordExpiresAt:state.expiresAt,expiringSoon:state.expiringSoon });
 }catch(error){next(error)}
});

router.post('/unlock', async (req, res,next) => {
 try{
  res.set('Cache-Control','no-store');
  const credential=await loadKioskCredential(db),state=kioskCredentialStatus(credential);
  if(state.expired)return res.status(401).json({code:'KIOSK_PASSWORD_EXPIRED',message:'The kiosk password has expired. An HR administrator must regenerate it.'});
  if (!state.configured) {
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

  if (!await validateKioskPassword(req.body?.password ?? req.body?.pin,credential)) {
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
  const session = createAttendanceKioskToken({generation:credential.generation,credentialExpiresAt:credential.expiresAt});
  res.cookie(ATTENDANCE_KIOSK_COOKIE, session.token, getAttendanceKioskCookieOptions());
  return res.json({
    success: true,
    unlocked: true,
    expiresAt: session.expiresAt,
    message: 'Attendance station unlocked.',
  });
 }catch(error){next(error)}
});

router.post('/lock', (_req, res) => {
  clearAttendanceKioskCookie(res);
  return res.json({ success: true, unlocked: false, message: 'Attendance station locked.' });
});

router.post('/scan', requireAttendanceKiosk, scanAttendance);

export default router;



