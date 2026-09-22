import express from 'express';
import {
  login,
  logout,
  getMe,
  changePassword,
  getUsers,
  createUser,
  editUser,
  toggleUserStatus,
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
import { authenticateUser, requireExactRole, requirePermission } from '../../middleware/auth.middleware.js';
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

router.get('/access-control/roles', authenticateUser, requireExactRole('super_admin'), getRoleAccessDefaults);
router.put('/access-control/roles/:role', authenticateUser, requireExactRole('super_admin'), updateRoleAccessDefaults);
router.get('/access-control/users/:id', authenticateUser, requireExactRole('super_admin'), getUserAccessControl);
router.put('/access-control/users/:id', authenticateUser, requireExactRole('super_admin'), updateUserAccessControl);
router.post('/access-control/users/:id/apply-role-defaults', authenticateUser, requireExactRole('super_admin'), applyRoleDefaultsToUser);

router.get('/getUsers', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_VIEW), getUsers);
router.post('/createUser', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE), createUser);
router.put('/editUser/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT), editUser);
router.patch('/toggleUserStatus/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_DEACTIVATE), toggleUserStatus);
router.post('/change-position/:id', authenticateUser, requireExactRole('super_admin'), changeUserPosition);
router.patch('/resetPassword/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD), resetUserPassword);

export default router;
