import express from 'express';
import { getCommissionDetails, getCommissions, releaseCommission } from '../../controllers/BailenProject/commissions.controller.js';
const router = express.Router();
router.get('/', getCommissions);
router.get('/:id', getCommissionDetails);
router.patch('/:id/releases/:releaseId/release', releaseCommission);
export default router;
