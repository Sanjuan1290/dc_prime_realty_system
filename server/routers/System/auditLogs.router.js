import express from 'express';
import {
  confirmAuditLogArchive,
  downloadAuditLogArchiveExport,
  getAuditLogs,
  requestAuditLogArchive,
} from '../../controllers/System/auditLogs.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.AUDIT_LOGS_VIEW), getAuditLogs);
router.post('/archive/request', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), requestAuditLogArchive);
router.post('/archive/confirm', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), confirmAuditLogArchive);
router.get('/archive/exports/:batchId', requirePermission(PERMISSIONS.AUDIT_LOGS_ARCHIVE), downloadAuditLogArchiveExport);

export default router;


