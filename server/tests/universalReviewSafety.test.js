import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('all requestApi mutations are gated by the final review service before fetch', () => {
  const apiClient = read('client/src/utils/apiClient.js');
  const review = read('client/src/utils/mutationReview.js');
  const provider = read('client/src/components/Shared/MutationReviewProvider.jsx');
  const main = read('client/src/main.jsx');

  assert.match(main, /MutationReviewProvider/);
  assert.match(apiClient, /shouldReviewMutation\(normalizedPath, method/);
  assert.match(apiClient, /await requestMutationReview/);
  assert.match(apiClient, /Review cancelled.*Nothing was saved\./);
  assert.ok(apiClient.indexOf('await requestMutationReview') < apiClient.indexOf('const response = await fetch'));
  assert.match(review, /new Set\(\['POST', 'PUT', 'PATCH', 'DELETE'\]\)/);
  assert.match(review, /upload-signature/);
  assert.match(review, /\/preview/);
  assert.match(provider, /Back to Edit/);
  assert.match(provider, /Nothing is saved until the last step is confirmed/);
  assert.doesNotMatch(provider, /System action details/);
  assert.doesNotMatch(provider, /Method:<\/span>/);
  assert.doesNotMatch(provider, /Endpoint:<\/span>/);
  assert.doesNotMatch(provider, /hidden to keep this review focused/);
  assert.match(provider, /Every user-facing field in this step is shown/);
  assert.match(provider, /Blank values stay visible as “Not provided\.”/);
  assert.match(provider, /buildReviewSections/);
  assert.match(provider, /Final double-check · Step/);
  assert.match(provider, /Next: \{reviewSections/);
  assert.match(provider, /Previous/);
  assert.match(provider, /Payment Terms & Financials/);
  assert.match(provider, /Seller Assignment/);
});

test('only free-form text, number, and textarea controls get examples while Proceed treatment remains global', () => {
  const provider = read('client/src/components/Shared/MutationReviewProvider.jsx');
  const css = read('client/src/index.css');
  const reserveTerms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');

  assert.match(provider, /dc-input-example/);
  assert.match(provider, /`ex\. \$\{example\}`/);
  assert.match(provider, /const canShowInputExample = \(control\) =>/);
  assert.match(provider, /tagName === 'TEXTAREA'/);
  assert.match(provider, /\['text', 'number'\]\.includes\(inputType\)/);
  assert.match(provider, /document\.querySelectorAll\('input, textarea'\)/);
  assert.doesNotMatch(provider, /document\.querySelectorAll\('input, select, textarea'\)/);
  assert.match(provider, /custom\.\*daily\.\*penalty\.\*rate[\s\S]*?return '0\.15%'/);
  assert.match(provider, /custom\.\*monthly\.\*term[\s\S]*?return '30 months'/);
  assert.match(reserveTerms, /<option value="custom">Custom<\/option>/);
  assert.match(reserveTerms, /Custom Daily Penalty Rate \(%\)[\s\S]*?type="number"/);
  assert.match(css, /\.dc-input-example[\s\S]*?font-size: 10px/);
  assert.match(css, /font-style: italic/);
  assert.match(provider, /form button\[type="submit"\]/);
  assert.match(provider, /dc-proceed-submit/);
  assert.match(css, /content: 'Proceed'/);
});

test('public buyer form uses the same review-gated API request before submission', () => {
  const buyerForm = read('client/src/pages/Public/BuyerForm.jsx');
  assert.match(buyerForm, /requestApi/);
  assert.match(buyerForm, /Review Buyer Information/);
  assert.doesNotMatch(buyerForm, /fetch\(apiUrl\(`\/public\/buyer-forms/);
});

test('daily penalty presets are 0.01 through 0.10 with a 0.05 default', () => {
  const config = read('client/src/config/paymentTerms.js');
  const reserve = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const terms = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservePaymentTermsModal.jsx');
  const soa = read('client/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx');
  const controller = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const migration = read('server/migrations/20260807_daily_penalty_default_005.sql');

  assert.match(config, /DEFAULT_DAILY_PENALTY_RATE = 0\.05/);
  assert.match(config, /length: 10/);
  assert.match(config, /\(index \+ 1\) \/ 100/);
  assert.match(terms, /DAILY_PENALTY_RATE_OPTIONS/);
  assert.match(terms, /formatDailyPenaltyRateOption/);
  assert.match(terms, /default 0\.05%/i);
  assert.match(soa, /DEFAULT_DAILY_PENALTY_RATE/);
  assert.match(reserve, /dailyPenaltyRate: '0\.05'/);
  assert.match(controller, /penaltyRatePercent \?\? 0\.05/);
  assert.match(migration, /DEFAULT '0\.05'/);
});

test('reservation and proof-of-income use explicit final review wording', () => {
  const reserve = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const listingProfile = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const accredited = read('client/src/pages/System/Accredited.jsx');
  const commission = read('client/src/components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal.jsx');

  assert.match(reserve, /Proceed to Final Review/);
  assert.match(listingProfile, /Final Reservation Review/);
  assert.match(listingProfile, /Confirm & Reserve Listing/);
  assert.match(accredited, /Review Proof of Income Receipt/);
  assert.match(accredited, /Confirm, Generate & Print/);
  assert.match(accredited, /Proceed to Review/);
  assert.match(commission, /Proceed to Final Review/);
});


test('project checklist proceeds to the final review instead of claiming it already saves', () => {
  const projectModal = read('client/src/components/System/projectComponents/AddLotProjectModal.jsx');

  assert.match(projectModal, /Proceed to Final Review/);
  assert.match(projectModal, /Opening Review\.\.\./);
  assert.match(projectModal, /Preparing the final double-check/);
  assert.match(projectModal, /Final review closed\. You can continue editing; nothing was saved\./);
  assert.doesNotMatch(projectModal, /\{isEdit \? 'Save Changes' : 'Add Lot Project'\}/);
});
