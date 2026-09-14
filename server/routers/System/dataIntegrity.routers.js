import express from 'express';
import {
  getDataIntegrityAccount,
  getDataIntegrityReport,
  getDataIntegritySummary,
} from '../../controllers/System/dataIntegrity.controller.js';
import {
  getDataIntegrityAccessStatus,
  lockDataIntegrity,
  unlockDataIntegrity,
} from '../../controllers/System/dataIntegrityAccess.controller.js';
import { authenticateUser, requireRole } from '../../middleware/auth.middleware.js';
import { requireDataIntegrityPin } from '../../middleware/dataIntegrityAccess.middleware.js';

const router = express.Router();
router.use(authenticateUser);
router.use(requireRole('admin', 'super_admin'));

router.get('/access-session', getDataIntegrityAccessStatus);
router.post('/unlock', unlockDataIntegrity);
router.post('/lock', lockDataIntegrity);

router.use(requireDataIntegrityPin);
router.get('/', getDataIntegrityReport);
router.get('/summary', getDataIntegritySummary);
router.get('/accounts/:accountId', getDataIntegrityAccount);

export default router;
