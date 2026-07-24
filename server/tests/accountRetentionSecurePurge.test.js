import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { calculateCommissionableRetainedPercent } from '../services/lotProjectAccount.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('retained commission percentage drives 20 and 40 percent milestone eligibility', () => {
  assert.equal(calculateCommissionableRetainedPercent({ retainedAmount: 450000, commissionBase: 1000000 }), 45);
  assert.equal(calculateCommissionableRetainedPercent({ retainedAmount: 330000, commissionBase: 1000000 }), 33);
  assert.equal(calculateCommissionableRetainedPercent({ retainedAmount: 1200000, commissionBase: 1000000 }), 100);
});

test('secure purge requires super admin password and email-code routes', () => {
  const router = read('server/routers/System/projects.routers.js');
  const controller = read('server/controllers/Lot_Projects/Accounts/Accounts.controller.js');
  assert.match(router, /accounts\/:accountId\/purge-code/);
  assert.match(router, /requireExactRole\('super_admin'\)/);
  assert.match(router, /requireCurrentPassword/);
  assert.match(router, /accounts\/:accountId\/purge'/);
  assert.match(controller, /crypto\.randomInt\(100000, 1000000\)/);
  assert.match(controller, /timingSafeEqual/);
  assert.match(controller, /attempt_count/);
  assert.match(controller, /expires_at < NOW\(\)/);
});

test('document upload is server-signed and authenticated', () => {
  const uploader = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/UploadDocumentModal.jsx');
  const documents = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');
  const cloudinary = read('server/services/secureCloudinary.service.js');
  const env = read('client/.env.example');
  assert.match(documents, /upload-signature/);
  assert.match(uploader, /signature/);
  assert.match(cloudinary, /type: 'authenticated'/);
  assert.match(cloudinary, /private_download_url/);
  assert.doesNotMatch(env, /VITE_CLOUDINARY_UPLOAD_PRESET/);
});

test('earned cancellation milestones stay releasable and are not overwritten by normal payment syncing', () => {
  const controller = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  const modal = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');
  assert.match(controller, /'Earned on Cancellation', 'Forfeited on Cancellation'/);
  assert.match(controller, /\['Eligible', 'Earned on Cancellation'\]\.includes\(status\)/);
  assert.match(controller, /WHEN release_status IN \('Released', 'Cancelled', 'Earned on Cancellation', 'Forfeited on Cancellation'\)/);
  assert.match(modal, /Earned on Cancellation/);
  assert.match(modal, /Forfeited on Cancellation/);
});

test('migration keeps legacy cancelled snapshots as history-only accounts and links account-owned records', () => {
  const migration = read('server/migrations/20260720_account_retention_secure_purge_cloudinary.sql');
  assert.match(migration, /history-only accounts/i);
  assert.match(migration, /ACC-.*-H.*lot_project_reservation_history_id/s);
  assert.match(migration, /UPDATE lot_project_notification_logs/);
  assert.match(migration, /UPDATE lot_project_soa_statements/);
  assert.match(migration, /UPDATE lot_project_cancelled_sale_archives/);
});

test('legacy Cloudinary migration defaults to dry run and converts live and archived assets', () => {
  const script = read('server/scripts/migrate-cloudinary-buyer-documents.js');
  assert.match(script, /const apply = args\.has\('--apply'\)/);
  assert.match(script, /migrateLiveDocuments/);
  assert.match(script, /migrateArchivedDocuments/);
  assert.match(script, /to_type: 'authenticated'/);
  assert.match(script, /DRY RUN/);
});

test('current commission and SOA totals are isolated by buyer account', () => {
  const commissions = read('server/controllers/Lot_Projects/Commissions/Commissions.controller.js');
  const listingProfile = read('server/controllers/Lot_Projects/ListingProfile/ListingProfile.controller.js');
  const commissionGrouping = read('client/src/utils/commissionRecords.js');
  assert.match(commissions, /GROUP BY lot_project_client_profile_id/);
  assert.doesNotMatch(commissions, /payment_summary ON payment_summary\.lot_project_listing_id = c\.lot_project_listing_id/);
  assert.match(listingProfile, /current_account\.lot_project_account_id = l\.current_account_id/);
  assert.match(listingProfile, /payment_summary\.lot_project_client_profile_id = cp\.lot_project_client_profile_id/);
  assert.match(commissionGrouping, /`account-\$\{accountId\}`/);
});

test('normal listing deletion cannot bypass retained buyer-account history', () => {
  const controller = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const page = read('client/src/pages/Lot_Projects/Listings.jsx');
  assert.match(controller, /protectedHistoryTables/);
  assert.match(controller, /Permanently Delete Account Records from Account History/);
  assert.match(page, /ConfirmActionModal/);
  assert.doesNotMatch(page, /window\.confirm\(`Delete/);
});

test('payment and SOA writes belong to the listing current account and old schedules are retained', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  const payments = read('server/controllers/Lot_Projects/ListingProfile/PaymentsSOA.controller.js');

  assert.match(shared, /account\.lot_project_account_id = l\.current_account_id/);
  assert.match(shared, /cp\.lot_project_client_profile_id = account\.lot_project_client_profile_id/);
  assert.match(payments, /INSERT INTO lot_project_payments[\s\S]*lot_project_account_id/);
  assert.match(payments, /AND lot_project_client_profile_id = \?[\s\S]*AND schedule_status <> 'Cancelled'/);
  assert.match(payments, /UPDATE lot_project_payment_schedules[\s\S]*SET schedule_status = 'Cancelled'/);
  assert.doesNotMatch(payments, /DELETE FROM lot_project_payment_schedules WHERE lot_project_listing_id = \?/);
});

test('account foreign keys block accidental deletion outside the verified purge', () => {
  const migration = read('server/migrations/20260720_account_retention_secure_purge_cloudinary.sql');
  assert.match(migration, /fk_listing_current_account[\s\S]*SET NULL/);
  assert.match(migration, /fk_payment_account[\s\S]*RESTRICT/);
  assert.match(migration, /fk_payment_schedule_account[\s\S]*RESTRICT/);
  assert.match(migration, /fk_client_document_account[\s\S]*RESTRICT/);
  assert.match(migration, /fk_commission_account[\s\S]*RESTRICT/);
});

