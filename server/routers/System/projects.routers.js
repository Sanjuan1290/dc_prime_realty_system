import express from 'express';

import {
  getLotProjects,
  getLotProjectOptions,
  getLotProjectBySlug,
  getLotProjectDashboard,
  getLotProjectListings,
  getLotProjectListingProfile,
  updateLotProjectClientProfile,
  createLotProjectListing,
  updateLotProjectListing,
  createLotProject,
  updateLotProject,
  toggleLotProjectStatus,
  deleteLotProject,
} from '../../controllers/System/projects.controller.js';

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

router.put('/lot-projects/:id', updateLotProject);
router.patch('/lot-projects/:id/status', toggleLotProjectStatus);
router.delete('/lot-projects/:id', deleteLotProject);

export default router;
