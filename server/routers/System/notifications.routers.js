import express from 'express';
import {
  getPaymentDueNotifications,
  getDocumentNotifications,
  sendPaymentDueNotification,
  markPaymentDueContacted,
} from '../../controllers/System/notifications.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/documents', requirePermission(PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW), getDocumentNotifications);
router.get('/payment-dues', requirePermission(PERMISSIONS.SYSTEM_NOTIFICATIONS_VIEW), getPaymentDueNotifications);
router.post('/payment-dues/:scheduleId/send', requirePermission(PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE), sendPaymentDueNotification);
router.post('/payment-dues/:scheduleId/contacted', requirePermission(PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE), markPaymentDueContacted);

export default router;

