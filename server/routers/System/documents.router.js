import express from 'express'
import {
  getDocuments,
  getTemplates,
} from '../../controllers/System/documents.controller.js'

const router = express.Router()

router.get('/', getDocuments)
router.get('/templates', getTemplates)

export default router