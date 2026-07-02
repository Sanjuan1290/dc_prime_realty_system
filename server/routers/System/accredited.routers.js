import express from 'express';
import {
  getAccredited,
  getParentSellers,
} from '../../controllers/System/accredited.controller.js';

const router = express.Router();

router.get('/', getAccredited);
router.get('/parents', getParentSellers);

export default router;
