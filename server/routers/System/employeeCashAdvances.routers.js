import express from 'express';
import {
  approveEmployeeCashAdvance,
  cancelEmployeeCashAdvance,
  createEmployeeCashAdvance,
  getEmployeeCashAdvance,
  getEmployeeCashAdvances,
  recordEmployeeCashAdvanceDeduction,
  rejectEmployeeCashAdvance,
  updateEmployeeCashAdvance,
} from '../../controllers/System/Employees/EmployeeCashAdvances.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);
router.get('/', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_VIEW), getEmployeeCashAdvances);
router.get('/:advanceId', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_VIEW), getEmployeeCashAdvance);
router.post('/', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), createEmployeeCashAdvance);
router.put('/:advanceId', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), updateEmployeeCashAdvance);
router.patch('/:advanceId/approve', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), approveEmployeeCashAdvance);
router.patch('/:advanceId/reject', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), rejectEmployeeCashAdvance);
router.patch('/:advanceId/cancel', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), cancelEmployeeCashAdvance);
router.post('/:advanceId/deductions', requirePermission(PERMISSIONS.EMPLOYEE_CASH_ADVANCES_MANAGE), recordEmployeeCashAdvanceDeduction);
export default router;
