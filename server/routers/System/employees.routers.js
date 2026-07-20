import express from 'express';
import {
  createEmployee,
  getEmployee,
  getEmployees,
  updateEmployee,
  updateEmployeeStatus,
} from '../../controllers/System/Employees/Employees.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);
router.get('/', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), getEmployees);
router.get('/:employeeId', requirePermission(PERMISSIONS.EMPLOYEES_VIEW), getEmployee);
router.post('/', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), createEmployee);
router.put('/:employeeId', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), updateEmployee);
router.patch('/:employeeId/status', requirePermission(PERMISSIONS.EMPLOYEES_MANAGE), updateEmployeeStatus);
export default router;


