import express from 'express';
import {
  getPaymentDueNotifications,
  sendPaymentDueNotification,
  markPaymentDueContacted,
} from '../../controllers/System/notifications.controller.js';

const router = express.Router();

router.get('/payment-dues', getPaymentDueNotifications);
router.post('/payment-dues/:scheduleId/send', sendPaymentDueNotification);
router.post('/payment-dues/:scheduleId/contacted', markPaymentDueContacted);

export default router;
