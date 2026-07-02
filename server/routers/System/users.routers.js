import express from 'express'
import {
  login,
  logout,
  getMe,
} from '../../controllers/System/users.controllers.js'

const router = express.Router()

router.post('/login', login)
router.post('/logout', logout)
router.get('/me', getMe)

export default router
