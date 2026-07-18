import express from 'express';
import {
  createGroup,
  getGroups,
  getGroupOptions,
  editGroup,
  toggleGroupStatus,
  viewGroup,
  getGroupProjectConfiguration,
  updateGroupProjectPool,
  upsertAgentDirectRate,
  upsertHierarchyOverride,
  createDirectSalesAgent,
  toggleDirectSalesAgentStatus,
} from '../../controllers/System/sellerGroup.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroups);
router.get('/options', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroupOptions);

router.get('/:groupId/projects/:projectId', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroupProjectConfiguration);
router.patch('/:groupId/projects/:projectId/pool', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), updateGroupProjectPool);
router.patch('/:groupId/projects/:projectId/agents/:agentId/direct-rate', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), upsertAgentDirectRate);
router.patch('/:groupId/projects/:projectId/children/:childId/override', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), upsertHierarchyOverride);
router.post('/:groupId/direct-sales-agents/:ownerId', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), createDirectSalesAgent);
router.patch('/:groupId/direct-sales-agents/:dummyId/status', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), toggleDirectSalesAgentStatus);
router.get('/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), viewGroup);
router.post('/create', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), createGroup);
router.put('/edit/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), editGroup);
router.patch('/toggle-status/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), toggleGroupStatus);

export default router;
