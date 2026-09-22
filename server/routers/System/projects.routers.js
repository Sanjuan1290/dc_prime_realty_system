import express from 'express';
import {
  authenticateUser,
  requireCurrentPassword,
  requirePermission,
  requireExactRole,
  requireProjectAccessById,
  requireProjectAccessBySlug,
} from '../../middleware/auth.middleware.js';
import { PERMISSIONS, roleHasPermission } from '../../config/permissions.js';

import {
  getSystemDashboardSummary,
  getLotProjects,
  getLotProjectOptions,
  getLotProjectDocumentCompliance,
  getLotProjectBySlug,
  createLotProject,
  preflightLotProjectUpdate,
  updateLotProject,
  toggleLotProjectStatus,
  deleteLotProject,
} from '../../controllers/System/projects.controller.js';

import {
  getSystemReports,
  auditSystemReportExport,
} from '../../controllers/System/reports.controller.js';
import {
  getLotProjectDashboard,
  getLotProjectPriceList,
  auditLotProjectPriceListPrint,
} from '../../controllers/Lot_Projects/Dashboard/Dashboard.controller.js';
import {
  getLotProjectListings,
  createLotProjectListing,
  updateLotProjectListing,
  deleteLotProjectListing,
} from '../../controllers/Lot_Projects/Listings/Listings.controller.js';
import {
  validateLotProjectListingImport,
  importLotProjectListings,
  getLotProjectListingImports,
  getLotProjectListingImportBatch,
  revertLotProjectListingImport,
} from '../../controllers/Lot_Projects/Listings/ListingImports.controller.js';
import {
  getLotProjectListingProfile,
  requestLotProjectListingCommissionAdjustmentCode,
  adjustLotProjectListingCommission,
  holdLotProjectListing,
  unholdLotProjectListing,
} from '../../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js';
import { updateLotProjectClientProfile } from '../../controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js';
import { reserveLotProjectListing } from '../../controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js';
import {
  getReservationCorrectionOptions,
  previewReservationCorrection,
  requestControlledReservationCorrectionCode,
  correctReservationUnit,
} from '../../controllers/Lot_Projects/ListingProfile/ReservationCorrection.controller.js';
import {
  createBuyerFormLink,
  getBuyerFormState,
  rejectBuyerFormSubmission,
  revokeBuyerFormLink,
} from '../../controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js';
import {
  updateLotProjectListingDocumentRequirements,
  createLotProjectDocumentUploadSignature,
  uploadLotProjectListingDocument,
  getLotProjectDocumentFileAccessUrl,
  getLotProjectDocumentFileContent,
  approveLotProjectListingDocument,
  requestLotProjectListingDocumentResubmission,
  clearLotProjectListingDocument,
} from '../../controllers/Lot_Projects/ListingProfile/Documents.controller.js';
import {
  getLotProjectListingPaymentPreflight,
  previewLotProjectListingPayment,
  createLotProjectListingPayment,
  requestLotProjectPaymentCorrectionCode,
  updateLotProjectListingPayment,
  deleteLotProjectListingPayment,
  updateLotProjectListingSoaTerms,
  waiveSeparateLegalMiscFee,
  grantPaymentSchedulePenaltyExtension,
  updatePaymentSchedulePenaltyExtension,
  correctPaymentSchedulePenalty,
  waivePaymentSchedulePenalty,
  restorePaymentSchedulePenaltyWaiver,
} from '../../controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js';
import { getLotProjectPaymentLogs } from '../../controllers/Lot_Projects/PaymentLogs/PaymentLogs.controller.js';
import {
  getLotProjectPaymentProofs,
  createLotProjectPaymentProofUploadSignature,
  saveLotProjectPaymentProofs,
  getLotProjectPaymentProofAccessUrl,
  getLotProjectPaymentProofContent,
  deleteLotProjectPaymentProof,
} from '../../controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js';
import {
  getLotProjectCommissions,
  updateLotProjectCommission,
} from '../../controllers/Lot_Projects/Commissions/Commissions.controller.js';
import {
  getLotProjectPaymentAcknowledgementSignedCopy,
  createLotProjectPaymentAcknowledgementSignedCopyUploadSignature,
  saveLotProjectPaymentAcknowledgementSignedCopy,
  getLotProjectPaymentAcknowledgementSignedCopyAccessUrl,
  getLotProjectPaymentAcknowledgementSignedCopyContent,
} from '../../controllers/Lot_Projects/ListingProfile/SignedAcknowledgement.controller.js';
import {
  getReservationAgents,
  getReservationCommissionPreviewController,
} from '../../controllers/Lot_Projects/Commissions/CommissionConfiguration.controller.js';
import {
  getLotProjectSettings,
  requestLotProjectSettingsCode,
  updateLotProjectSettings,
} from '../../controllers/Lot_Projects/Settings/Settings.controller.js';
import {
  getLotProjectListingAccountHistory,
  getLotProjectAccountPurgePreview,
  requestLotProjectAccountPurgeCode,
  purgeLotProjectAccount,
} from '../../controllers/Lot_Projects/Accounts/Accounts.controller.js';

