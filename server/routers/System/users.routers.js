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
  requestForgotPasswordCode,
  verifyForgotPasswordCode,
  resetForgottenPassword,
} from '../../controllers/System/users.controllers.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();

router.post('/login', login);
router.post('/forgot-password/request', requestForgotPasswordCode);
router.post('/forgot-password/verify', verifyForgotPasswordCode);
router.post('/forgot-password/reset', resetForgottenPassword);
router.post('/logout', logout);
router.get('/me', getMe);
router.patch('/change-password', authenticateUser, changePassword);

router.get('/getUsers', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_VIEW), getUsers);
router.post('/createUser', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_CREATE), createUser);
router.put('/editUser/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_EDIT), editUser);
router.patch('/toggleUserStatus/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_CHANGE_STATUS), toggleUserStatus);
router.patch('/resetPassword/:id', authenticateUser, requirePermission(PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD), resetUserPassword);

export default router;


