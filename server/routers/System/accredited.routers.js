import express from 'express';
import {
  getAccredited,
  getParentSellers,
  getAccreditedSellerProofOfIncomeData,
  createAccreditedSellerProofOfIncomeReceipt,
  uploadAccreditedSellerProofOfIncome,
} from '../../controllers/System/accredited.controller.js';

const router = express.Router();

router.get('/', getAccredited);
router.get('/parents', getParentSellers);
router.get('/:sellerId/proof-of-income-receipts', getAccreditedSellerProofOfIncomeData);
router.post('/:sellerId/proof-of-income-receipts', createAccreditedSellerProofOfIncomeReceipt);
router.post('/:sellerId/proof-of-income', uploadAccreditedSellerProofOfIncome);

export default router;


