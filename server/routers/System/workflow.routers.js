import express from 'express';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';
import {
  listOperationalReviews,getReviewCenterSummary,getOperationalReview,claimOperationalReview,confirmHeadReview,returnReviewForCorrection,auditorVerifyReview,listInternalNotifications,markInternalNotificationRead,openAuditCase,respondToAuditCase,reassignAuditCaseResponder,resolveAuditCase,getAuditCase,listProtectedChangeRequests,reviewProtectedChangeRequest,
} from '../../controllers/System/workflow.controller.js';

const router=express.Router();
router.use(authenticateUser);
router.get('/reviews',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),listOperationalReviews);
router.get('/summary',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getReviewCenterSummary);
router.get('/reviews/:id',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getOperationalReview);
router.post('/reviews/:id/claim',requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW),claimOperationalReview);
router.post('/reviews/:id/head-confirm',requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_REVIEW),confirmHeadReview);
router.post('/reviews/:id/return',requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_RETURN_FOR_CORRECTION),returnReviewForCorrection);
router.post('/reviews/:id/auditor-verify',requirePermission(PERMISSIONS.WORKFLOW_AUDIT_REVIEW),auditorVerifyReview);
router.post('/reviews/:id/audit-case',requirePermission(PERMISSIONS.WORKFLOW_AUDIT_CASE_CREATE),openAuditCase);
router.get('/audit-cases/:caseId',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),getAuditCase);
router.post('/audit-cases/:caseId/head-response',requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_CASE_RESPOND),respondToAuditCase);
router.post('/audit-cases/:caseId/reassign-responder',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),reassignAuditCaseResponder);
router.post('/audit-cases/:caseId/resolve',requirePermission(PERMISSIONS.WORKFLOW_AUDIT_CASE_RESOLVE),resolveAuditCase);
router.get('/protected-changes',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),listProtectedChangeRequests);
router.post('/protected-changes/:requestId/review',requirePermission(PERMISSIONS.WORKFLOW_DEPARTMENT_APPROVE_PROTECTED_CHANGE),reviewProtectedChangeRequest);
router.get('/notifications',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),listInternalNotifications);
router.patch('/notifications/:id/read',requirePermission(PERMISSIONS.WORKFLOW_REVIEW_CENTER_VIEW),markInternalNotificationRead);
export default router;
