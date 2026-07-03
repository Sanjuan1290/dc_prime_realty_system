import express from 'express';
import { createListing, getCreateOptions, getListings } from '../../controllers/BailenProject/listings.controller.js';
const router = express.Router();
router.get('/', getListings);
router.get('/create-options', getCreateOptions);
router.post('/', createListing);
export default router;
