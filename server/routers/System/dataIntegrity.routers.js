import express from 'express';
import {
  getDataIntegrityAccount,
  getDataIntegrityReport,
  getDataIntegritySummary,
} from '../../controllers/System/dataIntegrity.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW), getDataIntegrityReport);
router.get('/summary', requirePermission(PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW), getDataIntegritySummary);
router.get('/accounts/:accountId', requirePermission(PERMISSIONS.SYSTEM_DATA_INTEGRITY_VIEW), getDataIntegrityAccount);

export default router;
