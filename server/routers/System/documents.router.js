import express from 'express'
import { 
    getDocuments,
    getTemplates,
    addDocument,
    addTemplate,
    editDocument,
    editTemplate,
    deleteDocument,
    deleteTemplate,
} from '../../controllers/System/documents.controller.js'

const router = express.Router()

router.get('/getDocuments', getDocuments)
router.get('/getTemplates', getTemplates)

router.post('/addDocument', addDocument)
router.post('/addTemplate', addTemplate)

router.put('/editDocument/:document_id', editDocument)
router.put('/editTemplate/:template_id', editTemplate)

router.delete('/deleteDocument/:document_id', deleteDocument)
router.delete('/deleteTemplate/:template_id', deleteTemplate)

export default router