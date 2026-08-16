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




const la1804PaymentForm = {
  modeOfPayment: 'installment',
  reservationFee: '50000',
  legalMiscFeeMode: 'separate_soa_row',
  legalMiscFeeAmount: '75000',
  downpaymentPercentageMode: 'custom',
  customDownpaymentPercentage: '20',
  downpaymentTermsMode: '6',
  reservationFeeTreatment: 'apply_to_downpayment',
  dpDiscountPercentage: '15',
  monthlyTermsMode: '12',
  customMonthlyTerms: '',
  interestRate: '0',
};

const la1804ListingTerms = {
  soa_selected_tcp: 825000,
  soa_selected_lmf_amount: 75000,
  soa_mode_of_payment: 'installment',
  soa_reservation_fee: 50000,
  soa_reservation_fee_applied_to_downpayment: 1,
  soa_starting_date: '2026-07-24',
  soa_first_due_date: '2026-07-24',
  soa_downpayment_percentage: 20,
  soa_downpayment_terms: 6,
  soa_monthly_terms: 12,
  soa_dp_discount_percentage: 15,
  soa_legal_misc_fee_mode: 'separate_soa_row',
  soa_legal_misc_fee_amount: 75000,
  annual_interest_rate: 0,
};

test('LA-1804 applies the DP discount before the reservation credit', () => {
  const preview = getPaymentCalculations(825000, la1804PaymentForm).preview;

  assert.equal(preview.principalBase, 750000);
  assert.equal(preview.dpTarget, 150000);
  assert.equal(preview.dpDiscountAmount, 22500);
  assert.equal(preview.discountedDpTarget, 127500);
  assert.equal(preview.reservationFeeDownpaymentCredit, 50000);
  assert.equal(preview.dpGross, 100000);
  assert.equal(preview.dpNet, 77500);
  assert.equal(preview.dpAmountPerTerm, 12916.67);
  assert.equal(preview.balance, 600000);
  assert.equal(preview.monthlyAmortization, 50000);
});

test('LA-1804 backend schedule stores gross DP principal and the full discount', () => {
  const terms = getComputedSoaTerms(la1804ListingTerms, []);
  const rows = createComputedSoaRows(terms);
  const downpaymentRows = rows.filter((row) => row.scheduleType === 'downpayment');

  assert.equal(terms.principalTcp, 750000);
  assert.equal(terms.downpaymentTargetTotal, 150000);
  assert.equal(terms.downpaymentDiscountTotal, 22500);
  assert.equal(terms.discountedDownpaymentTarget, 127500);
  assert.equal(terms.reservationFeeDownpaymentCredit, 50000);
  assert.equal(terms.downpaymentGrossTotal, 100000);
  assert.equal(terms.downpaymentTotal, 77500);
  assert.equal(terms.financedBalance, 600000);
  assert.equal(terms.monthlyAmortization, 50000);

  assert.equal(downpaymentRows.length, 6);
  assert.equal(downpaymentRows.reduce((sum, row) => sum + row.dueAmount, 0), 100000);
  assert.equal(downpaymentRows.reduce((sum, row) => sum + row.discountAmount, 0), 22500);
  assert.equal(
    Math.round(downpaymentRows.reduce((sum, row) => sum + row.dueAmount - row.discountAmount, 0) * 100) / 100,
    77500
  );
  assert.equal(downpaymentRows[0].dueAmount, 16666.67);
  assert.equal(downpaymentRows[0].discountAmount, 3750);
  assert.equal(Math.round((downpaymentRows[0].dueAmount - downpaymentRows[0].discountAmount) * 100) / 100, 12916.67);
});

test('LA-1804 reaches a 600,000 lot principal after reservation and discounted DP payments', () => {
  const terms = getComputedSoaTerms(la1804ListingTerms, []);
  const rows = createComputedSoaRows(terms);

  for (const row of rows) {
    if (row.scheduleType === 'reservation') {
      row.amountPaid = 50000;
      row.datePaid = '2026-07-24';
    }
    if (row.scheduleType === 'downpayment') {
      row.amountPaid = Math.round((row.dueAmount - row.discountAmount) * 100) / 100;
      row.datePaid = '2026-07-24';
    }
  }

  const computed = recomputeComputedSoaBalances(rows, terms);
  const sixthDownpayment = computed.find((row) => row.description === '6th Downpayment');
  const firstMonthly = computed.find((row) => row.description === '1st Monthly Payment');
  const legalMisc = computed.find((row) => row.description === 'Legal / Misc Fee');

  assert.equal(sixthDownpayment.endingBalance, 600000);
  assert.equal(firstMonthly.beginningBalance, 600000);
  assert.equal(firstMonthly.dueAmount, 50000);
  assert.equal(legalMisc.beginningBalance, 600000);
  assert.equal(legalMisc.endingBalance, 600000);
});

test('paying a separate Legal Misc Fee does not reduce the lot principal', () => {
  const terms = getComputedSoaTerms(la1804ListingTerms, []);
  const rows = createComputedSoaRows(terms);

  for (const row of rows) {
    if (row.scheduleType === 'reservation') {
      row.amountPaid = 50000;
      row.datePaid = '2026-07-24';
    }

    if (row.scheduleType === 'downpayment') {
      row.amountPaid = Math.round((row.dueAmount - row.discountAmount) * 100) / 100;
      row.datePaid = '2026-07-24';
    }

    if (row.description === '1st Monthly Payment') {
      row.amountPaid = 50000;
      row.datePaid = '2026-07-24';
    }

    if (row.scheduleType === 'legal_misc') {
      row.amountPaid = 75000;
      row.datePaid = '2026-07-24';
      // Simulates the stale value written by the previous implementation.
      row.paidPrincipalAmount = 75000;
    }
  }

  const computed = recomputeComputedSoaBalances(rows, terms);
  const firstMonthly = computed.find((row) => row.description === '1st Monthly Payment');
  const legalMisc = computed.find((row) => row.description === 'Legal / Misc Fee');

  assert.equal(firstMonthly.endingBalance, 550000);
  assert.equal(legalMisc.beginningBalance, 550000);
  assert.equal(legalMisc.endingBalance, 550000);
  assert.equal(legalMisc.amountPaid, 75000);
  assert.equal(legalMisc.paidPrincipalAmount, 0);
  assert.equal(legalMisc.status, 'Paid');
});
