import express from 'express'
import { getPublicSystemStatus } from '../controllers/System/publicSystemStatus.controller.js'

const router = express.Router()

router.get('/', getPublicSystemStatus)

export default router

