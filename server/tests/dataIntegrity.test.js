import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Data Integrity is permission-protected and reachable from both System portals', () => {
  const serverPermissions = read('server/config/permissions.js');
  const clientPermissions = read('client/src/config/permissions.js');
  const router = read('server/routers/System/dataIntegrity.routers.js');
  const server = read('server/server.js');
  const app = read('client/src/App.jsx');
  const layout = read('client/src/layout/SystemLayout.jsx');

  assert.match(serverPermissions, /SYSTEM_DATA_INTEGRITY_VIEW:\s*'system\.data_integrity\.view'/);
  assert.match(clientPermissions, /SYSTEM_DATA_INTEGRITY_VIEW:\s*'system\.data_integrity\.view'/);
  assert.match(router, /router\.get\('\/'[\s\S]*SYSTEM_DATA_INTEGRITY_VIEW/);
  assert.match(router, /router\.get\('\/summary'[\s\S]*SYSTEM_DATA_INTEGRITY_VIEW/);
  assert.match(router, /router\.get\('\/accounts\/:accountId'[\s\S]*SYSTEM_DATA_INTEGRITY_VIEW/);
  assert.doesNotMatch(router, /router\.(post|put|patch|delete)\(/i);
  assert.match(server, /app\.use\('\/api\/v1\/data-integrity', dataIntegrityRouter\)/);
  assert.match(app, /const DataIntegrity = lazy/);
  assert.equal((app.match(/path="data-integrity"/g) || []).length, 2);
  assert.match(app, /PERMISSIONS\.SYSTEM_DATA_INTEGRITY_VIEW/);
  assert.match(layout, /label: "Data Integrity", pathname: "data-integrity"/);
});

test('Data Integrity controller stays read-only and reuses canonical SOA helpers', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');

  assert.match(controller, /getComputedSoaTerms/);
  assert.match(controller, /getLatestActiveScheduleGenerationPredicate/);
  assert.match(controller, /getListingSoaRows/);
  assert.match(controller, /readOnly:\s*true/);
  assert.doesNotMatch(controller, /connection\.query\(\s*`\s*(?:UPDATE|INSERT|DELETE|ALTER|TRUNCATE)\b/i);
  assert.doesNotMatch(controller, /connection\.execute\(\s*`\s*(?:UPDATE|INSERT|DELETE|ALTER|TRUNCATE)\b/i);
});

test('financial integrity checks are discount-aware and do not double-count reservation credit', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');
  const page = read('client/src/pages/System/DataIntegrity.jsx');
  const modal = read('client/src/components/System/dataIntegrityComponents/DataIntegrityDetailsModal.jsx');

  assert.match(controller, /soa_sale_discount_percentage/);
  assert.match(controller, /soa_sale_discount_amount/);
  const progress = read('server/utils/commissionProgress.js');
  assert.match(controller, /calculateCommissionPaymentProgress/);
  assert.match(progress, /approvedDpDiscount/);
  assert.match(progress, /earnedDpDiscount/);
  assert.match(progress, /verifiedCash \+ earnedDpDiscount/);
  assert.doesNotMatch(progress, /verifiedCash \+ earnedDpDiscount \+[^\n]*reservation/i);
  assert.match(controller, /reservationFeeDownpaymentCredit/);
  assert.match(controller, /soa_lmf_waived_amount/);
  assert.match(controller, /penaltyWaivedAmount/);
  assert.match(page, /Discounts, credits, and waivers are shown as legitimate adjustments/);
  assert.match(page, /Discounts & Adjustments/);
  assert.match(modal, /Reservation credit changes the cash still required for DP; it is not counted twice/);
  assert.match(modal, /Sale Discount/);
  assert.match(modal, /Approved DP Discount/);
  assert.match(modal, /DP Discount Earned to Date/);
  assert.match(modal, /LMF Waiver/);
  assert.match(modal, /Penalty Waived/);
});

test('payment and SOA integrity checks compare verified allocations without treating balloon payments as unallocated errors', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');

  assert.match(controller, /Verified payment allocation does not balance/);
  assert.match(controller, /type !== 'balloon'/);
  assert.match(controller, /SOA paid amount does not match payment allocations/);
  assert.match(controller, /verified_allocation_total/);
  assert.match(controller, /clean\(row\.lot_project_payment_type\)\.toLowerCase\(\) === 'balloon'/);
});

