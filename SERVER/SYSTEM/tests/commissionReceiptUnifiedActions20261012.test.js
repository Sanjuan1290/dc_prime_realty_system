import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getNetworkProfitReleaseCalendar } from '../services/networkProfitReleaseCalendar.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const read = (name) => readFileSync(resolve(root, name), 'utf8');
const profit = read('SERVER/SYSTEM/controllers/Lot_Projects/Commissions/NetworkCompanyProfit.controller.js');
const projectRoutes = read('SERVER/SYSTEM/routers/System/projects.routers.js');
const panel = read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/NetworkCompanyProfitPanel.jsx');
const seller = read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
const receiptController = read('SERVER/SYSTEM/controllers/Lot_Projects/Commissions/CommissionReleaseReceipt.controller.js');
const printTemplate = read('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage.jsx');
const preview = read('CLIENT/SYSTEM/src/components/Lot_Projects/CommissionComponents/CommissionReceiptPreview.jsx');

test('Company Profit release date respects project schedule, month transitions, Manila date', () => {
  assert.deepEqual(getNetworkProfitReleaseCalendar('2026-10-12', {release_day_one: 7, release_day_two: 22}), {
    todayDateISO: '2026-10-12', releaseDays: [7, 22], isReleaseDate: false,
    nextReleaseDateISO: '2026-10-22', nextReleaseDate: 'October 22, 2026',
  });
  assert.equal(getNetworkProfitReleaseCalendar('2026-10-22', { release_day_one: 7, release_day_two: 22 }).isReleaseDate, true);
  assert.equal(getNetworkProfitReleaseCalendar('2026-10-31', { release_day_one: 7, release_day_two: 22 }).nextReleaseDateISO, '2026-11-07');
  assert.equal(getNetworkProfitReleaseCalendar('2026-02-26', { release_day_one: 31, release_day_two: 31 }).nextReleaseDateISO, '2026-03-31');
  assert.deepEqual(getNetworkProfitReleaseCalendar('2026-10-07', {}).releaseDays, [7, 22]);
});

test('backend and frontend both enforce scheduled Company Profit release dates', () => {
  assert.match(profit, /releaseDateInfo = getNetworkProfitReleaseCalendar\(todayDateOnly\(\), releaseSettings/);
  assert.match(profit, /stage\.canRelease && Boolean\(releaseDateInfo\?\.isReleaseDate\)/);
  assert.match(profit, /awaitingReleaseDate:/);
  assert.match(profit, /if \(!releaseCalendar\.isReleaseDate\)/);
  assert.match(panel, /disabled=\{!stage\.canRelease\}/);
  assert.match(panel, /Awaiting Release Date/);
  assert.match(panel, /Next release date/);
});

test('Company Profit print uses the unchanged seller A4 proof-of-income document format', () => {
  assert.match(panel, /<CommissionReceiptPreview/);
  assert.match(panel, /network_company_profit/);
  assert.match(preview, /<CommissionReceiptPrint seller=\{seller\} receipt=\{receipt\}/);
  assert.match(printTemplate, /Acknowledgement Receipt for Fund Release:/);
  for (const header of ['PAYEE','Description','Date','TOTAL']) assert.match(printTemplate, new RegExp(header));
  assert.match(printTemplate, /TOTAL AMOUNT:/);
  assert.match(printTemplate, /Signature and Date/);
  assert.match(printTemplate, /isCompanyProfit/);
});

test('Seller released stage shows Print Acknowledgment and Signed Copy in Commission Details', () => {
  assert.match(seller, /\{isReleased \? <>[\s\S]*Print Acknowledgment[\s\S]*Signed Copy/);
  assert.match(seller, /openSellerReceipt\(stage, 'print'\)/);
  assert.match(seller, /openSellerReceipt\(stage, 'signed'\)/);
  assert.match(seller, /<SignedCopyUploadModal/);
  assert.match(seller, /canViewSigned/);
  assert.match(seller, /canUploadSigned/);
  assert.match(seller, /<CommissionReceiptPreview/);
});

test('seller receipt lookup requires project-scope, exact commission, stage, active receipt and paid stage', () => {
  assert.match(projectRoutes, /commissions\/:commissionId\/releases\/:releaseId\/receipt', requirePermission\(PERMISSIONS\.LOT_COMMISSIONS_VIEW\)/);
  assert.match(receiptController, /commission\.lot_project_id = \?/);
  assert.match(receiptController, /commission\.lot_project_commission_id = \?/);
  assert.match(receiptController, /stage\.lot_project_commission_release_id = \?/);
  assert.match(receiptController, /receipt\.lot_project_account_id IS NULL OR receipt\.lot_project_account_id = commission\.lot_project_account_id/);
  assert.match(receiptController, /receipt\.receipt_status = 'active' AND stage\.release_status = 'Released'/);
  assert.match(receiptController, /RELEASE_RECEIPT_NOT_FOUND/);
});


