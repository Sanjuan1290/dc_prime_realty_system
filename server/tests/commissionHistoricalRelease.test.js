import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const commissionController = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
const commissionPage = read('client/src/pages/Lot_Projects/Commission.jsx');
const releaseModal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
const releaseDoubleCheck = read('client/src/components/Shared/DoubleCheckComponents/CommissionReleaseDoubleCheck.jsx');
const proofDoubleCheck = read('client/src/components/Shared/DoubleCheckComponents/ProofOfIncomeDoubleCheck.jsx');
const accreditedController = read('server/controllers/System/accredited.controller.js');
const accreditedPage = read('client/src/pages/System/Accredited.jsx');
const listingsController = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
const migration = read('server/migrations/20260818_commission_historical_releases.sql');

test('historical commission migration is non-destructive and preserves metadata in live and archive rows', () => {
  assert.match(migration, /ALTER TABLE lot_project_commission_releases[\s\S]*release_entry_mode[\s\S]*ENUM\('live','historical'\)/);
  assert.match(migration, /release_recorded_at[\s\S]*DATETIME NULL/);
  assert.match(migration, /historical_release_note[\s\S]*VARCHAR\(500\) NULL/);
  assert.match(migration, /ALTER TABLE lot_project_archived_commission_releases[\s\S]*release_entry_mode/);
  assert.doesNotMatch(migration, /UPDATE\s+lot_project_commission_releases\s+SET\s+actual_release_date/i);
  assert.doesNotMatch(migration, /UPDATE\s+lot_project_commission_releases\s+SET\s+net_release_amount/i);
});

