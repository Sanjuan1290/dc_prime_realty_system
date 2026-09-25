import express from 'express';
import {
  createGroup,
  getGroups,
  getGroupOptions,
  editGroup,
  toggleGroupStatus,
  viewGroup,
  getGroupProjectOptions,
  getGroupProjectAnalytics,
  getGroupProjectConfiguration,
  updateGroupProjectPool,
} from '../../controllers/System/sellerGroup.controller.js';
import { authenticateUser, requirePermission, requireProjectPermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroups);
router.get('/options', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroupOptions);

router.get('/:groupId/projects', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroupProjectOptions);
router.get('/:groupId/projects/:projectId/analytics', requireProjectPermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, { projectIdParam: 'projectId' }), getGroupProjectAnalytics);
router.get('/:groupId/projects/:projectId', requireProjectPermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, { projectIdParam: 'projectId' }), getGroupProjectConfiguration);
router.patch('/:groupId/projects/:projectId/pool', requireProjectPermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE, { projectIdParam: 'projectId' }), updateGroupProjectPool);
router.get('/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), viewGroup);
router.post('/create', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), createGroup);
router.put('/edit/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), editGroup);
router.patch('/toggle-status/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), toggleGroupStatus);

export default router;

