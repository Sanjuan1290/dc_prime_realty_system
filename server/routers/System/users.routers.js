import express from 'express';
import {
  login,
  logout,
  getMe,
  changePassword,
  getUsers,
  previewSystemAccountCode,
  checkSystemUserEmailAvailability,
  previewChangeUserPosition,
  createUser,
  editUser,
  requestUserDeactivationCode,
  deactivateUserPermanently,
  resetUserPassword,
  changeUserPosition,
  requestForgotPasswordCode,
  verifyForgotPasswordCode,
  resetForgottenPassword,
} from '../../controllers/System/users.controllers.js';

import {
  applyRoleDefaultsToUser,
  getRoleAccessDefaults,
  getUserAccessControl,
  updateRoleAccessDefaults,
  updateUserAccessControl,
} from '../../controllers/System/accessControl.controller.js';
import { authenticateUser, requireCurrentPassword, requireExactRole, requirePermission } from '../../middleware/auth.middleware.js';
import { loginRateLimit } from '../../middleware/loginRateLimit.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();

router.post('/login', loginRateLimit, login);
router.post('/forgot-password/request', requestForgotPasswordCode);
router.post('/forgot-password/verify', verifyForgotPasswordCode);
router.post('/forgot-password/reset', resetForgottenPassword);
router.post('/logout', logout);
router.get('/me', getMe);
router.patch('/change-password', authenticateUser, changePassword);

router.get('/access-control/roles', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_ACCESS_CONTROL_VIEW), getRoleAccessDefaults);
router.put('/access-control/roles/:role', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE), updateRoleAccessDefaults);
router.get('/access-control/users/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_ACCESS_CONTROL_VIEW), getUserAccessControl);
router.put('/access-control/users/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE), updateUserAccessControl);
router.post('/access-control/users/:id/apply-role-defaults', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_ACCESS_CONTROL_MANAGE), applyRoleDefaultsToUser);

router.get('/getUsers', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_VIEW), getUsers);
router.get('/account-code-preview', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE), previewSystemAccountCode);
router.get('/email-availability', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE), checkSystemUserEmailAvailability);
router.post('/createUser', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE), createUser);
router.put('/editUser/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT), editUser);
router.post('/deactivate/:id/code', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_DEACTIVATE), requireCurrentPassword({ field: 'password', label: 'Administrator password' }), requestUserDeactivationCode);
router.patch('/deactivate/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_DEACTIVATE), deactivateUserPermanently);
router.get('/change-position/:id/preview', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT), previewChangeUserPosition);
router.post('/change-position/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT), changeUserPosition);
router.patch('/resetPassword/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD), resetUserPassword);

export default router;
