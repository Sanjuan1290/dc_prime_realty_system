import express from 'express';
import {
  getAccredited,
  getParentSellers,
  uploadAccreditedSellerProofOfIncome,
} from '../../controllers/System/accredited.controller.js';

const router = express.Router();

router.get('/', getAccredited);
router.get('/parents', getParentSellers);
router.post('/:sellerId/proof-of-income', uploadAccreditedSellerProofOfIncome);

export default router;

