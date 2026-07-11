import express from 'express';
import { requireAdmin, requireAuth, requirePasswordChanged, requireSuperAdmin } from '../../middleware/auth.middleware.js';
import { passwordRateLimiter, sensitiveActionRateLimiter } from '../../middleware/rateLimit.middleware.js';

import {
  getLotProjects,
  getLotProjectOptions,
  getLotProjectBySlug,
  createLotProject,
  updateLotProject,
  toggleLotProjectStatus,
  deleteLotProject,
} from '../../controllers/System/projects.controller.js';

import {
  getLotProjectDashboard,
  getLotProjectPriceList,
} from '../../controllers/Lot_Projects/Dashboard/Dashboard.controller.js';
import {
  getLotProjectListings,
  createLotProjectListing,
  updateLotProjectListing,
  deleteLotProjectListing,
} from '../../controllers/Lot_Projects/Listings/Listings.controller.js';
import {
  getLotProjectListingProfile,
  holdLotProjectListing,
  unholdLotProjectListing,
} from '../../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js';
import { updateLotProjectClientProfile } from '../../controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js';
import { reserveLotProjectListing } from '../../controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js';
import {
  updateLotProjectListingDocumentRequirements,
  uploadLotProjectListingDocument,
  approveLotProjectListingDocument,
  clearLotProjectListingDocument,
} from '../../controllers/Lot_Projects/ListingProfile/Documents.controller.js';
import {
  createLotProjectListingPayment,
  updateLotProjectListingPayment,
  deleteLotProjectListingPayment,
  updateLotProjectListingSoaTerms,
} from '../../controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js';
import { getLotProjectPaymentLogs } from '../../controllers/Lot_Projects/PaymentLogs/PaymentLogs.controller.js';
import {
  getLotProjectCommissions,
  updateLotProjectCommission,
} from '../../controllers/Lot_Projects/Commissions/Commissions.controller.js';
import {
  getLotProjectSettings,
  updateLotProjectSettings,
} from '../../controllers/Lot_Projects/Settings/Settings.controller.js';

const router = express.Router();

router.use(requireAuth, requirePasswordChanged, requireAdmin);

router.get('/lot-projects', getLotProjects);
router.get('/lot-projects/options', getLotProjectOptions);
router.get('/lot-projects/:projectSlug/dashboard', getLotProjectDashboard);
router.get('/lot-projects/:projectSlug/price-list', getLotProjectPriceList);
router.get('/lot-projects/:projectSlug/listings', getLotProjectListings);
router.get('/lot-projects/:projectSlug/payment-logs', getLotProjectPaymentLogs);
router.get('/lot-projects/:projectSlug/commissions', getLotProjectCommissions);
router.patch('/lot-projects/:projectSlug/commissions/:commissionId', sensitiveActionRateLimiter, updateLotProjectCommission);
router.get('/lot-projects/:projectSlug/settings', getLotProjectSettings);
router.put('/lot-projects/:projectSlug/settings', requireSuperAdmin, sensitiveActionRateLimiter, updateLotProjectSettings);
router.get('/lot-projects/:projectSlug/listings/:listingId', getLotProjectListingProfile);
router.get('/lot-projects/:projectSlug', getLotProjectBySlug);

router.post('/lot-projects', sensitiveActionRateLimiter, createLotProject);
router.post('/lot-projects/:projectSlug/listings', sensitiveActionRateLimiter, createLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId', sensitiveActionRateLimiter, updateLotProjectListing);
router.delete('/lot-projects/:projectSlug/listings/:listingId', sensitiveActionRateLimiter, deleteLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/client-profile', sensitiveActionRateLimiter, updateLotProjectClientProfile);
router.post('/lot-projects/:projectSlug/listings/:listingId/reserve', sensitiveActionRateLimiter, reserveLotProjectListing);
router.patch('/lot-projects/:projectSlug/listings/:listingId/hold', sensitiveActionRateLimiter, holdLotProjectListing);
router.patch('/lot-projects/:projectSlug/listings/:listingId/unhold', sensitiveActionRateLimiter, unholdLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/document-requirements', sensitiveActionRateLimiter, updateLotProjectListingDocumentRequirements);
router.put('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload', sensitiveActionRateLimiter, uploadLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/approve', sensitiveActionRateLimiter, approveLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/clear', sensitiveActionRateLimiter, clearLotProjectListingDocument);
router.put('/lot-projects/:projectSlug/listings/:listingId/soa-terms', sensitiveActionRateLimiter, updateLotProjectListingSoaTerms);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments', sensitiveActionRateLimiter, createLotProjectListingPayment);
router.put('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId', sensitiveActionRateLimiter, updateLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/delete', passwordRateLimiter, deleteLotProjectListingPayment);

router.put('/lot-projects/:id', sensitiveActionRateLimiter, updateLotProject);
router.patch('/lot-projects/:id/status', sensitiveActionRateLimiter, toggleLotProjectStatus);
router.delete('/lot-projects/:id', requireSuperAdmin, passwordRateLimiter, deleteLotProject);

export default router;
