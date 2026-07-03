import express from 'express';
import { getPaymentLogs } from '../../controllers/BailenProject/paymentLogs.controller.js';
const router = express.Router();
router.get('/', getPaymentLogs);
export default router;