const router = express.Router();

const requireCommissionActionPermission = (req, res, next) => {
  const action = String(req.body?.action || '').trim().toLowerCase();
  const permission = ['release', 'release_stage', 'set_agent_receipt_status'].includes(action)
    ? PERMISSIONS.LOT_COMMISSIONS_RELEASE
    : ['hold', 'hold_stage'].includes(action)
      ? PERMISSIONS.LOT_COMMISSIONS_HOLD
      : ['unhold', 'unhold_stage'].includes(action)
        ? PERMISSIONS.LOT_COMMISSIONS_UNHOLD
        : null;
  if (!permission || !roleHasPermission(req.authUser, permission)) {
    return res.status(403).json({ success: false, message: 'You do not have permission for this commission action.' });
  }
  return next();
};

router.use(authenticateUser);
router.param('projectSlug', requireProjectAccessBySlug);

router.get('/dashboard-summary', requirePermission(PERMISSIONS.SYSTEM_DASHBOARD_VIEW), getSystemDashboardSummary);
router.get('/reports', requirePermission(PERMISSIONS.SYSTEM_REPORTS_VIEW), getSystemReports);
router.post('/reports/export-audit', requirePermission(PERMISSIONS.SYSTEM_REPORTS_EXPORT), auditSystemReportExport);
router.get('/lot-projects', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_VIEW), getLotProjects);
router.get('/lot-projects/options', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_VIEW), getLotProjectOptions);
router.get('/lot-projects/document-compliance', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_VIEW), getLotProjectDocumentCompliance);
router.get('/lot-projects/:projectSlug/dashboard', requirePermission(PERMISSIONS.LOT_DASHBOARD_VIEW), getLotProjectDashboard);
router.get('/lot-projects/:projectSlug/price-list', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPriceList);
router.post('/lot-projects/:projectSlug/price-list/print-audit', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_PRINT_PRICE_LIST), auditLotProjectPriceListPrint);
router.get('/lot-projects/:projectSlug/listings', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectListings);
router.get('/lot-projects/:projectSlug/payment-logs', requirePermission(PERMISSIONS.LOT_PAYMENT_LOGS_VIEW), getLotProjectPaymentLogs);
router.get('/lot-projects/:projectSlug/commissions', requirePermission(PERMISSIONS.LOT_COMMISSIONS_VIEW), getLotProjectCommissions);
router.get('/lot-projects/:projectSlug/reservation-agents', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getReservationAgents);
router.get('/lot-projects/:projectSlug/commission-preview', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getReservationCommissionPreviewController);
router.patch('/lot-projects/:projectSlug/commissions/:commissionId', requireCommissionActionPermission, updateLotProjectCommission);
router.get('/lot-projects/:projectSlug/settings', requirePermission(PERMISSIONS.LOT_SETTINGS_VIEW), getLotProjectSettings);
router.put('/lot-projects/:projectSlug/settings', requirePermission(PERMISSIONS.LOT_SETTINGS_MANAGE), updateLotProjectSettings);
router.get('/lot-projects/:projectSlug/listings/:listingId', requirePermission(PERMISSIONS.LOT_LISTING_PROFILE_VIEW), getLotProjectListingProfile);
router.get('/lot-projects/:projectSlug/listings/:listingId/accounts', requirePermission(PERMISSIONS.LOT_ACCOUNT_HISTORY_VIEW), getLotProjectListingAccountHistory);
router.get('/lot-projects/:projectSlug/listings/:listingId/accounts/:accountId', requirePermission(PERMISSIONS.LOT_LISTING_PROFILE_VIEW), getLotProjectListingProfile);
router.get('/lot-projects/:projectSlug/accounts/:accountId/purge-preview', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), requireExactRole('super_admin'), getLotProjectAccountPurgePreview);
router.post('/lot-projects/:projectSlug/accounts/:accountId/purge-code', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), requireExactRole('super_admin'), requireCurrentPassword({ field: 'password', label: 'Administrator password' }), requestLotProjectAccountPurgeCode);
router.post('/lot-projects/:projectSlug/accounts/:accountId/purge', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), requireExactRole('super_admin'), purgeLotProjectAccount);
router.get('/lot-projects/:projectSlug/document-files/:fileId/access-url', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectDocumentFileAccessUrl);
router.get('/lot-projects/:projectSlug/document-files/:fileId/content', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectDocumentFileContent);
router.post(
  '/lot-projects/:projectSlug/listings/:listingId/commission-adjustment-code',
  requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE),
  requireExactRole('super_admin'),
  requireCurrentPassword({ field: 'password', label: 'Super Admin password' }),
  requestLotProjectListingCommissionAdjustmentCode
);
router.post(
  '/lot-projects/:projectSlug/listings/:listingId/adjust-commission',
  requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE),
  requireExactRole('super_admin'),
  adjustLotProjectListingCommission
);
router.get('/lot-projects/:projectSlug', requirePermission(PERMISSIONS.LOT_PROJECT_VIEW), getLotProjectBySlug);

