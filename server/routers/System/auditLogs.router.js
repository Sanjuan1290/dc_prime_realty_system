import express from 'express';
import {
  createAuditLog,
  deleteAuditLog,
  getAuditLogs,
} from '../../controllers/System/auditLogs.controller.js';

const router = express.Router();

router.get('/', getAuditLogs);
router.post('/', createAuditLog);
router.delete('/:auditLogId', deleteAuditLog);

export default router;
