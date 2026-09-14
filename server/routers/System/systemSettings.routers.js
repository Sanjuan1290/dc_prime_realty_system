import express from 'express';
import {
  getSystemSettings,
  requestSystemSettingsCode,
  updateSystemSettings,
} from '../../controllers/System/systemSettings.controller.js';
import { authenticateUser, requireCurrentPassword, requireExactRole, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_VIEW), getSystemSettings);
router.post('/code', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), requireExactRole('super_admin'), requireCurrentPassword({ field: 'password', label: 'Super Admin password' }), requestSystemSettingsCode);
router.put('/', requirePermission(PERMISSIONS.SYSTEM_SETTINGS_MANAGE), requireExactRole('super_admin'), updateSystemSettings);

export default router;