router.post('/lot-projects', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_CREATE), createLotProject);
router.post('/lot-projects/:id/edit-preflight', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_EDIT), requireProjectAccessById('id'), preflightLotProjectUpdate);
router.put('/lot-projects/:id', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_EDIT), requireProjectAccessById('id'), updateLotProject);
router.patch('/lot-projects/:id/status', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_EDIT), requireProjectAccessById('id'), toggleLotProjectStatus);
router.delete('/lot-projects/:id', requirePermission(PERMISSIONS.SYSTEM_PROJECTS_DELETE), requireProjectAccessById('id'), deleteLotProject);

router.post('/lot-projects/:projectSlug/listing-imports/validate', requirePermission(PERMISSIONS.LOT_LISTINGS_IMPORT), validateLotProjectListingImport);
router.post('/lot-projects/:projectSlug/listing-imports', requirePermission(PERMISSIONS.LOT_LISTINGS_IMPORT), importLotProjectListings);
router.get('/lot-projects/:projectSlug/listing-imports', requirePermission(PERMISSIONS.LOT_LISTINGS_IMPORT), getLotProjectListingImports);
router.get('/lot-projects/:projectSlug/listing-imports/:batchId', requirePermission(PERMISSIONS.LOT_LISTINGS_IMPORT), getLotProjectListingImportBatch);
router.post('/lot-projects/:projectSlug/listing-imports/:batchId/revert', requirePermission(PERMISSIONS.LOT_LISTINGS_IMPORT_UNDO), revertLotProjectListingImport);

