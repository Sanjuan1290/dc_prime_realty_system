import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PERMISSIONS, roleHasPermission } from '../config/permissions.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const projectRouter = read('server/routers/System/projects.routers.js');
const sellerGroupRouter = read('server/routers/System/sellerGroup.routers.js');
const paymentsController = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
const notificationsController = read('server/controllers/System/notifications.controller.js');
const reportsController = read('server/controllers/System/reports.controller.js');

const routeLine = (fragment) => projectRouter.split('\n').find((line) => line.includes(fragment)) || '';

test('system report export stays independent from report view', () => {
  assert.match(projectRouter, /router\.get\('\/reports', requirePermission\(PERMISSIONS\.SYSTEM_REPORTS_VIEW\)/);
  assert.match(projectRouter, /router\.post\('\/reports\/export-audit', requirePermission\(PERMISSIONS\.SYSTEM_REPORTS_EXPORT\)/);
  const viewer = { role: 'accounting', permissions: [PERMISSIONS.SYSTEM_REPORTS_VIEW] };
  assert.equal(roleHasPermission(viewer, PERMISSIONS.SYSTEM_REPORTS_VIEW), true);
  assert.equal(roleHasPermission(viewer, PERMISSIONS.SYSTEM_REPORTS_EXPORT), false);
});

test('listing import, listing edit, and reserve are independent backend permissions', () => {
  assert.match(routeLine("listing-imports/validate"), /LOT_LISTINGS_IMPORT/);
  assert.match(routeLine("router.put('/lot-projects/:projectSlug/listings/:listingId'"), /requireListingUpdatePermission/);
  assert.match(projectRouter, /const requireListingUpdatePermission[\s\S]*LOT_LISTINGS_EDIT/);
  assert.match(projectRouter, /cancellationPermissionForAction/);
  assert.match(routeLine("listings/:listingId/reserve"), /LOT_RESERVATIONS_CREATE/);
  assert.match(routeLine("reservation-agents"), /LOT_RESERVATIONS_CREATE/);
  assert.match(routeLine("commission-preview"), /LOT_RESERVATIONS_CREATE/);
});

test('project-bound numeric mutations combine permission and project scope', () => {
  assert.match(projectRouter, /requireProjectPermission/);
  assert.match(routeLine("/:id/edit-preflight"), /requireProjectPermission\(PERMISSIONS\.SYSTEM_PROJECTS_EDIT, \{ projectIdParam: 'id' \}\)/);
  assert.match(routeLine("router.put('/lot-projects/:id'"), /requireProjectPermission\(PERMISSIONS\.SYSTEM_PROJECTS_EDIT, \{ projectIdParam: 'id' \}\)/);
  assert.match(routeLine("router.delete('/lot-projects/:id'"), /requireProjectPermission\(PERMISSIONS\.SYSTEM_PROJECTS_DELETE, \{ projectIdParam: 'id' \}\)/);
  assert.match(projectRouter, /router\.param\('projectSlug', requireProjectAccessBySlug\)/);
});

test('project-specific seller-group routes enforce project scope at middleware level', () => {
  assert.match(sellerGroupRouter, /requireProjectPermission/);
  assert.match(sellerGroupRouter, /projects\/:projectId\/analytics'[\s\S]*requireProjectPermission\(PERMISSIONS\.SYSTEM_SELLER_GROUPS_VIEW, \{ projectIdParam: 'projectId' \}\)/);
  assert.match(sellerGroupRouter, /projects\/:projectId\/pool'[\s\S]*requireProjectPermission\(PERMISSIONS\.SYSTEM_SELLER_GROUPS_MANAGE, \{ projectIdParam: 'projectId' \}\)/);
});

test('read-side routes use the dedicated data permission instead of generic listing view', () => {
  assert.match(routeLine("/:projectSlug/price-list'"), /SYSTEM_PROJECTS_PRINT_PRICE_LIST/);
  assert.match(routeLine("document-files/:fileId/access-url"), /LOT_BUYER_DOCUMENTS_VIEW/);
  assert.match(routeLine("document-files/:fileId/content"), /LOT_BUYER_DOCUMENTS_VIEW/);
  assert.match(routeLine("buyer-form'"), /LOT_BUYER_DOCUMENTS_VIEW/);
  assert.match(routeLine("proofs/:proofId/access-url"), /LOT_PAYMENTS_VIEW/);
  assert.match(routeLine("proofs/:proofId/content"), /LOT_PAYMENTS_VIEW/);
  assert.match(routeLine("acknowledgement-signed-copy'"), /LOT_PAYMENTS_VIEW/);
  assert.match(routeLine("acknowledgement-signed-copy/access-url"), /LOT_PAYMENTS_VIEW/);
  assert.match(routeLine("acknowledgement-signed-copy/content"), /LOT_PAYMENTS_VIEW/);
});

test('verified payment correction delegates edit and void independently while preserving sensitive verification', () => {
  assert.match(projectRouter, /const requirePaymentCorrectionPermission/);
  assert.match(projectRouter, /action === 'edit'[\s\S]*LOT_PAYMENTS_EDIT[\s\S]*action === 'void'[\s\S]*LOT_PAYMENT_DELETE/);
  assert.match(routeLine("payments/:paymentId/correction-code"), /requirePaymentCorrectionPermission/);
  assert.match(routeLine("payments/:paymentId/correction-code"), /requireCurrentPassword/);
  assert.doesNotMatch(routeLine("payments/:paymentId/correction-code"), /requireExactRole/);
  assert.match(routeLine("router.put('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId'"), /LOT_PAYMENTS_EDIT/);
  assert.doesNotMatch(routeLine("router.put('/lot-projects/:projectSlug/listings/:listingId/payments/:paymentId'"), /requireExactRole/);
  assert.match(routeLine("payments/:paymentId/delete"), /LOT_PAYMENT_DELETE/);
  assert.doesNotMatch(routeLine("payments/:paymentId/delete"), /requireExactRole/);
  assert.match(paymentsController, /requirePaymentCorrectionVerification/);
  assert.match(paymentsController, /createSensitiveActionVerification/);
  assert.match(paymentsController, /verifyAndConsumeSensitiveAction/);
  assert.match(paymentsController, /Email verification is required for this payment correction/);
});

test('commission release, hold, and unhold remain independent', () => {
  assert.match(projectRouter, /\['release', 'release_stage', 'set_agent_receipt_status'\][\s\S]*LOT_COMMISSIONS_RELEASE/);
  assert.match(projectRouter, /\['hold', 'hold_stage'\][\s\S]*LOT_COMMISSIONS_HOLD/);
  assert.match(projectRouter, /\['unhold', 'unhold_stage'\][\s\S]*LOT_COMMISSIONS_UNHOLD/);
});

test('sensitive owner-level safeguards remain stronger than ordinary permissions', () => {
  assert.match(routeLine("accounts/:accountId/purge-preview"), /requireExactRole\('super_admin'\)/);
  assert.match(projectRouter, /commission-adjustment-code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(projectRouter, /reservation-correction\/code'[\s\S]*requireExactRole\('super_admin'\)/);
  assert.match(projectRouter, /penalty-correction'[\s\S]*LOT_PENALTY_CORRECT/);
});

test('system reports and notifications enforce project scope in their controllers', () => {
  assert.match(reportsController, /getAccessibleProjectIds/);
  assert.match(notificationsController, /appendProjectAccessFilter/);
  assert.match(notificationsController, /canAccessProject/);
});
