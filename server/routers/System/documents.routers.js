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

const router = express.Router();

router.get('/getDocuments', getDocuments);
router.get('/getTemplates', getTemplates);
router.post('/addDocument', addDocument);
router.post('/addTemplate', addTemplate);
router.delete('/deleteDocument/:id', deleteDocument);
router.delete('/deleteTemplate/:id', deleteTemplate);
router.put('/editDocument/:id', editDocument);
router.put('/editTemplate/:id', editTemplate);

export default router;

