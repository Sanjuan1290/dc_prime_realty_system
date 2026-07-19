import express from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
} from '../../controllers/System/systemSettings.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_VIEW), getSystemSettings);
router.put('/', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), updateSystemSettings);

export default router;

