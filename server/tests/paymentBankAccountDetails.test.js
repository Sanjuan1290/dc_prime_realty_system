import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('non-cash payments collect and persist bank/account details for receipts', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/AddSOAPaymentModal.jsx');
  const controller = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const receipt = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PaymentAcknowledgementReceiptsPrintPage.jsx');
  const migration = read('server/migrations/20260720_payment_bank_account_details.sql');

  assert.match(modal, /form\.method !== 'Cash'[\s\S]*Bank \/ Payment Provider/);
  assert.match(modal, /Account No\. \/ Wallet No\./);
  assert.match(modal, /bankName: form\.method === 'Cash' \? null : form\.bankName\.trim\(\)/);
  assert.match(modal, /accountNumber: form\.method === 'Cash' \? null : form\.accountNumber\.trim\(\)/);

  assert.match(controller, /lot_project_payment_bank_name/);
  assert.match(controller, /lot_project_payment_account_number/);
  assert.match(controller, /Bank \/ payment provider is required for non-cash payments/);
  assert.match(controller, /Account No\. \/ wallet number is required for non-cash payments/);

  assert.match(shared, /bankName: row\.lot_project_payment_bank_name/);
  assert.match(shared, /accountNumber: row\.lot_project_payment_account_number/);
  assert.match(receipt, /getPaymentBankLabel\(payment\)/);
  assert.match(receipt, /getPaymentAccountNumber\(payment\)/);
  assert.match(migration, /lot_project_payment_bank_name/);
  assert.match(migration, /lot_project_payment_account_number/);
});
