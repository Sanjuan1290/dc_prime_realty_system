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

  assert.match(app, /<Route path="\/portal\/admin" element=\{<SystemLayout \/>\}/);
  assert.doesNotMatch(app, /<Route path="\/portal\/admin" element=\{<AdminLayout \/>\}/);
  assert.match(systemLayout, /isFullAccessAdministrator\(user\)/);
  assert.match(systemLayout, /user\?\.role === "admin" \? "Admin"/);
  assert.match(lotLayout, /isFullAccessAdministrator\(user\)/);
});

test('Admin user forms use project access instead of legacy Admin Type', () => {
  const clientPermissions = read('client/src/config/permissions.js');
  const createUser = read('client/src/components/System/userComponents/CreateUserModal.jsx');
  const editUser = read('client/src/components/System/userComponents/EditUserModal.jsx');
  const accessFields = read('client/src/components/System/userComponents/AdminProjectAccessFields.jsx');
  const migration = read('server/migrations/20260914_admin_project_access.sql');

  assert.doesNotMatch(clientPermissions, /ADMIN_TYPES/);
  assert.match(createUser, /AdminProjectAccessFields/);
  assert.match(editUser, /AdminProjectAccessFields/);
  assert.match(accessFields, /Projects this Admin can manage/);
  assert.match(accessFields, /All Projects/);
  assert.doesNotMatch(createUser, />Admin Type</);
  assert.doesNotMatch(editUser, />Admin Type</);
  assert.match(migration, /admin_project_access/);
  assert.match(migration, /admin_all_projects/);
});

test('Payments and SOA show the total amount paid in the summary and statement', () => {
  const paymentsSoa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');

  assert.match(paymentsSoa, /const localTotalPaid = useMemo\([\s\S]*paymentRecords\.reduce/);
  assert.match(paymentsSoa, /const totalPaid = canonicalCash\?\.verifiedCollections \?\? localTotalPaid/);
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
