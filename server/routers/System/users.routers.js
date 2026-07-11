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
} from '../../controllers/System/users.controllers.js';
import {
  requireAuth,
  requirePasswordChanged,
  requireSuperAdmin,
} from '../../middleware/auth.middleware.js';
import {
  loginRateLimiter,
  passwordRateLimiter,
  sensitiveActionRateLimiter,
} from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.post('/login', loginRateLimiter, login);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.patch('/change-password', passwordRateLimiter, requireAuth, changePassword);

router.use(requireAuth, requirePasswordChanged, requireSuperAdmin);

router.get('/getUsers', getUsers);
router.post('/createUser', sensitiveActionRateLimiter, createUser);
router.put('/editUser/:id', sensitiveActionRateLimiter, editUser);
router.patch('/toggleUserStatus/:id', sensitiveActionRateLimiter, toggleUserStatus);
router.patch('/resetPassword/:id', passwordRateLimiter, resetUserPassword);

export default router;
