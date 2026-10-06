import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('unit commission adjustment uses Accounting Head approval, Auditor case correction, and Super Admin emergency fallback', () => {
  const router = read('../routers/System/projects.routers.js');
  const controller = read('../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');

  assert.match(router, /commission-adjustment-code'[\s\S]*LOT_COMMISSIONS_ADJUST/);
  assert.doesNotMatch(router, /commission-adjustment-code'[^\n]*requireExactRole/);
  assert.match(controller, /createProtectedChangeRequest/);
  assert.match(controller, /department: 'accounting'/);
  assert.match(controller, /accounting_head/);
  assert.match(controller, /isOwnerAdministrator\(/);
  assert.match(controller, /emergency_super_admin/);
  assert.match(controller, /createProtectedChangeRequest/);
  assert.match(controller, /getPendingAuditCorrectionCase/);
});

test('adjustment edits the saved commission snapshot in place instead of deleting and rebuilding it', () => {
  const controller = read('../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  const start = controller.indexOf('export const adjustLotProjectListingCommission');
  const end = controller.indexOf('export const holdLotProjectListing', start);
  const adjustment = controller.slice(start, end);

  assert.match(adjustment, /UPDATE lot_project_commissions/);
  assert.match(adjustment, /commission_rate = \?/);
  assert.match(adjustment, /gross_commission_amount = \?/);
  assert.match(adjustment, /lot_project_account_id = \?/);
  assert.doesNotMatch(adjustment, /DELETE FROM lot_project_commissions/);
  assert.doesNotMatch(adjustment, /replaceReservationCommissions/);
});

test('legacy recalculation rows with a missing account id remain visible and are repairable', () => {
  const controller = read('../controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  assert.match(controller, /c\.lot_project_account_id = \? OR c\.lot_project_account_id IS NULL/);
  assert.match(controller, /lot_project_account_id = \?,[\s\S]*updated_at = NOW\(\)/);
});

test('client requires exact allocation before governed commission authorization can proceed', () => {
  const modal = read('../../client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/RecalculateCommissionModal.jsx');
  assert.match(modal, /Unit Network Distribution Rate/);
  assert.match(modal, /Allocated/);
  assert.match(modal, /Unallocated \/ Over/);
  assert.match(modal, /Unallocated must be 0\.0000%/);
  assert.match(modal, /rate cannot be greater than the Unit Network Distribution Rate/);
  assert.match(modal, /Accounting Head Approval|Head Approval/);
  assert.match(modal, /Auditor Case|auditCase/);
  assert.match(modal, /Emergency|Super Admin/);
});

