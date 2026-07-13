import express from 'express';
import {
  authenticateUser,
  requireCurrentPassword,
  requirePermission,
  requireRole,
} from '../../middleware/auth.middleware.js';
import { PERMISSIONS } from '../../config/permissions.js';

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
  recalculateLotProjectListingCommission,
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
  grantPaymentSchedulePenaltyExtension,
  updatePaymentSchedulePenaltyExtension,
  correctPaymentSchedulePenalty,
  waivePaymentSchedulePenalty,
  restorePaymentSchedulePenaltyWaiver,
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
router.use(authenticateUser);

router.get('/lot-projects', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_VIEW), getLotProjects);
router.get('/lot-projects/options', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_VIEW), getLotProjectOptions);
router.get('/lot-projects/:projectSlug/dashboard', requirePermission(PERMISSIONS.LOT_DASHBOARD_VIEW), getLotProjectDashboard);
router.get('/lot-projects/:projectSlug/price-list', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPriceList);
router.get('/lot-projects/:projectSlug/listings', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectListings);
router.get('/lot-projects/:projectSlug/payment-logs', requirePermission(PERMISSIONS.LOT_PAYMENT_LOGS_VIEW), getLotProjectPaymentLogs);
router.get('/lot-projects/:projectSlug/commissions', requirePermission(PERMISSIONS.LOT_COMMISSIONS_VIEW), getLotProjectCommissions);
router.patch('/lot-projects/:projectSlug/commissions/:commissionId', requirePermission(PERMISSIONS.LOT_COMMISSIONS_MANAGE), updateLotProjectCommission);
router.get('/lot-projects/:projectSlug/settings', requirePermission(PERMISSIONS.LOT_SETTINGS_VIEW), getLotProjectSettings);
router.put('/lot-projects/:projectSlug/settings', requirePermission(PERMISSIONS.LOT_SETTINGS_MANAGE), updateLotProjectSettings);
router.get('/lot-projects/:projectSlug/listings/:listingId', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectListingProfile);
router.post(
  '/lot-projects/:projectSlug/listings/:listingId/recalculate-commission',
  requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE),
  requireRole('super_admin'),
  requireCurrentPassword({ field: 'password', label: 'Super Admin password' }),
  recalculateLotProjectListingCommission
);
router.get('/lot-projects/:projectSlug', requirePermission(PERMISSIONS.LOT_PROJECT_VIEW), getLotProjectBySlug);

router.post('/lot-projects', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_MANAGE), createLotProject);
router.put('/lot-projects/:id', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_MANAGE), updateLotProject);
router.patch('/lot-projects/:id/status', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_MANAGE), toggleLotProjectStatus);
router.delete('/lot-projects/:id', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_MANAGE), deleteLotProject);

router.post('/lot-projects/:projectSlug/listings', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), createLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), updateLotProjectListing);
router.delete('/lot-projects/:projectSlug/listings/:listingId', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), deleteLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/client-profile', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), updateLotProjectClientProfile);
router.post('/lot-projects/:projectSlug/listings/:listingId/reserve', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), reserveLotProjectListing);
router.patch('/lot-projects/:projectSlug/listings/:listingId/hold', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), holdLotProjectListing);
router.patch('/lot-projects/:projectSlug/listings/:listingId/unhold', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), unholdLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/document-requirements', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), updateLotProjectListingDocumentRequirements);
router.put('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), uploadLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/approve', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), approveLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/clear', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), clearLotProjectListingDocument);
router.put('/lot-projects/:projectSlug/listings/:listingId/soa-terms', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), updateLotProjectListingSoaTerms);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), createLotProjectListingPayment);
router.put('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), updateLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/delete', requirePermission(PERMISSIONS.LOT_PAYMENT_DELETE), deleteLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-extension', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), grantPaymentSchedulePenaltyExtension);
router.put('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-extension/:reliefId', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), updatePaymentSchedulePenaltyExtension);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-correction', requirePermission(PERMISSIONS.LOT_PENALTY_CORRECT), correctPaymentSchedulePenalty);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-waiver', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), waivePaymentSchedulePenalty);
router.post('/lot-projects/:projectSlug/listings/:listingId/penalty-reliefs/:reliefId/restore', requirePermission(PERMISSIONS.LOT_PENALTY_CORRECT), restorePaymentSchedulePenaltyWaiver);

export default router;
