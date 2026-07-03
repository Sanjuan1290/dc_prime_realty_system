import express from 'express';
import { addPayment, getPayments, searchClientUnits, suggestAmount } from '../../controllers/BailenProject/payments.controller.js';
const router = express.Router();
router.get('/', getPayments);
router.get('/search-client-units', searchClientUnits);
router.get('/suggest-amount', suggestAmount);
router.post('/', addPayment);
export default router;
