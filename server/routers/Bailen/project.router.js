
import express from 'express'
import { getBailenProject, getBailenCadastralLotNumbers, getBailenDocuments, 
    editBailenProject } from '../../controllers/Bailen/project.controller.js'

const router = express.Router()

router.get('/getProject', getBailenProject)
router.get('/getCadastralLotNumber', getBailenCadastralLotNumbers)
router.get('/getDocuments', getBailenDocuments)
router.patch('/edit', editBailenProject)


export default router