import express from 'express';

import {
  getLotProjects,
  getLotProjectOptions,
  getLotProjectBySlug,
  getLotProjectDashboard,
  getLotProjectListings,
  getLotProjectListingProfile,
  getLotProjectListingPrintPayload,
  createLotProjectListing,
  createLotProject,
  updateLotProject,
  updateLotProjectListingStatus,
  updateLotProjectClientProfile,
  addLotProjectPayment,
  uploadLotProjectClientDocument,
  updateLotProjectClientDocumentStatus,
  clearLotProjectClientDocument,
  toggleLotProjectStatus,
  deleteLotProject,
} from '../../controllers/System/projects.controller.js';

const router = express.Router();

router.get('/lot-projects', getLotProjects);
router.get('/lot-projects/options', getLotProjectOptions);
router.get('/lot-projects/:projectSlug/dashboard', getLotProjectDashboard);
router.get('/lot-projects/:projectSlug/listings', getLotProjectListings);
router.get('/lot-projects/:projectSlug/listings/:listingId/print', getLotProjectListingPrintPayload);
router.get('/lot-projects/:projectSlug/listings/:listingId', getLotProjectListingProfile);
router.get('/lot-projects/:projectSlug', getLotProjectBySlug);

router.post('/lot-projects', createLotProject);
router.post('/lot-projects/:projectSlug/listings', createLotProjectListing);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments', addLotProjectPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload', uploadLotProjectClientDocument);

router.put('/lot-projects/:id', updateLotProject);
router.put('/lot-projects/:projectSlug/listings/:listingId/status', updateLotProjectListingStatus);
router.put('/lot-projects/:projectSlug/listings/:listingId/client-profile', updateLotProjectClientProfile);

router.patch('/lot-projects/:id/status', toggleLotProjectStatus);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/status', updateLotProjectClientDocumentStatus);

router.delete('/lot-projects/:id', deleteLotProject);
router.delete('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload', clearLotProjectClientDocument);

export default router;
