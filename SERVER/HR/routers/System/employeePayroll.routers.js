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

import {exportSalaryFinance} from '../../controllers/System/hrReports.controller.js';
import {requestPayrollUndo,confirmPayrollUndo} from '../../services/payrollUndo.service.js';
import {db} from '../../db/connect.js';
const router = express.Router();
router.use(authenticateUser);
router.post('/payrolls/:employeePayrollId/undo/request',requirePermission(PERMISSIONS.PAYROLL_UNDO),async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await requestPayrollUndo(req.params.employeePayrollId,req.authUser.id,req.body))}catch(error){next(error)}});
router.post('/payrolls/:employeePayrollId/undo/confirm',requirePermission(PERMISSIONS.PAYROLL_UNDO),async(req,res,next)=>{try{res.set('Cache-Control','no-store').json(await confirmPayrollUndo(req.params.employeePayrollId,req.authUser.id,req.body))}catch(error){next(error)}});
router.get('/payrolls/:employeePayrollId/undo-history/:undoId/receipt',requirePermission(PERMISSIONS.PAYROLL_HISTORY_VIEW),async(req,res,next)=>{try{
  if(!/^[1-9]\d*$/.test(req.params.employeePayrollId)||!/^[1-9]\d*$/.test(req.params.undoId))return res.status(400).json({message:'Select a valid historical receipt.'});
  const [[row]]=await db.query('SELECT receipt_json,reason FROM hr_payroll_undo_history WHERE id=? AND payroll_id=?',[req.params.undoId,req.params.employeePayrollId]);
  if(!row)return res.status(404).json({message:'Historical receipt not found.'});
  const receipt=typeof row.receipt_json==='string'?JSON.parse(row.receipt_json):row.receipt_json;
  res.set('Cache-Control','no-store').json({success:true,data:{...receipt,official:false,undo_reason:row.reason,historical_view:true}});
}catch(error){next(error)}});

router.get('/settings', requirePermission(PERMISSIONS.PAYROLL_SETTINGS_MANAGE), getEmployeePayrollSettings);
router.put('/settings', requirePermission(PERMISSIONS.PAYROLL_SETTINGS_MANAGE), updateEmployeePayrollSettings);
router.get('/period-preview', requirePermission(PERMISSIONS.EMPLOYEE_SALARY_VIEW), getPayrollPeriodPreview);
router.get('/finance-export',requirePermission(PERMISSIONS.PAYROLL_SUMMARY_EXPORT),exportSalaryFinance);
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
router.use('/payrolls/:employeePayrollId/signed-receipts', (_req, res) => res.status(503).json({ code: 'HR_SIGNED_RECEIPTS_PENDING', message: 'Signed receipts are not available in the staging HR backend.' }));
router.post('/payrolls/:employeePayrollId/release', requirePermission(PERMISSIONS.PAYROLL_RELEASE), (req,res,next)=> {
  // Every release creates an immutable outbox event. Manual Finance exports
  // remain available even when automatic delivery is not configured.
  return next();
}, releaseEmployeePayroll);

export default router;




