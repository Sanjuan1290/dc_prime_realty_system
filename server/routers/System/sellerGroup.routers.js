import express from 'express';
import {
  createGroup,
  getGroups,
  getGroupOptions,
  editGroup,
  toggleGroupStatus,
  viewGroup,
  editUserRate,
} from '../../controllers/System/sellerGroup.controller.js';

const router = express.Router();

router.get('/', getGroups);
router.get('/options', getGroupOptions);
router.post('/create', createGroup);
router.put('/edit/:id', editGroup);
router.patch('/toggle-status/:id', toggleGroupStatus);
router.get('/:id', viewGroup);
router.patch('/:groupId/members/:accreditedSellerId/rates', editUserRate);

export default router;
