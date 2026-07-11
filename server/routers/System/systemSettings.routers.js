import express from 'express';
import {
  getSystemSettings,
  updateSystemSettings,
} from '../../controllers/System/systemSettings.controller.js';

const router = express.Router();

router.get('/', getSystemSettings);
router.put('/', updateSystemSettings);

export default router;

