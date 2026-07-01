import express from 'express'
import {
  getAccreditedSellers,
  getParentSellerOptions,
} from '../../controllers/System/accredited.controller.js'

const router = express.Router()

router.get('/', getAccreditedSellers)
router.get('/parents', getParentSellerOptions)

export default router
