
import express from 'express'
import { login, getMe } from '../controllers/users.controllers.js'

const router = express.Router()

router.post('/login', login)
router.get('/me', getMe)

export default router