import express from 'express';
import {
  createGroup,
  getGroups,
  getGroupOptions,
  editGroup,
  toggleGroupStatus,
  viewGroup,
  editUserRate,
} from '../../controllers/System/sellerGroup.controller.js';
import { requireAdmin, requireAuth, requirePasswordChanged } from '../../middleware/auth.middleware.js';
import { sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/', getGroups);
router.get('/options', getGroupOptions);
router.post('/create', sensitiveActionRateLimiter, createGroup);
router.put('/edit/:id', sensitiveActionRateLimiter, editGroup);
router.patch('/toggle-status/:id', sensitiveActionRateLimiter, toggleGroupStatus);
router.get('/:id', viewGroup);
router.patch('/:groupId/members/:accreditedSellerId/rates', sensitiveActionRateLimiter, editUserRate);

export default router;
