import express from 'express';
import {
  login,
  logout,
  getMe,
  changePassword,
  getUsers,
  previewSystemAccountCode,
  checkSystemUserEmailAvailability,
  createUser,
  editUser,
  requestUserDeactivationCode,
  deactivateUserPermanently,
  reactivateUser,
  resetUserPassword,
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

router.get('/access-control/roles', authenticateUser, requireExactRole('super_admin', 'system_admin'), getRoleAccessDefaults);
router.put('/access-control/roles/:role', authenticateUser, requireExactRole('super_admin', 'system_admin'), updateRoleAccessDefaults);
router.get('/access-control/users/:id', authenticateUser, requireExactRole('super_admin', 'system_admin'), getUserAccessControl);
router.put('/access-control/users/:id', authenticateUser, requireExactRole('super_admin', 'system_admin'), updateUserAccessControl);
router.post('/access-control/users/:id/apply-role-defaults', authenticateUser, requireExactRole('super_admin', 'system_admin'), applyRoleDefaultsToUser);

router.get('/getUsers', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_VIEW), getUsers);
router.get('/account-code-preview', authenticateUser, requireExactRole('super_admin', 'system_admin'), previewSystemAccountCode);
router.get('/email-availability', authenticateUser, requireExactRole('super_admin', 'system_admin'), checkSystemUserEmailAvailability);
router.post('/createUser', authenticateUser, requireExactRole('super_admin', 'system_admin'), createUser);
router.put('/editUser/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT), editUser);
router.post('/deactivate/:id/code', authenticateUser, requireExactRole('super_admin', 'system_admin'), requirePermission(PERMISSIONS.SYSTEM_USERS_DEACTIVATE), requireCurrentPassword({ field: 'password', label: 'Administrator password' }), requestUserDeactivationCode);
router.patch('/deactivate/:id', authenticateUser, requireExactRole('super_admin', 'system_admin'), requirePermission(PERMISSIONS.SYSTEM_USERS_DEACTIVATE), deactivateUserPermanently);
router.post('/reactivate/:id', authenticateUser, requireExactRole('super_admin', 'system_admin'), requireCurrentPassword({ field: 'password', label: 'Administrator password' }), reactivateUser);
router.patch('/resetPassword/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD), resetUserPassword);

export default router;
