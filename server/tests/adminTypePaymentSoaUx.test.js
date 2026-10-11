import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('all internal system roles share SystemLayout while navigation is permission-aware', () => {
  const app = read('client/src/App.jsx');
  const systemLayout = read('client/src/layout/SystemLayout.jsx');
  const lotLayout = read('client/src/layout/LotLayout.jsx');

  assert.match(app, /const systemRoleRoutes = SYSTEM_USER_ROLES\.map/);
  assert.match(app, /path=\{`\/portal\/\$\{role\}`\} element=\{<SystemLayout \/>\}/);
  assert.doesNotMatch(app, /AdminLayout/);
  assert.match(systemLayout, /hasPermission\(user, item\.permission\)/);
  assert.match(lotLayout, /hasPermission\(user, item\.permission\)/);
});

test('system-user access forms use generalized project scope instead of legacy Admin Type', () => {
  const clientPermissions = read('client/src/config/permissions.js');
  const createUser = read('client/src/components/System/userComponents/CreateSystemUserModal.jsx');
  const editUser = read('client/src/components/System/userComponents/EditSystemUserModal.jsx');
  const accessModal = read('client/src/components/System/userComponents/UserAccessModal.jsx');
  const accessFields = read('client/src/components/System/userComponents/AdminProjectAccessFields.jsx');
  const migration = read('server/migrations/20260925_system_rbac_roles_and_access.sql');

  assert.doesNotMatch(clientPermissions, /ADMIN_TYPES/);
  assert.match(createUser, /AdminProjectAccessFields/);
  assert.match(accessModal, /AdminProjectAccessFields/);
  assert.match(editUser, /Role is locked after creation/);
  assert.match(accessFields, /Project Access/);
  assert.match(accessFields, /All Projects/);
  assert.match(accessFields, /Permissions and project scope must both allow an action/);
  assert.doesNotMatch(createUser, />Admin Type</);
  assert.doesNotMatch(editUser, />Admin Type</);
  assert.match(migration, /user_project_access/);
  assert.match(migration, /all_projects_access/);
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

