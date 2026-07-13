import express from 'express';
import {
  confirmAuditLogDeletion,
  getAuditLogs,
  requestAuditLogDeletion,
} from '../../controllers/System/auditLogs.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW), getAuditLogs);
router.post('/delete-all/request', requirePermission(PERMISSIONS.AUDIT_LOGS_DELETE), requestAuditLogDeletion);
router.post('/delete-all/confirm', requirePermission(PERMISSIONS.AUDIT_LOGS_DELETE), confirmAuditLogDeletion);

export default router;
