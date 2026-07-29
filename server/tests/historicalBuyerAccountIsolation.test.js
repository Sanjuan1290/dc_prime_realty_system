import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('buyer account history opens an account-specific listing route', () => {
  const app = read('client/src/App.jsx');
  const history = read('client/src/components/Lot_Projects/ListingProfileComponents/AccountHistory/AccountHistoryPanel.jsx');

  assert.match(app, /path="listings\/:listingId\/accounts\/:accountId"/);
  assert.match(history, /navigate\(account\.isCurrent \? basePath : `\$\{basePath\}\/accounts\/\$\{account\.id\}`\)/);
  assert.match(history, /role="link"/);
  assert.match(history, /event\.stopPropagation\(\)/);
  assert.match(history, /View Full Account/);
});

test('historical profile validates project, listing, and account together', () => {
  const router = read('server/routers/System/projects.routers.js');
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');

  assert.match(router, /listings\/:listingId\/accounts\/:accountId[^\n]*getLotProjectListingProfile/);
  assert.match(controller, /current_account\.lot_project_account_id = \?/);
  assert.match(controller, /current_account\.lot_project_listing_id = l\.lot_project_listing_id/);
  assert.match(controller, /current_account\.lot_project_id = l\.lot_project_id/);
  assert.match(controller, /Buyer account not found for this listing/);
});

test('historical profile reads every child record by account id', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const accounts = read('server/controllers/Lot_Projects/Accounts/Accounts.controller.js');

  assert.match(controller, /payment_summary\.lot_project_account_id = current_account\.lot_project_account_id/);
  assert.match(controller, /schedule_summary\.lot_project_account_id = current_account\.lot_project_account_id/);
  assert.match(controller, /commission\.lot_project_account_id = current_account\.lot_project_account_id/);
  assert.match(controller, /cancellation_history\.lot_project_reservation_history_id = current_account\.lot_project_reservation_history_id/);
  assert.match(controller, /getListingDocuments\([\s\S]*selectedAccountId/);
  assert.match(controller, /getListingPayments\([\s\S]*selectedAccountId/);
  assert.match(controller, /getListingSoaRows\([\s\S]*accountId: selectedAccountId/);
  assert.match(controller, /loadListingCommissionSnapshot\([\s\S]*accountId: selectedAccountId/);

  assert.match(shared, /cd\.lot_project_account_id = \?/);
  assert.match(shared, /p\.lot_project_account_id = \?/);
  assert.match(shared, /s\.lot_project_account_id = \?/);
  assert.match(shared, /latest_schedule\.lot_project_account_id <=> \$\{safeAlias\}\.lot_project_account_id/);
  assert.match(accounts, /payment\.lot_project_account_id = account\.lot_project_account_id/);
  assert.match(accounts, /document_row\.lot_project_account_id = account\.lot_project_account_id/);
  assert.match(accounts, /commission\.lot_project_account_id = account\.lot_project_account_id/);
});

test('historical account screens and writes stay read-only', () => {
  const profile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const unit = read('client/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx');
  const client = read('client/src/components/Lot_Projects/ListingProfileComponents/ClientProfile/ClientProfile.jsx');
  const payments = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const documents = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');

  assert.match(profile, /const readOnly = Boolean\(isAccountRoute \|\| profile\.readOnly\)/);
  assert.match(profile, /!readOnly && showReserveModal/);
  assert.match(profile, /!readOnly && showBuyerFormLinkModal/);
  assert.match(unit, /!readOnly && canRecalculateCommission/);
  assert.match(client, /!readOnly && \(listing\?\.canEditBuyerProfile/);
  assert.match(payments, /!readOnly \? \([\s\S]*Edit SOA Terms/);
  assert.match(payments, /!readOnly && showPaymentModal/);
  assert.match(payments, /!readOnly && penaltyReliefRow/);
  assert.match(documents, /!readOnly && uploadDoc/);
  assert.match(documents, /Historical account documents are read-only/);
});

test('historical print payloads use a separate token so accounts cannot overwrite each other', () => {
  const printouts = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/Printouts.jsx');
  const utilities = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/printUtils.jsx');

  assert.match(printouts, /lot_project_print_payload:\$\{printKey\}/);
  assert.match(printouts, /printKey=\$\{encodeURIComponent\(printKey\)\}/);
  assert.match(printouts, /account,/);
  assert.match(utilities, /new URLSearchParams\(window\.location\.search\)\.get\('printKey'\)/);
  assert.match(utilities, /lot_project_print_payload:\$\{printKey\}/);
});

test('historical SOA keeps the selected account final schedule generation read-only', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');

  assert.match(shared, /\{ includeCancelled = false \} = \{\}/);
  assert.match(shared, /\{ includeCancelled: readOnly \}/);
  assert.match(shared, /const visibleScheduleRows = readOnly/);
  assert.match(shared, /if \(readOnly\) \{[\s\S]*totalDue: getScheduleTotalDue\(row\)/);
  assert.match(shared, /if \(!readOnly && existingScheduleRows\.length/);
});
