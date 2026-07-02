import express from 'express';
import {
  login,
  logout,
  getMe,
  getUsers,
  createUser,
  editUser,
  toggleUserStatus,
  resetUserPassword,
} from '../../controllers/System/users.controllers.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.get('/me', getMe);

router.get('/getUsers', getUsers);
router.post('/createUser', createUser);
router.put('/editUser/:id', editUser);
router.patch('/toggleUserStatus/:id', toggleUserStatus);
router.patch('/resetPassword/:id', resetUserPassword);

export default router;
