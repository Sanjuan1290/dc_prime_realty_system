import express from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
} from '../../controllers/System/systemSettings.controller.js';
import {
  requireAdmin,
  requireAuth,
  requirePasswordChanged,
  requireSuperAdmin,
} from '../../middleware/auth.middleware.js';
import { sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged);
router.get('/', requireAdmin, getSystemSettings);
router.put('/', requireSuperAdmin, sensitiveActionRateLimiter, updateSystemSettings);

export default router;
