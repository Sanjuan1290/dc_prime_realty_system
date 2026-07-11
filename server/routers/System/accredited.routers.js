import express from 'express';
import {
  getAccredited,
  getParentSellers,
  uploadAccreditedSellerProofOfIncome,
} from '../../controllers/System/accredited.controller.js';
import { requireAdmin, requireAuth, requirePasswordChanged } from '../../middleware/auth.middleware.js';
import { sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/', getAccredited);
router.get('/parents', getParentSellers);
router.post('/:sellerId/proof-of-income', sensitiveActionRateLimiter, uploadAccreditedSellerProofOfIncome);

export default router;
