import express from 'express';
import {
  confirmAuditLogDeletion,
  getAuditLogs,
  requestAuditLogDeletion,
} from '../../controllers/System/auditLogs.controller.js';
import { requireAuth, requirePasswordChanged, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import { passwordRateLimiter, sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged, requireSuperAdmin);

router.get('/', getAuditLogs);
router.post('/delete-all/request', sensitiveActionRateLimiter, requestAuditLogDeletion);
router.post('/delete-all/confirm', passwordRateLimiter, confirmAuditLogDeletion);

export default router;
