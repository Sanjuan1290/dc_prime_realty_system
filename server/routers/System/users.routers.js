import express from 'express'
import {
  login,
  getMe,
  getUsers,
  createUser,
  editUser,
  updateUserStatus,
} from '../../controllers/System/users.controllers.js'

const router = express.Router()

router.post('/login', login)
router.get('/me', getMe)

router.get('/list', getUsers)
router.post('/create', createUser)
router.put('/edit/:id', editUser)
router.patch('/status/:id', updateUserStatus)

export default router
