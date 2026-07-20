import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createComputedSoaRows,
  getComputedSoaTerms,
  plainDate,
  recomputeComputedSoaBalances,
} from '../controllers/Lot_Projects/_shared/lotProject.shared.js';
import {
  calculateMonthlyAmortization,
  getPaymentCalculations,
} from '../../client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/reserveUtils.js';

const reservationPaymentForm = {
  modeOfPayment: 'installment',
  reservationFee: '50000',
  legalMiscFeeMode: 'separate_soa_row',
  legalMiscFeeAmount: '152260',
  downpaymentPercentageMode: 'custom',
  customDownpaymentPercentage: '20',
  downpaymentTermsMode: 'spot_cash',
  reservationFeeTreatment: 'apply_to_downpayment',
  dpDiscountPercentage: '0',
  monthlyTermsMode: '24',
  customMonthlyTerms: '',
  interestRate: '11.5',
};

const listingTermsRow = {
  lot_project_listing_tcp: 1674860,
  lot_project_listing_lmf_amount: 152260,
  lot_project_listing_reservation_fee: 50000,
  lot_project_listing_annual_interest_rate: 11.5,
  soa_mode_of_payment: 'installment',
  soa_reservation_fee: 50000,
  soa_reservation_fee_applied_to_downpayment: 1,
  soa_starting_date: '2099-07-13',
  soa_first_due_date: '2099-07-13',
  soa_downpayment_percentage: 20,
  soa_downpayment_terms: 0,
  soa_monthly_terms: 24,
  soa_annual_interest_rate: 11.5,
  soa_dp_discount_percentage: 0,
  soa_legal_misc_fee_mode: 'separate_soa_row',
  soa_legal_misc_fee_amount: 152260,
};

test('reservation preview uses amortized interest instead of principal divided by terms', () => {
  const result = getPaymentCalculations(1674860, reservationPaymentForm);

  assert.equal(result.preview.principalBase, 1522600);
  assert.equal(result.preview.dpTarget, 304520);
  assert.equal(result.preview.dpGross, 254520);
  assert.equal(result.preview.balance, 1218080);
  assert.equal(result.preview.monthlyAmortization, 57055.25);
});

test('monthly amortization helper handles zero and interest-bearing rates', () => {
  assert.equal(calculateMonthlyAmortization(1218080, 0, 24), 50753.33);
  assert.equal(calculateMonthlyAmortization(1218080, 11.5, 24), 57055.25);
});

test('backend SOA terms match the reservation preview', () => {
  const terms = getComputedSoaTerms(listingTermsRow, []);

  assert.equal(terms.principalTcp, 1522600);
  assert.equal(terms.downpaymentTargetTotal, 304520);
  assert.equal(terms.reservationFeeDownpaymentCredit, 50000);
  assert.equal(terms.downpaymentGrossTotal, 254520);
  assert.equal(terms.financedBalance, 1218080);
  assert.equal(terms.monthlyAmortization, 57055.25);
});

test('undated Legal/Misc fee stays unpaid and is excluded from remaining principal', () => {
  const terms = getComputedSoaTerms(listingTermsRow, []);
  const rows = recomputeComputedSoaBalances(createComputedSoaRows(terms), terms);
  const legalMiscRow = rows.find((row) => row.description === 'Legal / Misc Fee');
  const reservationRow = rows.find((row) => row.description === 'Reservation Fee');

  assert.ok(legalMiscRow);
  assert.equal(legalMiscRow.dueDate, null);
  assert.equal(legalMiscRow.status, 'Unpaid');
  assert.equal(legalMiscRow.beginningBalance, 1522600);
  assert.equal(legalMiscRow.endingBalance, 1522600);
  assert.equal(reservationRow.beginningBalance, 1522600);
});

test('plainDate can preserve a database NULL due date', () => {
  assert.equal(plainDate(null), '-');
  assert.equal(plainDate(null, null), null);
  assert.equal(plainDate('2026-07-13 10:00:00', null), '2026-07-13');
});


