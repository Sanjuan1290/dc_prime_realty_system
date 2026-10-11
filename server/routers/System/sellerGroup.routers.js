import express from 'express';
import {
  createGroup,
  getGroups,
  getGroupOptions,
  getNetworkPoolShares,
  editGroup,
  toggleGroupStatus,
  viewGroup,
  getGroupProjectOptions,
  getGroupProjectAnalytics,
  getGroupProjectConfiguration,
  updateGroupProjectPool,
  previewNetworkMemberImport,
  commitNetworkMemberImport,
  getNetworkMemberImportHistory,
  undoNetworkMemberImport,
  checkNetworkBrokerName,
  deleteGroup,
} from '../../controllers/System/sellerGroup.controller.js';
import { authenticateUser, requirePermission, requireProjectPermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroups);
router.get('/options', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroupOptions);
router.get('/pool-shares', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getNetworkPoolShares);
router.get('/broker-check', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), checkNetworkBrokerName);

router.post('/:groupId/members/import/preview',
  requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE),
  requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE),
  requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT),
  previewNetworkMemberImport
);
router.post('/:groupId/members/import/commit',
  requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE),
  requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE),
  requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT),
  commitNetworkMemberImport
);

router.get('/:groupId/members/import/history',
  requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getNetworkMemberImportHistory
);
router.post('/:groupId/members/import/:batchId/undo',
  requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE),
  requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE),
  requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT),
  undoNetworkMemberImport
);

router.get('/:groupId/projects', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), getGroupProjectOptions);
router.get('/:groupId/projects/:projectId/analytics', requireProjectPermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, { projectIdParam: 'projectId' }), getGroupProjectAnalytics);
router.get('/:groupId/projects/:projectId', requireProjectPermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, { projectIdParam: 'projectId' }), getGroupProjectConfiguration);
router.patch('/:groupId/projects/:projectId/pool', requireProjectPermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE, { projectIdParam: 'projectId' }), updateGroupProjectPool);
router.get('/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW), viewGroup);
router.post('/create', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), createGroup);
router.put('/edit/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), editGroup);
router.patch('/toggle-status/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), toggleGroupStatus);
router.delete('/:id', requirePermission(PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE), deleteGroup);

export default router;