test('live releases use the Manila server date and still obey configured project release days', () => {
  assert.match(commissionController, /todayDateOnly/);
  assert.match(commissionController, /todayDateISO:\s*todayIso/);
  assert.match(commissionController, /if \(!isHistoricalRelease && !releaseDateInfo\.isReleaseDate\)/);
  assert.match(commissionController, /actualReleaseDate = isHistoricalRelease \? historicalActualReleaseDate : todayDateOnly\(\)/);
  assert.doesNotMatch(commissionController, /actualReleaseDate = new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
});

test('historical release dates are validated and future dates are blocked', () => {
  assert.match(commissionController, /Release mode must be live or historical/i);
  assert.match(commissionController, /normalizeIsoDateOnly\(requestedActualReleaseDate\)/);
  assert.match(commissionController, /historicalActualReleaseDate > todayDateOnly\(\)/);
  assert.match(commissionController, /Historical actual release date cannot be in the future/);
  assert.match(commissionController, /cannot be before the buyer account starting date/);
  assert.match(commissionController, /Historical release note cannot exceed 500 characters/);
});

test('historical eligibility is calculated from payments available by the selected historical date', () => {
  assert.match(commissionController, /historicalPaymentDateFilterSql[\s\S]*lot_project_payment_date <= \?/);
  assert.match(commissionController, /historicalComputedPaymentPercentSql/);
  assert.match(commissionController, /historicalActualRemainingBalanceSql/);
  assert.match(commissionController, /Historical releases use payments that existed on or before the selected/);
  const historicalExprStart = commissionController.indexOf('const historicalComputedPaymentPercentSql');
  const historicalExprEnd = commissionController.indexOf('const ISO_DATE_PATTERN', historicalExprStart);
  const historicalExpr = commissionController.slice(historicalExprStart, historicalExprEnd);
  assert.doesNotMatch(historicalExpr, /fully_paid/);
  assert.match(commissionController, /!\['Eligible', 'Earned on Cancellation'\]\.includes\(computedStatus\)/);
});

test('historical release uses the same locked idempotent financial path and never rewrites an already released stage', () => {
  const releaseHandler = commissionController.slice(commissionController.indexOf('export const updateLotProjectCommission'));
  const lockIndex = releaseHandler.indexOf('FOR UPDATE');
  const alreadyIndex = releaseHandler.indexOf("if (computedStatus === 'Released')");
  const updateIndex = releaseHandler.indexOf('UPDATE lot_project_commission_releases');
  assert.ok(lockIndex >= 0);
  assert.ok(alreadyIndex > lockIndex);
  assert.ok(updateIndex > alreadyIndex);
  assert.match(releaseHandler, /alreadyApplied:\s*true/);
});

test('release records persist entry mode, recorded-at time, historical note, and audit metadata', () => {
  assert.match(commissionController, /release_entry_mode = \?/);
  assert.match(commissionController, /release_recorded_at = CASE[\s\S]*COALESCE\(release_recorded_at, NOW\(\)\)/);
  assert.match(commissionController, /historical_release_note = \?/);
  assert.match(commissionController, /Recorded historical commission release/);
  assert.match(commissionController, /actualReleaseDate,[\s\S]*releaseMode: releaseEntryMode,[\s\S]*historicalReleaseNote/);
});

test('commission UI explicitly separates Release Today from Record Historical Release', () => {
  assert.match(releaseModal, /Release Today/);
  assert.match(releaseModal, /Record Historical Release/);
  assert.match(releaseModal, /name="commission-release-mode"/);
  assert.match(releaseModal, /max=\{today\}/);
  assert.match(releaseModal, /Historical Note/);
  assert.match(releaseModal, /original payment milestone is validated as of the selected date/);
  assert.match(releaseModal, /stage\.releaseEntryMode === 'historical'/);
  assert.doesNotMatch(releaseModal, /Release date locked/);
});

test('commission final review shows release type, actual release date, and historical note', () => {
  assert.match(commissionPage, /releaseMode === 'historical'/);
  assert.match(commissionPage, /actualReleaseDate: releaseDate/);
  assert.match(commissionPage, /historicalNote:/);
  assert.match(releaseDoubleCheck, /Release Recording/);
  assert.match(releaseDoubleCheck, /Release Type/);
  assert.match(releaseDoubleCheck, /Actual Release Date/);
  assert.match(releaseDoubleCheck, /Historical Note/);
  assert.match(releaseDoubleCheck, /Audit Log keeps the current administrator and encoding time/);
});

test('Proof of Income keeps receipt date separate while defaulting a common actual release date', () => {
  assert.match(accreditedPage, /selectedActualReleaseDates/);
  assert.match(accreditedPage, /suggestedReceiptDate = selectedActualReleaseDates\.length === 1 \? selectedActualReleaseDates\[0\] : todayISO\(\)/);
  assert.match(accreditedPage, /receiptDateTouched/);
  assert.match(accreditedPage, /min=\{latestSelectedActualReleaseDate \|\| undefined\}/);
  assert.match(accreditedPage, /max=\{todayISO\(\)\}/);
  assert.match(accreditedPage, /Defaulted to the selected commission's actual release date/);
  assert.match(accreditedPage, /Selected releases occurred on different actual release dates/);
  assert.match(accreditedController, /if \(!parseIsoDateOnly\(receiptDate\)\)/);
  assert.match(accreditedController, /if \(receiptDate > todayDateOnly\(\)\)/);
  assert.match(accreditedController, /Receipt date cannot be in the future/);
  assert.match(accreditedController, /latest selected commission release date/);
  assert.match(proofDoubleCheck, /Actual Release Date/);
  assert.match(proofDoubleCheck, /Receipt Date is the Proof of Income issue date and remains separate/);
});

test('seller income reporting remains based on actual release date and exposes historical release metadata', () => {
  assert.match(accreditedController, /Income reports use the commission stage's actual release date/);
  assert.match(accreditedController, /r\.actual_release_date BETWEEN \? AND \?/);
  assert.match(accreditedController, /archived\.actual_release_date BETWEEN \? AND \?/);
  assert.match(accreditedController, /releaseEntryMode: row\.release_entry_mode \|\| 'live'/);
  assert.match(accreditedController, /historicalReleaseNote: row\.historical_release_note \|\| ''/);
});

test('cancelled-sale financial archive preserves historical release metadata', () => {
  const archiveStart = listingsController.indexOf('INSERT IGNORE INTO lot_project_archived_commission_releases');
  assert.ok(archiveStart >= 0);
  const archiveSource = listingsController.slice(archiveStart, archiveStart + 5000);
  assert.match(archiveSource, /release_entry_mode/);
  assert.match(archiveSource, /release_recorded_at/);
  assert.match(archiveSource, /historical_release_note/);
  assert.match(archiveSource, /r\.release_entry_mode/);
  assert.match(archiveSource, /r\.release_recorded_at/);
  assert.match(archiveSource, /r\.historical_release_note/);
});