test('commission integrity checks releases, deductions, dates, and historical payment support', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');

  assert.match(controller, /Commission released total does not match released milestones/);
  assert.match(controller, /Commission remaining amount does not reconcile/);
  assert.match(controller, /allDeductions/);
  assert.match(controller, /Earned on Cancellation/);
  assert.match(controller, /Historical release is not supported by encoded payment history/);
  assert.match(controller, /calculateCommissionPaymentProgress\(\{[\s\S]*cutoffDate: actualDate/);
  assert.match(controller, /release_trigger_percent/);
  assert.match(controller, /Commission release predates the buyer account/);
  assert.match(controller, /release_recorded_at/);
});

test('Proof of Income integrity validates included release amounts and chronology', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');

  assert.match(controller, /Proof of Income total does not match included releases/);
  assert.match(controller, /Proof of Income contains a non-released commission stage/);
  assert.match(controller, /Receipt item amount differs from the commission release/);
  assert.match(controller, /Proof of Income date predates an included commission release/);
  assert.match(controller, /Proof of Income date is in the future/);
});

test('protected file integrity checks metadata without triggering remote malware scans', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');
  const modal = read('client/src/components/System/dataIntegrityComponents/DataIntegrityDetailsModal.jsx');

  assert.match(controller, /VALID_SCAN_STATUSES/);
  assert.match(controller, /missing protected storage metadata/);
  assert.match(controller, /unknown malware scan status/);
  assert.doesNotMatch(controller, /cloudinary\.api|moderation|perception_point/i);
  assert.match(modal, /does not consume Cloudinary or Perception Point quota by re-scanning files/);
});

test('project dashboard and listing profile expose lightweight integrity shortcuts', () => {
  const dashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx');
  const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');

  assert.match(dashboard, /data-integrity\/summary\?projectSlug=/);
  assert.match(dashboard, /Data Integrity/);
  assert.match(dashboard, /View Integrity Report/);
  assert.match(listingProfile, /data-integrity\/summary\?accountId=/);
  assert.match(listingProfile, /Account Integrity/);
  assert.match(listingProfile, /View Breakdown/);
});

test('Data Integrity UI is explicitly read-only and links users back to source records instead of repairing them', () => {
  const page = read('client/src/pages/System/DataIntegrity.jsx');
  const modal = read('client/src/components/System/dataIntegrityComponents/DataIntegrityDetailsModal.jsx');

  assert.match(page, /Read-only by design/);
  assert.match(page, /never automatically edits payments, SOA rows, discounts, commissions, receipts, account status, or protected files/);
  assert.match(modal, /Read-only integrity checker/);
  assert.match(modal, /Open Buyer Account/);
  assert.match(page, /staleTime:\s*0/);
  assert.match(page, /refetchOnMount:\s*'always'/);
});


test('Integrity Records uses server-backed pagination capped at 10 records per page', () => {
  const controller = read('server/controllers/System/dataIntegrity.controller.js');
  const page = read('client/src/pages/System/DataIntegrity.jsx');

  assert.match(controller, /const DATA_INTEGRITY_PAGE_SIZE = 10/);
  assert.match(controller, /paginateIntegrityReports/);
  assert.match(controller, /limit:\s*DATA_INTEGRITY_PAGE_SIZE/);
  assert.match(controller, /reports\.slice\(offset, offset \+ DATA_INTEGRITY_PAGE_SIZE\)/);
  assert.match(controller, /pagination:\s*pageResult\.pagination/);
  assert.match(controller, /req\.query\.page/);
  assert.match(controller, /req\.query\.search/);
  assert.match(controller, /req\.query\.status/);
  assert.match(controller, /req\.query\.recordFilter/);
  assert.match(controller, /req\.query\.category/);

  assert.match(page, /const \[page, setPage\] = useState\(1\)/);
  assert.match(page, /params\.set\('page', String\(page\)\)/);
  assert.match(page, /pagination = query\.data\?\.pagination/);
  assert.match(page, /10 records per page/);
  assert.match(page, /Page \{pagination\.page\} of \{pagination\.totalPages\}/);
  assert.match(page, />Previous<\/button>/);
  assert.match(page, />Next<\/button>/);
});
