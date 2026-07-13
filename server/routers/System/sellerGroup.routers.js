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
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), getGroups);
router.get('/options', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), getGroupOptions);
router.get('/:id', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), viewGroup);
router.post('/create', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_MANAGE), createGroup);
router.put('/edit/:id', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_MANAGE), editGroup);
router.patch('/toggle-status/:id', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_MANAGE), toggleGroupStatus);
router.patch('/:groupId/members/:accreditedSellerId/rates', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_MANAGE), editUserRate);

export default router;
