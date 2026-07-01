import express from 'express'
import {
  getSellerGroups,
  getSellerGroupDetails,
  createSellerGroup,
  updateSellerGroup,
  updateSellerGroupStatus,
  updateMemberRates,
  getSellerGroupOptions,
} from '../../controllers/System/sellerGroup.controller.js'

const router = express.Router()

router.get('/', getSellerGroups)
router.get('/options', getSellerGroupOptions)
router.get('/:id', getSellerGroupDetails)
router.post('/create', createSellerGroup)
router.put('/edit/:id', updateSellerGroup)
router.patch('/status/:id', updateSellerGroupStatus)
router.patch('/:groupId/members/:memberId/rates', updateMemberRates)

export default router
