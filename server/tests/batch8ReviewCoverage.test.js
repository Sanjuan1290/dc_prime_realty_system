import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMMISSION_STAGE_HEAD_APPROVAL_BEFORE, REVIEW_ACTIONS } from '../config/reviewActions.js';
import { PERMISSIONS } from '../config/permissions.js';
import { getStaticRolePolicy } from '../config/rolePolicies.js';

const readProjectFile = (relativePath) => readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

const batch1SalesActions = Object.freeze({
  'reservation.create': { department: 'sales', entityType: 'lot_project_account', headApprovalBefore: false },
  'buyer_profile.edit': { department: 'sales', entityType: 'lot_project_client_profile', headApprovalBefore: false },
  'buyer_form.approve': { department: 'sales', entityType: 'lot_project_buyer_form', headApprovalBefore: false },
});

test('Batch 1 Sales review actions are registered with the confirmed department and entity type', () => {
  for (const [actionKey, expected] of Object.entries(batch1SalesActions)) {
    const actual = REVIEW_ACTIONS[actionKey];
    assert.ok(actual, `${actionKey} must be registered`);
    assert.equal(actual.department, expected.department, actionKey);
    assert.equal(actual.entityType, expected.entityType, actionKey);
    assert.equal(actual.headApprovalBefore, expected.headApprovalBefore, actionKey);
  }
});

