import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin uses the same SystemLayout and full navigation as Super Admin', () => {
  const app = read('client/src/App.jsx');
  const systemLayout = read('client/src/layout/SystemLayout.jsx');
  const lotLayout = read('client/src/layout/LotLayout.jsx');

  assert.match(app, /<Route path="\/admin" element=\{<SystemLayout \/>\}/);
  assert.doesNotMatch(app, /<Route path="\/admin" element=\{<AdminLayout \/>\}/);
  assert.match(systemLayout, /isFullAccessAdministrator\(user\)/);
  assert.match(systemLayout, /Admin 1/);
  assert.match(lotLayout, /\['super_admin', 'admin'\]\.includes\(user\?\.role\)/);
});

test('Admin type selector enables Admin 1 and shows disabled future types', () => {
  const clientPermissions = read('client/src/config/permissions.js');
  const createUser = read('client/src/components/System/userComponents/CreateUserModal.jsx');
  const editUser = read('client/src/components/System/userComponents/EditUserModal.jsx');
  const migration = read('server/migrations/20260722_admin_types_and_admin1_full_access.sql');

  assert.match(clientPermissions, /value: 'admin_1'[\s\S]*disabled: true/);
  assert.match(clientPermissions, /value: 'admin_2'[\s\S]*disabled: true/);
  assert.match(clientPermissions, /value: 'admin_3'[\s\S]*disabled: true/);
  assert.match(createUser, /Admin Type/);
  assert.match(createUser, /Coming later/);
  assert.match(editUser, /Admin Type/);
  assert.match(editUser, /Coming later/);
  assert.match(migration, /admin_type ENUM\('admin_1','admin_2','admin_3'\)/);
  assert.match(migration, /SET admin_type = 'admin_1'/);
});

test('Payments and SOA show the total amount paid in the summary and statement', () => {
  const paymentsSoa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

  assert.match(paymentsSoa, /const totalPaid = useMemo\([\s\S]*paymentRecords\.reduce/);
  assert.match(paymentsSoa, /<SummaryCard label="Total Payments Made"/);
  assert.match(paymentsSoa, /Total payments made:/);
});

test('Custom daily penalty input remains custom while a multi-digit value is typed', () => {
  const paymentsSoa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const reserveTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');

  for (const source of [paymentsSoa, reserveTerms]) {
    assert.match(source, /penaltyRateMode/);
    assert.match(source, /setPenaltyRateMode\('custom'\)/);
    assert.doesNotMatch(source, /const selectedPenaltyRateOption = dailyPenaltyRateOptions\.includes\(Number\(form\.dailyPenaltyRate\)\)/);
  }
});

test('Penalty adjustment wording is understandable without technical correction and waiver terms', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/PenaltyReliefModal.jsx');

  assert.match(modal, /Penalty Adjustment/);
  assert.match(modal, /Give More Time/);
  assert.match(modal, /Reduce Penalty/);
  assert.match(modal, /Correct Penalty/);
  assert.match(modal, /Penalty Adjustment History/);
  assert.doesNotMatch(modal, />Reset Correction</);
  assert.doesNotMatch(modal, />Waive Penalty</);
});
