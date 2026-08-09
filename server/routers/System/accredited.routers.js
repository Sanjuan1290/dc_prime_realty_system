import express from 'express';
import {
  getAccredited,
  getParentSellers,
  getAccreditedSellerProofOfIncomeData,
  getAccreditedSellerIncomeRangeReport,
  createAccreditedSellerProofOfIncomeReceipt,
  uploadAccreditedSellerProofOfIncome,
} from '../../controllers/System/accredited.controller.js';
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), getAccredited);
router.get('/parents', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), getParentSellers);
router.get('/:sellerId/proof-of-income-receipts', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), getAccreditedSellerProofOfIncomeData);
router.get('/:sellerId/income-range', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_VIEW), getAccreditedSellerIncomeRangeReport);
router.post('/:sellerId/proof-of-income-receipts', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_MANAGE), createAccreditedSellerProofOfIncomeReceipt);
router.post('/:sellerId/proof-of-income', requirePermission(PERMISSIONS.SYSTEM_ACCREDITED_MANAGE), uploadAccreditedSellerProofOfIncome);

export default router;

