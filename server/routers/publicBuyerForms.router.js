import express from 'express';
import {
  getPublicBuyerForm,
  submitPublicBuyerForm,
} from '../controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js';
import { createPublicBuyerFormRateLimit } from '../middleware/publicBuyerFormRateLimit.middleware.js';

const router = express.Router();
const readLimit = createPublicBuyerFormRateLimit({ max: 40 });
const submitLimit = createPublicBuyerFormRateLimit({ max: 8 });

router.get('/:token', readLimit, getPublicBuyerForm);
router.post('/:token/submit', submitLimit, submitPublicBuyerForm);

export default router;


