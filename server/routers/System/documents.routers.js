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
import { authenticateUser, requirePermission } from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

const router = express.Router();
router.use(authenticateUser);

router.get('/getDocuments', requirePermission(PERMISSIONS.SYSTEM_DOCUMENTS_VIEW), getDocuments);
router.get('/getTemplates', requirePermission(PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_VIEW), getTemplates);
router.post('/addDocument', requirePermission(PERMISSIONS.SYSTEM_DOCUMENTS_CREATE), addDocument);
router.post('/addTemplate', requirePermission(PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_CREATE), addTemplate);
router.delete('/deleteDocument/:id', requirePermission(PERMISSIONS.SYSTEM_DOCUMENTS_DELETE), deleteDocument);
router.delete('/deleteTemplate/:id', requirePermission(PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_DELETE), deleteTemplate);
router.put('/editDocument/:id', requirePermission(PERMISSIONS.SYSTEM_DOCUMENTS_EDIT), editDocument);
router.put('/editTemplate/:id', requirePermission(PERMISSIONS.SYSTEM_DOCUMENT_TEMPLATES_EDIT), editTemplate);

export default router;

