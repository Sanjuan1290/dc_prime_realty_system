import express from 'express';

import {
  getLotProjects,
  getLotProjectOptions,
  getLotProjectBySlug,
  createLotProject,
  updateLotProject,
  toggleLotProjectStatus,
  deleteLotProject,
} from '../../controllers/System/projects.controller.js';

import { getLotProjectDashboard } from '../../controllers/Lot_Projects/Dashboard/Dashboard.controller.js';
import {
  getLotProjectListings,
  createLotProjectListing,
  updateLotProjectListing,
} from '../../controllers/Lot_Projects/Listings/Listings.controller.js';
import { getLotProjectListingProfile } from '../../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js';
import { updateLotProjectClientProfile } from '../../controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js';
import { reserveLotProjectListing } from '../../controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js';
import {
  uploadLotProjectListingDocument,
  approveLotProjectListingDocument,
  clearLotProjectListingDocument,
} from '../../controllers/Lot_Projects/ListingProfile/Documents.controller.js';
import {
  createLotProjectListingPayment,
  updateLotProjectListingPayment,
  deleteLotProjectListingPayment,
} from '../../controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js';

const router = express.Router();

router.get('/lot-projects', getLotProjects);
router.get('/lot-projects/options', getLotProjectOptions);
router.get('/lot-projects/:projectSlug/dashboard', getLotProjectDashboard);
router.get('/lot-projects/:projectSlug/listings', getLotProjectListings);
router.get('/lot-projects/:projectSlug/listings/:listingId', getLotProjectListingProfile);
router.get('/lot-projects/:projectSlug', getLotProjectBySlug);

router.post('/lot-projects', createLotProject);
router.post('/lot-projects/:projectSlug/listings', createLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId', updateLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/client-profile', updateLotProjectClientProfile);
router.post('/lot-projects/:projectSlug/listings/:listingId/reserve', reserveLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload', uploadLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/approve', approveLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/clear', clearLotProjectListingDocument);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments', createLotProjectListingPayment);
router.put('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId', updateLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/delete', deleteLotProjectListingPayment);

router.put('/lot-projects/:id', updateLotProject);
router.patch('/lot-projects/:id/status', toggleLotProjectStatus);
router.delete('/lot-projects/:id', deleteLotProject);

export default router;
