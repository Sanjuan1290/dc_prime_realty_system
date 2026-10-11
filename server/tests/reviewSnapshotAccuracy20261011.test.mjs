import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { enrichLegacyListingReviewSnapshots } from '../services/legacyListingReviewSnapshot.service.js';
import { formatSnapshotValue, snapshotNumericType } from '../../client/src/utils/reviewSnapshotFormat.js';
import { REVIEW_ACTIONS } from '../config/reviewActions.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const src = (p) => readFileSync(resolve(root, p), 'utf8');
const listings = src('server/controllers/Lot_Projects/Listings/Listings.controller.js');
const imports = src('server/controllers/Lot_Projects/Listings/ListingImports.controller.js');
const center = src('client/src/pages/System/ReviewCenter.jsx');
const diff = src('client/src/components/Shared/ReviewSnapshotDiff.jsx');
const workflow = src('server/controllers/System/workflow.controller.js');
const pricingKeys = [
  'installmentPricePerSqm','cashPricePerSqm','netSellingPrice','legalMiscRate',
  'legalMiscAmount','tcp','reservationFee','annualInterestRate',
];
const snap = (obj) => ({ unitCode: 'LA-1806', status: 'available', lotType: 'corner', lotAreaSqm: 300, ...obj });
const savedBefore = snap({ installmentPricePerSqm: 2600, cashPricePerSqm: 2300, netSellingPrice: 780000, legalMiscRate: 10, legalMiscAmount: 78000, tcp: 858000, reservationFee: 50000, annualInterestRate: 0 });
const savedAfter = snap({ ...savedBefore, installmentPricePerSqm: 2660, netSellingPrice: 798000, legalMiscAmount: 79800, tcp: 877800 });
const oldReview = (o = {}) => ({
  action_key: 'listing.edit', revision: 1, entity_id: '1806', initiated_by_user_id: 77,
  created_at: '2026-10-11 02:10:00',
  before_snapshot_json: snap({}), after_snapshot_json: snap({}),
  ...o,
});
const auditConnection = (rows) => {
  const calls = [];
  return {
    calls,
    async query(sql, args) { calls.push({sql,args}); return [rows]; },
  };
};

