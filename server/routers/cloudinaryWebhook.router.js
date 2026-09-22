import express from 'express';
import { handleCloudinaryMalwareWebhook } from '../controllers/System/cloudinaryWebhook.controller.js';

const router = express.Router();
router.post('/malware', handleCloudinaryMalwareWebhook);

export default router;
