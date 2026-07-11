import express from 'express';
import {
  getDocuments,
  getTemplates,
  addDocument,
  addTemplate,
  deleteDocument,
  deleteTemplate,
  editDocument,
  editTemplate,
} from '../../controllers/System/documents.controller.js';
import { requireAdmin, requireAuth, requirePasswordChanged } from '../../middleware/auth.middleware.js';
import { sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/getDocuments', getDocuments);
router.get('/getTemplates', getTemplates);
router.post('/addDocument', sensitiveActionRateLimiter, addDocument);
router.post('/addTemplate', sensitiveActionRateLimiter, addTemplate);
router.delete('/deleteDocument/:id', sensitiveActionRateLimiter, deleteDocument);
router.delete('/deleteTemplate/:id', sensitiveActionRateLimiter, deleteTemplate);
router.put('/editDocument/:id', sensitiveActionRateLimiter, editDocument);
router.put('/editTemplate/:id', sensitiveActionRateLimiter, editTemplate);

export default router;