test('listing edit captures the saved installment and cash prices plus derived pricing on both sides', () => {
  assert.match(listings, /const storedListingReviewFinancials =/);
  assert.match(listings, /const listingReviewFinancialsAfterEdit =/);
  for (const key of pricingKeys) {
    assert.match(listings.slice(listings.indexOf('const storedListingReviewFinancials'),listings.indexOf('const buildProtectedListingEditPayload')),new RegExp(`\\b${key}\\b`));
  }
  const edit = listings.slice(listings.indexOf('// Every governed change reaches the Auditor'), listings.indexOf('    await connection.commit();',listings.indexOf('// Every governed change reaches the Auditor')));
  assert.match(edit, /const inventoryActionKey = 'listing.edit'/);
  assert.match(edit, /\.\.\.storedListingReviewFinancials\(existingListing\)/);
  assert.match(edit, /\.\.\.listingReviewFinancialsAfterEdit\(/);
});

test('listing create, delete and governed listing review include financial values', () => {
  const create = listings.slice(listings.indexOf("actionKey: 'listing.create'"),listings.indexOf('    await connection.commit();',listings.indexOf("actionKey: 'listing.create'")));
  const deletion = listings.slice(listings.indexOf('const deleteReview = await createOperationalReview'),listings.indexOf('    await connection.commit();',listings.indexOf('const deleteReview = await createOperationalReview')));
  assert.match(create, /listingReviewFinancialsAfterEdit/);
  assert.match(deletion, /storedListingReviewFinancials/);
  const governed = listings.slice(listings.indexOf('const governedBeforeSnapshot ='), listings.indexOf('    let inventoryReview ='));
  assert.match(governed,/storedListingReviewFinancials/);
  assert.match(governed,/isProtectedListing \? storedListingReviewFinancials/);
});

test('inventory review includes actual cadastral and document requirement changes', () => {
  assert.match(listings, /reviewCadastralDiff = \{/);
  assert.match(listings, /reviewDocumentsDiff = \{/);
  assert.match(listings, /reviewCadastralDiff\.before/);
  assert.match(listings, /reviewCadastralDiff\.after/);
  assert.match(listings, /reviewDocumentsDiff\.before/);
  assert.match(listings, /reviewDocumentsDiff\.after/);
});

test('bulk listing imports and reversals retain per-unit saved prices in reviews', () => {
  assert.match(imports, /listings: imported/);
  assert.match(imports, /removedUnits: removed/);
  assert.match(imports, /installmentPricePerSqm: row\.normalized\.installmentPricePerSqm/);
  assert.match(imports, /cashPricePerSqm: row\.normalized\.cashPricePerSqm/);
  assert.match(imports, /netSellingPrice: inserted\.pricing\.netSellingPrice/);
  assert.match(diff, /Show details for \{shown\.length\} records/);
});

test('price, count, percent and document values show correct readable values across ALL review roles', () => {
  assert.equal(snapshotNumericType('installmentPricePerSqm'), 'currency');
  assert.equal(formatSnapshotValue('installmentPricePerSqm', 2600), '₱2,600.00');
  assert.equal(formatSnapshotValue('installmentPricePerSqm', 2660), '₱2,660.00');
  assert.equal(formatSnapshotValue('netSellingPrice', 798000), '₱798,000.00');
  assert.equal(formatSnapshotValue('cashPricePerSqm', 2300), '₱2,300.00');
  assert.equal(formatSnapshotValue('annualInterestRate', 0), '0%');
  assert.equal(formatSnapshotValue('importedRows', 63), '63');
  assert.equal(formatSnapshotValue('isRequired', 1), 'Yes');
  assert.equal(formatSnapshotValue('isRequired', 0), 'No');
  assert.equal(formatSnapshotValue('documentId', 5, {lookups:{document:{5:'Proof of Income'}}}), 'Proof of Income');
});

test('payment bank account details are masked rather than exposed in read-only review snapshots', () => {
  assert.equal(formatSnapshotValue('accountNumber','1234567890123456'), '••••3456');
  assert.equal(formatSnapshotValue('bankAccountNumber','1234567890'), '••••7890');
  assert.equal(formatSnapshotValue('account_number','12345678'), '••••5678');
});

test('older single-revision listing review recovers exact prices only from uniquely matching historical audit data', async () => {
  const c = auditConnection([{metadata_json: JSON.stringify({before:savedBefore,after:savedAfter})}]);
  const review = oldReview();
  const restored = await enrichLegacyListingReviewSnapshots(c,review);
  assert.equal(restored.snapshotRecoveredFromAuditLog,true);
  assert.equal(restored.before_snapshot_json.installmentPricePerSqm,2600);
  assert.equal(restored.after_snapshot_json.installmentPricePerSqm,2660);
  assert.equal(restored.after_snapshot_json.netSellingPrice,798000);
  assert.equal(review.before_snapshot_json.installmentPricePerSqm,undefined);
  assert.equal(c.calls.length,1);
  assert.match(c.calls[0].sql,/module='Listings' AND action='update'/);
  assert.match(c.calls[0].sql,/entity_type='lot_project_listing'/);
  assert.match(c.calls[0].sql,/actor_user_id=\?/);
  assert.doesNotMatch(c.calls[0].sql,/^\s*(?:UPDATE|INSERT|DELETE)\b/i);
  assert.deepEqual(c.calls[0].args,['1806',77,'2026-10-11 02:10:00','2026-10-11 02:10:00']);
});

test('legacy recovery refuses ambiguous, mismatched, and revised events rather than guessing', async () => {
  const rows=[{metadata_json:JSON.stringify({before:savedBefore,after:savedAfter})}];
  for (const sourceRows of [[],rows.concat(rows),[{metadata_json:JSON.stringify({before:snap({...savedBefore,unitCode:'LA-9999'}),after:savedAfter})}]]) {
    const c = auditConnection(sourceRows);
    const review = oldReview();
    assert.equal(await enrichLegacyListingReviewSnapshots(c,review),review);
  }
  const c=auditConnection(rows);
  const revised=oldReview({revision:2});
  assert.equal(await enrichLegacyListingReviewSnapshots(c,revised),revised);
  assert.equal(c.calls.length,0);
});

test('all registered review features still share a generic before/after display with truthful no-differences messaging', () => {
  assert.ok(Object.keys(REVIEW_ACTIONS).length >= 30);
  for(const [key,def] of Object.entries(REVIEW_ACTIONS)) {
    assert.ok(def.entityType && def.department && def.label,`registered action ${key}`);
  }
  assert.match(center, /<ReviewSnapshotDiff beforeValue=\{review.before_snapshot_json\} afterValue=\{review.after_snapshot_json\}/);
  assert.match(center, /snapshotRecoveredFromAuditLog/);
  assert.match(workflow, /enrichLegacyListingReviewSnapshots\(db, review\)/);
  assert.match(diff, /This does not prove the record was unchanged/);
  assert.doesNotMatch(diff, /The saved values before and after this action are the same/);
  assert.match(workflow, /await load\('document'/);
});


test('Marketing Network Edit never invents rate changes; the separate rates review carries both snapshots', () => {
  const source = src('server/controllers/System/sellerGroup.controller.js');
  const block = source.slice(source.indexOf('let networkReview = null;'), source.indexOf('let rateReview = null;',source.indexOf('let networkReview = null;')));
  assert.match(block, /beforeSnapshot: beforeNetwork/);
  assert.match(block, /afterSnapshot: afterNetwork/);
  assert.doesNotMatch(block, /afterSnapshot: \{ \.\.\.afterNetwork, rates:/);
  const ratesBlock = source.slice(source.indexOf('let rateReview = null;', source.indexOf('let networkReview = null;')));
  assert.match(ratesBlock, /beforeSnapshot: beforeRates/);
  assert.match(ratesBlock, /afterSnapshot: afterRates/);
});


test('old baseline can be recovered when a later revision already contains trustworthy new after-price values', async () => {
  const review = oldReview({revision:2, after_snapshot_json: snap({...savedAfter,installmentPricePerSqm:2700, netSellingPrice:810000})});
  const restored = await enrichLegacyListingReviewSnapshots(auditConnection([{metadata_json: JSON.stringify({before:savedBefore,after:savedAfter})}]), review);
  assert.equal(restored.snapshotRecoveredFromAuditLog, true);
  assert.equal(restored.before_snapshot_json.installmentPricePerSqm,2600);
  assert.equal(restored.after_snapshot_json.installmentPricePerSqm,2700);
  assert.equal(restored.after_snapshot_json.netSellingPrice,810000);
});
