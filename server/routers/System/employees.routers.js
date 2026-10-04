import express from 'express';
import {
  createEmployee,
  createEmployeeEmploymentChange,
  getEmployee,
  getEmployeeEmploymentHistoryDetails,
  getEmployees,
  previewEmployeeBarcode,
  regenerateEmployeeAttendanceBarcode,
  updateEmployee,
  updateEmployeeStatus,
} from '../../controllers/System/Employees/EmployeesSimple.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);
router.get('/', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), getEmployees);
router.post('/employee-code-preview', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), previewEmployeeBarcode);
router.post('/barcode-preview', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), previewEmployeeBarcode); // Backward-compatible alias
router.get('/:employeeId/employment-history', requirePermission(PERMISSIONS.EMPLOYMENT_HISTORY_VIEW), getEmployeeEmploymentHistoryDetails);
router.post('/:employeeId/employment-changes', requirePermission(PERMISSIONS.EMPLOYEE_COMPENSATION_MANAGE), requirePermission(PERMISSIONS.EMPLOYMENT_CHANGE_CREATE), createEmployeeEmploymentChange);
router.get('/:employeeId', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), getEmployee);
router.post('/', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), createEmployee);
router.put('/:employeeId', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), updateEmployee);
router.post('/:employeeId/regenerate-barcode', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), regenerateEmployeeAttendanceBarcode);
router.patch('/:employeeId/status', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), updateEmployeeStatus);
export default router;