router.post('/lot-projects/:projectSlug/listings', requirePermission(PERMISSIONS.LOT_LISTINGS_CREATE), createLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId', requirePermission(PERMISSIONS.LOT_LISTINGS_EDIT), updateLotProjectListing);
router.delete('/lot-projects/:projectSlug/listings/:listingId', requirePermission(PERMISSIONS.LOT_LISTINGS_DELETE), deleteLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/client-profile', requirePermission(PERMISSIONS.LOT_BUYER_PROFILE_EDIT), updateLotProjectClientProfile);
router.post('/lot-projects/:projectSlug/listings/:listingId/reserve', requirePermission(PERMISSIONS.LOT_RESERVATIONS_CREATE), reserveLotProjectListing);
router.get('/lot-projects/:projectSlug/listings/:listingId/reservation-correction', requirePermission(PERMISSIONS.LOT_RESERVATION_CORRECT), getReservationCorrectionOptions);
router.post('/lot-projects/:projectSlug/listings/:listingId/reservation-correction/preview', requirePermission(PERMISSIONS.LOT_RESERVATION_CORRECT), previewReservationCorrection);
router.post('/lot-projects/:projectSlug/listings/:listingId/reservation-correction/code', requirePermission(PERMISSIONS.LOT_RESERVATION_CORRECT), requireExactRole('super_admin'), requireCurrentPassword({ field: 'password', label: 'Super Admin password' }), requestControlledReservationCorrectionCode);
router.post('/lot-projects/:projectSlug/listings/:listingId/reservation-correction', requirePermission(PERMISSIONS.LOT_RESERVATION_CORRECT), correctReservationUnit);
router.get('/lot-projects/:projectSlug/listings/:listingId/buyer-form', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getBuyerFormState);
router.post('/lot-projects/:projectSlug/listings/:listingId/buyer-form-links', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), createBuyerFormLink);
router.post('/lot-projects/:projectSlug/listings/:listingId/buyer-form-links/:linkId/revoke', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), revokeBuyerFormLink);
router.post('/lot-projects/:projectSlug/listings/:listingId/buyer-form-submissions/:submissionId/reject', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), rejectBuyerFormSubmission);
router.patch('/lot-projects/:projectSlug/listings/:listingId/hold', requirePermission(PERMISSIONS.LOT_LISTINGS_EDIT), holdLotProjectListing);
router.patch('/lot-projects/:projectSlug/listings/:listingId/unhold', requirePermission(PERMISSIONS.LOT_LISTINGS_EDIT), unholdLotProjectListing);
router.put('/lot-projects/:projectSlug/listings/:listingId/document-requirements', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), updateLotProjectListingDocumentRequirements);
router.post('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload-signature', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), createLotProjectDocumentUploadSignature);
router.put('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/upload', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), uploadLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/approve', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), approveLotProjectListingDocument);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/resubmission', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), requestLotProjectListingDocumentResubmission);
router.patch('/lot-projects/:projectSlug/listings/:listingId/documents/:documentId/clear', requirePermission(PERMISSIONS.LOT_BUYER_DOCUMENTS_UPDATE), clearLotProjectListingDocument);
router.put('/lot-projects/:projectSlug/listings/:listingId/soa-terms', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), updateLotProjectListingSoaTerms);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/preflight', requirePermission(PERMISSIONS.LOT_PAYMENTS_CREATE), getLotProjectListingPaymentPreflight);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/preview', requirePermission(PERMISSIONS.LOT_PAYMENTS_CREATE), previewLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments', requirePermission(PERMISSIONS.LOT_PAYMENTS_CREATE), createLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/correction-code', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), requireExactRole('super_admin'), requireCurrentPassword({ field: 'password', label: 'Super Admin password' }), requestLotProjectPaymentCorrectionCode);
router.put('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId', requirePermission(PERMISSIONS.LOT_LISTINGS_MANAGE), requireExactRole('super_admin'), updateLotProjectListingPayment);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/delete', requirePermission(PERMISSIONS.LOT_PAYMENT_DELETE), requireExactRole('super_admin'), deleteLotProjectListingPayment);
router.get('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/proofs', requirePermission(PERMISSIONS.LOT_PAYMENTS_VIEW), getLotProjectPaymentProofs);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/proofs/upload-signature', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), createLotProjectPaymentProofUploadSignature);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/proofs', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), saveLotProjectPaymentProofs);
router.get('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/proofs/:proofId/access-url', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPaymentProofAccessUrl);
router.get('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/proofs/:proofId/content', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPaymentProofContent);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/proofs/:proofId/delete', requirePermission(PERMISSIONS.LOT_PAYMENT_DELETE), deleteLotProjectPaymentProof);
router.get('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/acknowledgement-signed-copy', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPaymentAcknowledgementSignedCopy);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/acknowledgement-signed-copy/upload-signature', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), createLotProjectPaymentAcknowledgementSignedCopyUploadSignature);
router.post('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/acknowledgement-signed-copy', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), saveLotProjectPaymentAcknowledgementSignedCopy);
router.get('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/acknowledgement-signed-copy/access-url', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPaymentAcknowledgementSignedCopyAccessUrl);
router.get('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId/acknowledgement-signed-copy/content', requirePermission(PERMISSIONS.LOT_LISTINGS_VIEW), getLotProjectPaymentAcknowledgementSignedCopyContent);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/lmf-waiver', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), waiveSeparateLegalMiscFee);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-extension', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), grantPaymentSchedulePenaltyExtension);
router.put('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-extension/:reliefId', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), updatePaymentSchedulePenaltyExtension);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-correction', requirePermission(PERMISSIONS.LOT_PENALTY_CORRECT), correctPaymentSchedulePenalty);
router.post('/lot-projects/:projectSlug/listings/:listingId/payment-schedules/:scheduleId/penalty-waiver', requirePermission(PERMISSIONS.LOT_PAYMENTS_EDIT), waivePaymentSchedulePenalty);
router.post('/lot-projects/:projectSlug/listings/:listingId/penalty-reliefs/:reliefId/restore', requirePermission(PERMISSIONS.LOT_PENALTY_CORRECT), restorePaymentSchedulePenaltyWaiver);

export default router;