test('reservation creation records both the reservation review and buyer-form approval review when applicable', async () => {
  const source = await readProjectFile('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  assert.match(source, /createOperationalReview\(connection, \{[\s\S]*actionKey: 'reservation\.create'/);
  assert.match(source, /createOperationalReview\(connection, \{[\s\S]*actionKey: 'buyer_form\.approve'/);
  assert.match(source, /entityType: 'lot_project_account'/);
  assert.match(source, /entityType: 'lot_project_buyer_form'/);
});

test('buyer-profile edits are review-tracked, reuse returned Staff reviews, and support Audit Case corrections', async () => {
  const source = await readProjectFile('server/controllers/Lot_Projects/ListingProfile/ClientProfile.controller.js');
  assert.match(source, /assertEntityNotReviewLocked\(connection, \{[\s\S]*entityType: 'lot_project_client_profile'/);
  assert.match(source, /actionKey: 'buyer_profile\.edit'/);
  assert.match(source, /getReturnedOperationalReviewForActor/);
  assert.match(source, /resubmitReturnedOperationalReview/);
  assert.match(source, /getPendingAuditCorrectionCase/);
  assert.match(source, /advanceAuditCaseToRecheck/);
});

test('buyer-form rejection uses the same buyer_form.approve decision review key', async () => {
  const source = await readProjectFile('server/controllers/Lot_Projects/BuyerForms/BuyerForms.controller.js');
  assert.match(source, /rejectBuyerFormSubmission/);
  assert.match(source, /assertEntityNotReviewLocked\(connection, \{[\s\S]*entityType: 'lot_project_buyer_form'/);
  assert.match(source, /actionKey: 'buyer_form\.approve'/);
});

test('Batch 1 adds no new Head-preapproval action, so governedAction authorization is not required for these keys', () => {
  for (const actionKey of Object.keys(batch1SalesActions)) {
    assert.equal(REVIEW_ACTIONS[actionKey].headApprovalBefore, false, actionKey);
  }
});

test('System Admin is owner-level: buyer-profile edits and routine reservation creation are both included', () => {
  const policy = getStaticRolePolicy('system_admin');
  assert.equal(policy.fullAccess, true);
  assert.equal(policy.required.includes(PERMISSIONS.LOT_BUYER_PROFILE_EDIT), true);
  assert.equal(policy.required.includes(PERMISSIONS.LOT_RESERVATIONS_CREATE), true);
});

test('Review Center links Batch 1 Sales entities and only exposes Correct & Confirm where a safe edit path exists', async () => {
  const source = await readProjectFile('client/src/pages/System/ReviewCenter.jsx');
  for (const entityType of ['lot_project_account', 'lot_project_client_profile', 'lot_project_buyer_form']) {
    assert.match(source, new RegExp(entityType));
  }
  assert.match(source, /buyer_profile_edit_review/);
  assert.match(source, /supportsRecordCorrection/);
  assert.match(source, /lot_project_account', 'lot_project_buyer_form/);
});


const batch2AccountingActions = Object.freeze({
  'payment_proof.verify': { department: 'accounting', entityType: 'lot_project_payment_proof', headApprovalBefore: false },
  'commission.release': { department: 'accounting', entityType: 'lot_project_commission', headApprovalBefore: false },
  'commission.hold': { department: 'accounting', entityType: 'lot_project_commission', headApprovalBefore: false },
  'commission.unhold': { department: 'accounting', entityType: 'lot_project_commission', headApprovalBefore: false },
  'signed_receipt.upload': { department: 'accounting', entityType: 'lot_project_signed_receipt', headApprovalBefore: false },
});

test('Batch 2 Accounting review actions are registered with the confirmed department and policy', () => {
  for (const [actionKey, expected] of Object.entries(batch2AccountingActions)) {
    const actual = REVIEW_ACTIONS[actionKey];
    assert.ok(actual, `${actionKey} must be registered`);
    assert.equal(actual.department, expected.department, actionKey);
    assert.equal(actual.entityType, expected.entityType, actionKey);
    assert.equal(actual.headApprovalBefore, expected.headApprovalBefore, actionKey);
  }
  assert.deepEqual(COMMISSION_STAGE_HEAD_APPROVAL_BEFORE, { release: false, hold: false, unhold: false });
});

test('commission release, hold, and unhold are review-tracked and create Accounting reviews before commit', async () => {
  const source = await readProjectFile('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  for (const key of ['commission.release', 'commission.hold', 'commission.unhold']) assert.match(source, new RegExp(key.replace('.', '\\.')));
  assert.match(source, /assertEntityNotReviewLocked\(connection, \{[\s\S]*entityType: 'lot_project_commission'/);
  assert.match(source, /createOperationalReview\(connection, \{[\s\S]*actionKey: reviewActionKey[\s\S]*department: 'accounting'/);
  assert.doesNotMatch(source, /authorizeGovernedAction/);
});

test('payment proof file changes use one canonical payment-scoped review and support returned/Audit Case corrections', async () => {
  const source = await readProjectFile('server/controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js');
  assert.match(source, /actionKey: 'payment_proof\.verify'/);
  assert.match(source, /entityType: 'lot_project_payment_proof'[\s\S]*entityId: paymentId/);
  assert.match(source, /assertEntityNotReviewLocked/);
  assert.match(source, /getReturnedOperationalReviewForActor/);
  assert.match(source, /resubmitReturnedOperationalReview/);
  assert.match(source, /getPendingAuditCorrectionCase/);
  assert.match(source, /advanceAuditCaseToRecheck/);
  assert.doesNotMatch(source, /authorizeGovernedAction/);
});

test('signed acknowledgement receipt upload/replacement is review-tracked and supports returned/Audit Case corrections', async () => {
  const source = await readProjectFile('server/controllers/Lot_Projects/ListingProfile/SignedAcknowledgement.controller.js');
  assert.match(source, /actionKey: 'signed_receipt\.upload'/);
  assert.match(source, /entityType: 'lot_project_signed_receipt'[\s\S]*entityId: paymentId/);
  assert.match(source, /assertEntityNotReviewLocked/);
  assert.match(source, /getReturnedOperationalReviewForActor/);
  assert.match(source, /resubmitReturnedOperationalReview/);
  assert.match(source, /getPendingAuditCorrectionCase/);
  assert.match(source, /advanceAuditCaseToRecheck/);
  assert.doesNotMatch(source, /authorizeGovernedAction/);
});

test('System Admin can reach signed-receipt corrections and, as an owner, commission release authority', () => {
  const policy = getStaticRolePolicy('system_admin');
  for (const key of [PERMISSIONS.LOT_PRINTOUTS_USE, PERMISSIONS.LOT_PAYMENTS_EDIT, PERMISSIONS.LOT_PAYMENT_DELETE, PERMISSIONS.LOT_COMMISSIONS_RELEASE, PERMISSIONS.LOT_COMMISSIONS_HOLD, PERMISSIONS.LOT_COMMISSIONS_UNHOLD]) {
    assert.equal(policy.required.includes(key), true, key);
  }
});

test('Review Center routes Batch 2 Accounting entities and keeps commission-stage reviews compensating-action only', async () => {
  const source = await readProjectFile('client/src/pages/System/ReviewCenter.jsx');
  for (const entityType of ['lot_project_commission', 'lot_project_payment_proof', 'lot_project_signed_receipt']) {
    assert.match(source, new RegExp(entityType));
  }
  assert.match(source, /payment_proof_review/);
  assert.match(source, /signed_receipt_review/);
  assert.match(source, /commission_stage_review/);
  assert.match(source, /lot_project_account', 'lot_project_buyer_form', 'lot_project_commission/);
});

test('Batch 2 correction links propagate review and Audit Case ids into proof and signed-receipt saves', async () => {
  const [paymentsSoa, proofModal, printouts, receipts, signedModal] = await Promise.all([
    readProjectFile('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx'),
    readProjectFile('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PaymentProofModal.jsx'),
    readProjectFile('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/Printouts.jsx'),
    readProjectFile('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/AcknowledgementReceiptsModal.jsx'),
    readProjectFile('client/src/components/Shared/SignedCopyUploadModal.jsx'),
  ]);
  assert.match(paymentsSoa, /workflowAction !== 'payment_proof_review'/);
  assert.match(proofModal, /workflowReviewId[\s\S]*workflowAuditCaseId[\s\S]*workflowPayload/);
  assert.match(printouts, /autoOpenAcknowledgements/);
  assert.match(receipts, /autoOpenPaymentId[\s\S]*workflowReviewId[\s\S]*workflowAuditCaseId/);
  assert.match(signedModal, /workflowPayload[\s\S]*auditCaseId/);
});

const finalOperationsActions = Object.freeze({
  'listing.create': { department: 'operations', entityType: 'lot_project_listing', headApprovalBefore: false },
  'listing.edit': { department: 'operations', entityType: 'lot_project_listing', headApprovalBefore: false },
  'listing.delete': { department: 'operations', entityType: 'lot_project_listing', headApprovalBefore: true },
  'listing.import': { department: 'operations', entityType: 'lot_project_listing_import', headApprovalBefore: false },
  'listing.import_undo': { department: 'operations', entityType: 'lot_project_listing_import', headApprovalBefore: false },
  'listing.documents.update': { department: 'operations', entityType: 'lot_project_listing', headApprovalBefore: false },
});

const finalMarketingActions = Object.freeze({
  'network.create': { department: 'marketing', entityType: 'seller_group', headApprovalBefore: false },
  'network.edit': { department: 'marketing', entityType: 'seller_group', headApprovalBefore: false },
  'network.status': { department: 'marketing', entityType: 'seller_group', headApprovalBefore: false },
  'network.rates.update': { department: 'marketing', entityType: 'seller_group_project_rates', headApprovalBefore: false },
  'network.members.import': { department: 'marketing', entityType: 'seller_group', headApprovalBefore: false },
  'seller.create': { department: 'marketing', entityType: 'accredited_seller', headApprovalBefore: false },
  'seller.edit': { department: 'marketing', entityType: 'accredited_seller', headApprovalBefore: false },
});

test('Final Operations and Marketing review keys are registered with the confirmed governance policy', () => {
  for (const [actionKey, expected] of Object.entries({ ...finalOperationsActions, ...finalMarketingActions })) {
    const actual = REVIEW_ACTIONS[actionKey];
    assert.ok(actual, `${actionKey} must be registered`);
    assert.equal(actual.department, expected.department, actionKey);
    assert.equal(actual.entityType, expected.entityType, actionKey);
    assert.equal(actual.headApprovalBefore, expected.headApprovalBefore, actionKey);
  }
});

test('Operations controllers record create/edit/delete/import/document reviews and pre-authorize hard delete', async () => {
  const [listings, imports, documents] = await Promise.all([
    readProjectFile('server/controllers/Lot_Projects/Listings/Listings.controller.js'),
    readProjectFile('server/controllers/Lot_Projects/Listings/ListingImports.controller.js'),
    readProjectFile('server/controllers/Lot_Projects/ListingProfile/Documents.controller.js'),
  ]);
  for (const key of ['listing.create', 'listing.edit', 'listing.delete']) assert.match(listings, new RegExp(key.replaceAll('.', '\\.')));
  assert.match(listings, /authorizeGovernedAction\(connection, \{[\s\S]*actionKey: 'listing\.delete'/);
  assert.match(listings, /assertEntityNotReviewLocked/);
  assert.match(listings, /createOperationalReview/);
  assert.doesNotMatch(listings, /review: governedReview \|\| inventoryReview,[\s\S]{0,160}review: listingReview/, 'inventory update response must not reference the create-only listingReview variable');
  for (const key of ['listing.import', 'listing.import_undo']) assert.match(imports, new RegExp(key.replaceAll('.', '\\.')));
  assert.match(imports, /entityType: 'lot_project_listing_import'/);
  assert.match(documents, /actionKey: 'listing\.documents\.update'/);
  assert.match(documents, /getPendingAuditCorrectionCase/);
});

test('Marketing controllers review Network/member/seller mutations and save project-rate changes before Head review', async () => {
  const [groups, users] = await Promise.all([
    readProjectFile('server/controllers/System/sellerGroup.controller.js'),
    readProjectFile('server/controllers/System/users.controllers.js'),
  ]);
  for (const key of ['network.create', 'network.edit', 'network.status', 'network.rates.update', 'network.members.import']) assert.match(groups, new RegExp(key.replaceAll('.', '\\.')));
  assert.match(groups, /authorizeGovernedAction\(connection, \{[\s\S]*actionKey: 'network\.rates\.update'/);
  assert.doesNotMatch(groups, /headApprovalPendingResponse/);
  assert.match(groups, /actionKey: 'network\.members\.import'[\s\S]*entityType: 'seller_group'/);
  for (const key of ['seller.create', 'seller.edit']) assert.match(users, new RegExp(key.replaceAll('.', '\\.')));
  assert.match(users, /entityType: 'accredited_seller'/);
  assert.match(users, /getPendingAuditCorrectionCase/);
  assert.match(users, /resubmitReturnedOperationalReview/);
});

// Intentional policy change: ordinary cross-department business permissions are
// explicit grants, so seller-management helpers now follow the permission rather
// than hard-coding the Marketing role name.
test('Marketing role policy allows Network and in-house seller administration and keeps Audit Review out of its default', async () => {
  const staff = getStaticRolePolicy('marketing_staff');
  const head = getStaticRolePolicy('marketing_head');
  for (const permission of [PERMISSIONS.SYSTEM_SELLER_GROUPS_VIEW, PERMISSIONS.SYSTEM_SELLER_GROUPS_MANAGE, PERMISSIONS.SYSTEM_USERS_CREATE, PERMISSIONS.SYSTEM_USERS_EDIT]) {
    assert.equal(staff.ceiling.includes(permission), true, permission);
    assert.equal(head.ceiling.includes(permission), true, permission);
  }
  const permissionsSource = await readProjectFile('server/config/permissions.js');
  assert.match(permissionsSource, /DEPARTMENT_STAFF_ROLES[\s\S]*DEPARTMENT_HEAD_ROLES[\s\S]*SELLER_USER_ROLES\.includes/);
  assert.match(permissionsSource, /SYSTEM_USERS_CREATE/);
  assert.match(permissionsSource, /SYSTEM_USERS_EDIT/);
  // Audit Review is not part of the Marketing default; granting it is possible but flagged.
  assert.equal(staff.recommended.includes(PERMISSIONS.WORKFLOW_AUDIT_REVIEW), false);
  assert.equal(head.recommended.includes(PERMISSIONS.WORKFLOW_AUDIT_REVIEW), false);
});

test('Marketing permission migration is idempotent and does not mutate existing per-user grants', async () => {
  const migration = await readProjectFile('server/migrations/20261006_batch7_marketing_network_permissions.sql');
  assert.match(migration, /INSERT INTO role_permission_defaults/);
  assert.match(migration, /marketing_staff/);
  assert.match(migration, /marketing_head/);
  assert.match(migration, /system\.seller_groups\.manage/);
  assert.match(migration, /system\.users\.create/);
  assert.match(migration, /system\.users\.edit/);
  assert.match(migration, /ON DUPLICATE KEY UPDATE/);
  assert.doesNotMatch(migration, /INSERT INTO user_permissions|UPDATE user_permissions|DELETE FROM user_permissions/);
  assert.match(migration, /Apply Latest Role Default/i);
});

test('Review Center routes Operations and Marketing records and marks destructive/import actions non-correctable', async () => {
  const source = await readProjectFile('client/src/pages/System/ReviewCenter.jsx');
  for (const entityType of ['lot_project_listing_import', 'seller_group', 'seller_group_project_rates', 'accredited_seller']) assert.match(source, new RegExp(entityType));
  for (const workflow of ['listing_documents_update_review', 'listing_import_review', 'network_rates_review', 'network_edit_review', 'seller_edit_review']) assert.match(source, new RegExp(workflow));
  for (const key of ['listing.delete', 'listing.import', 'listing.import_undo', 'network.members.import']) assert.match(source, new RegExp(key.replaceAll('.', '\\.')));
});


