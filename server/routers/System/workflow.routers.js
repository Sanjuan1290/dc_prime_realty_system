import express from 'express';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listOperationalReviews,getReviewCenterSummary,getOperationalReview,getOperationalReviewProofContent,claimOperationalReview,confirmHeadReview,returnReviewForCorrection,resubmitManualReviewCorrection,auditorVerifyReview,listInternalNotifications,markInternalNotificationRead,markAllInternalNotificationsRead,openAuditCase,respondToAuditCase,reassignAuditCaseResponder,resolveAuditCase,getAuditCase,listProtectedChangeRequests,reviewProtectedChangeRequest,
} from '../../controllers/System/workflow.controller.js';

const router=express.Router();
const REVIEW_CENTER_ROLES = new Set([
  'super_admin','system_admin','auditor',
  'marketing_head','sales_head','accounting_head','operations_head',
  'marketing_staff','sales_staff','accounting_staff','operations_staff',
]);
const requireReviewCenterRole = (req,res,next) => {
  if (!REVIEW_CENTER_ROLES.has(String(req.authUser?.role || ''))) {
    return res.status(403).json({ message: 'Review Center is available only to Department Staff/Heads, Auditor, System Admin and Super Admin.' });
  }
  return next();
};

router.use(authenticateUser);
router.get('/reviews',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),listOperationalReviews);
router.get('/summary',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getReviewCenterSummary);
router.get('/reviews/:id',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getOperationalReview);
router.get('/reviews/:id/proofs/:proofId/content',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getOperationalReviewProofContent);
router.post('/reviews/:id/claim',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW),claimOperationalReview);
router.post('/reviews/:id/head-confirm',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW),confirmHeadReview);
router.post('/reviews/:id/return',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_RETURN_FOR_CORRECTION),returnReviewForCorrection);
router.post('/reviews/:id/resubmit-manual',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),resubmitManualReviewCorrection);
router.post('/reviews/:id/auditor-verify',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_AUDIT_REVIEW),auditorVerifyReview);
router.post('/reviews/:id/audit-case',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE),openAuditCase);
router.get('/audit-cases/:caseId',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getAuditCase);
router.post('/audit-cases/:caseId/head-response',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_CASE_RESPOND),respondToAuditCase);
router.post('/audit-cases/:caseId/reassign-responder',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),reassignAuditCaseResponder);
router.post('/audit-cases/:caseId/resolve',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_AUDIT_CASE_RESOLVE),resolveAuditCase);
router.get('/protected-changes',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),listProtectedChangeRequests);
router.post('/protected-changes/:requestId/review',requireReviewCenterRole,requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_APPROVE_PROTECTED_CHANGE),reviewProtectedChangeRequest);
router.get('/notifications',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),listInternalNotifications);
router.patch('/notifications/read-all',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),markAllInternalNotificationsRead);
router.patch('/notifications/:id/read',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),markInternalNotificationRead);
export default router;


