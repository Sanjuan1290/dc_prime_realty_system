import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (relativePath) => readFile(new URL(relativePath, import.meta.url), 'utf8');

test('Price List button opens a month-setting modal before printing', async () => {
  const dashboard = await read('../../client/src/pages/Lot_Projects/Dashboard.jsx');

  assert.match(dashboard, /const PriceListPrintModal/);
  assert.match(dashboard, /Straight Payment \(Months\)/);
  assert.match(dashboard, /DEFAULT_STRAIGHT_PAYMENT_MONTHS = 20/);
  assert.match(dashboard, /parsedMonths < 1 \|\| parsedMonths > 120/);
  assert.match(dashboard, /setShowPriceListModal\(true\)/);
  assert.match(dashboard, /new URLSearchParams\(\{ straightPaymentMonths:/);
  assert.match(dashboard, /Print Price List/);
});

test('Straight Payment Months is not stored in Add or Edit Project data', async () => {
  const [projectModal, projectsController, sharedController] = await Promise.all([
    read('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx'),
    read('../controllers/System/projects.controller.js'),
    read('../controllers/Lot_Projects/_shared/lotProject.shared.js'),
  ]);

  assert.doesNotMatch(projectModal, /Straight Payment \(Months\)/);
  assert.doesNotMatch(projectModal, /straightPaymentMonths/);
  assert.doesNotMatch(projectsController, /lot_project_straight_payment_months/);
  assert.doesNotMatch(sharedController, /lot_project_straight_payment_months/);
});

test('print page uses the month count supplied by the Price List modal', async () => {
  const printPage = await read(
    '../../client/src/components/Lot_Projects/ListingProfileComponents/Printouts/ProjectPriceListPrintPage.jsx'
  );

  assert.match(printPage, /new URLSearchParams\(window\.location\.search\)\.get\('straightPaymentMonths'\)/);
  assert.match(printPage, /getPriceListValues\(listing, straightPaymentMonths\)/);
  assert.match(printPage, /netAfterReservation \/ straightPaymentMonths/);
  assert.match(printPage, /\{straightPaymentMonths\}<\/td>/);
});

test('Add and Edit Lot Project use two separate floating document modals', async () => {
  const projectModal = await read('../../client/src/components/System/projectComponents/AddLotProjectModal.jsx');
  const editModal = await read('../../client/src/components/Lot_Projects/DashboardComponents/EditProjectModal/EditProjectModal.jsx');

  assert.match(projectModal, /const \[step, setStep\] = useState\(1\)/);
  assert.match(projectModal, /Project Information/);
  assert.match(projectModal, /Next: Documents/);
  assert.match(projectModal, /aria-label="Project document setup"/);
  assert.match(projectModal, /Step 2 of 2 · Document Picker/);
  assert.match(projectModal, /Step 2 of 2 · Project Checklist/);
  assert.match(projectModal, /Choose Documents/);
  assert.match(projectModal, /Documents Added/);
  assert.match(projectModal, /lg:grid-cols-\[minmax\(0,0\.95fr\)_minmax\(0,1\.05fr\)\]/);

  const floatingDocumentModals = projectModal.match(
    /<section className="flex max-h-\[88vh\][^"]*shadow-2xl/g
  ) || [];
  assert.equal(floatingDocumentModals.length, 2);

  assert.doesNotMatch(projectModal, /<form[\s>]/);
  assert.doesNotMatch(projectModal, /onSubmit=/);
  assert.match(projectModal, /type="button"[\s\S]*?Next: Documents/);
  assert.match(projectModal, /onClick=\{handleSave\}/);
  assert.match(editModal, /mode="edit"/);
});

