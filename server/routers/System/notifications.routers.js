import express from 'express';
import {
  getPaymentDueNotifications,
  sendPaymentDueNotification,
  markPaymentDueContacted,
} from '../../controllers/System/notifications.controller.js';
import { requireAdmin, requireAuth, requirePasswordChanged } from '../../middleware/auth.middleware.js';
import { sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/payment-dues', getPaymentDueNotifications);
router.post('/payment-dues/:scheduleId/send', sensitiveActionRateLimiter, sendPaymentDueNotification);
router.post('/payment-dues/:scheduleId/contacted', sensitiveActionRateLimiter, markPaymentDueContacted);

export default router;
