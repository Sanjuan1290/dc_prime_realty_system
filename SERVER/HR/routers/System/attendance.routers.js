import express from 'express';
import {
  correctAttendanceRecord,
  createAttendanceEvent,
  createManualAttendance,
  deleteAttendanceEvent,
  deleteAttendanceRecord,
  getAttendanceCalendar,
  getAttendanceCorrections,
  getAttendanceEvents,
  getAttendanceRecords,
  scanAttendance,
  updateAttendanceDay,
  updateAttendanceEvent,
} from '../../controllers/System/Employees/AttendanceSimple.controller.js';
import { getAttendanceExportData } from '../../controllers/System/Employees/AttendanceExport.controller.js';
import { getAttendanceSettings, updateAttendanceSettings } from '../../controllers/System/Employees/AttendanceSettings.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {previewBulkTimeOutAdjustment,applyBulkTimeOutAdjustment} from '../../controllers/System/Employees/AttendanceBulkTimeOut.controller.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceRecords);
router.get('/calendar', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceCalendar);
router.get('/export-data', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceExportData);
router.get('/settings', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceSettings);
router.put('/settings', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), updateAttendanceSettings);
router.post('/scan', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), scanAttendance);
router.post('/manual', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), createManualAttendance);
router.post('/bulk-time-out/preview',requirePermission(PERMISSIONS.ATTENDANCE_MANAGE),previewBulkTimeOutAdjustment);
router.post('/bulk-time-out',requirePermission(PERMISSIONS.ATTENDANCE_MANAGE),applyBulkTimeOutAdjustment);
router.put('/day/:date', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), updateAttendanceDay);
router.get('/events', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceEvents);
router.post('/events', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), createAttendanceEvent);
router.put('/events/:eventId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), updateAttendanceEvent);
router.delete('/events/:eventId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), deleteAttendanceEvent);
router.get('/:attendanceId/corrections', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceCorrections);
router.put('/:attendanceId/correction', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), correctAttendanceRecord);
router.delete('/:attendanceId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), deleteAttendanceRecord);

export default router;



