import express from 'express';
import {
  createAttendanceRecord,
  deleteAttendanceRecord,
  finalizePayroll,
  getAttendanceRecords,
  getPayrollPreview,
  updateAttendanceRecord,
} from '../../controllers/System/Employees/Attendance.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);
router.get('/', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceRecords);
router.get('/payroll-preview', requirePermission(PERMISSIONS.PAYROLL_VIEW), getPayrollPreview);
router.post('/payroll-finalize', requirePermission(PERMISSIONS.PAYROLL_MANAGE), finalizePayroll);
router.post('/', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), createAttendanceRecord);
router.put('/:attendanceId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), updateAttendanceRecord);
router.delete('/:attendanceId', requirePermission(PERMISSIONS.ATTENDANCE_MANAGE), deleteAttendanceRecord);
export default router;
