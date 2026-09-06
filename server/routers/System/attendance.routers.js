import express from 'express';
import {
  correctAttendanceRecord,
  createAttendanceEvent,
  createManualAttendance,
  deleteAttendanceEvent,
  deleteAttendanceRecord,
  getAttendanceCorrections,
  getAttendanceEvents,
  getAttendanceRecords,
  scanAttendance,
  updateAttendanceDay,
  updateAttendanceEvent,
} from '../../controllers/System/Employees/AttendanceSimple.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceRecords);
router.post('/scan', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), scanAttendance);
router.post('/manual', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), createManualAttendance);
router.put('/day/:date', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), updateAttendanceDay);
router.get('/events', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceEvents);
router.post('/events', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), createAttendanceEvent);
router.put('/events/:eventId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), updateAttendanceEvent);
router.delete('/events/:eventId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), deleteAttendanceEvent);
router.get('/:attendanceId/corrections', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceCorrections);
router.put('/:attendanceId/correction', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), correctAttendanceRecord);
router.delete('/:attendanceId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), deleteAttendanceRecord);

export default router;
