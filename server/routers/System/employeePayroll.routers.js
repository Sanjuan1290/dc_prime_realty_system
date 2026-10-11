import express from 'express';
import {
  generateDraftPayroll,
  getEmployeePayrollSettings,
  updateEmployeePayrollSettings,
  getDraftPayroll,
  getDraftPayrolls,
  getPayrollPeriodPreview,
  getPayrollSummaryExportData,
  getPayrollEligibleEmployees,
  getFundReleaseReceipt,
  getEmployeeSalaryHistory,
  getHistoricalPayroll,
  getHistoricalFundReleaseReceipt,
  getPayrollFinalReview,
  finalizeEmployeePayroll,
  getPayrollCorrectionReview,
  correctFinalizedEmployeePayroll,
  releaseEmployeePayroll,
  recalculateDraftPayroll,
} from '../../controllers/System/Employees/EmployeePayroll.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/settings', requirePermission(PERMISSIONS.PAYROLL_SETTINGS_MANAGE), getEmployeePayrollSettings);
router.put('/settings', requirePermission(PERMISSIONS.PAYROLL_SETTINGS_MANAGE), updateEmployeePayrollSettings);
router.get('/period-preview', requirePermission(PERMISSIONS.EMPLOYEE_SALARY_VIEW), getPayrollPeriodPreview);
router.get('/summary-export', requirePermission(PERMISSIONS.PAYROLL_SUMMARY_EXPORT), getPayrollSummaryExportData);
router.get('/drafts', requirePermission(PERMISSIONS.EMPLOYEE_SALARY_VIEW), getDraftPayrolls);
router.get('/history/:employeeId', requirePermission(PERMISSIONS.PAYROLL_HISTORY_VIEW), getEmployeeSalaryHistory);
router.get('/history/payrolls/:employeePayrollId', requirePermission(PERMISSIONS.PAYROLL_HISTORY_VIEW), getHistoricalPayroll);
router.get('/history/payrolls/:employeePayrollId/receipt', requirePermission(PERMISSIONS.PAYROLL_HISTORY_VIEW), getHistoricalFundReleaseReceipt);
router.get('/eligible-employees', requirePermission(PERMISSIONS.PAYROLL_GENERATE), getPayrollEligibleEmployees);
router.get('/drafts/:employeePayrollId', requirePermission(PERMISSIONS.EMPLOYEE_SALARY_VIEW), getDraftPayroll);
router.get('/drafts/:employeePayrollId/receipt', requirePermission(PERMISSIONS.EMPLOYEE_SALARY_VIEW), getFundReleaseReceipt);
router.post('/drafts/generate', requirePermission(PERMISSIONS.PAYROLL_GENERATE), generateDraftPayroll);
router.post('/drafts/:employeePayrollId/recalculate', requirePermission(PERMISSIONS.PAYROLL_RECALCULATE_DRAFT), recalculateDraftPayroll);
router.get('/drafts/:employeePayrollId/final-review', requirePermission(PERMISSIONS.PAYROLL_FINALIZE), getPayrollFinalReview);
router.post('/drafts/:employeePayrollId/finalize', requirePermission(PERMISSIONS.PAYROLL_FINALIZE), finalizeEmployeePayroll);
router.get('/payrolls/:employeePayrollId/correction-review', requirePermission(PERMISSIONS.PAYROLL_CORRECT_FINALIZED), getPayrollCorrectionReview);
router.post('/payrolls/:employeePayrollId/corrections', requirePermission(PERMISSIONS.PAYROLL_CORRECT_FINALIZED), correctFinalizedEmployeePayroll);
router.post('/payrolls/:employeePayrollId/release', requirePermission(PERMISSIONS.PAYROLL_RELEASE), releaseEmployeePayroll);

export default router;

