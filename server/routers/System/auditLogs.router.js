import express from 'express';
import {
  confirmAuditLogDeletion,
  getAuditLogs,
  requestAuditLogDeletion,
} from '../../controllers/System/auditLogs.controller.js';

const router = express.Router();

router.get('/', getAuditLogs);
router.post('/delete-all/request', requestAuditLogDeletion);
router.post('/delete-all/confirm', confirmAuditLogDeletion);

export default router;
