import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getPaymentCalculations,
  calculateMonthlyAmortization,
} from '../../../CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/reserveUtils.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const shared = readFileSync(join(root, 'SERVER/SYSTEM/controllers/Lot_Projects/_shared/lotProject.shared.js'), 'utf8');
const previewUI = readFileSync(join(root, 'CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReservationPreviewPanels.jsx'), 'utf8');
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

// Execute the actual production SOA function in an isolated harness. This keeps
// the finance regression runnable even without DB, auth, or cloud SDK packages.
const section = (from, to) => {
  const start = shared.indexOf(from);
  const end = shared.indexOf(to, start);
  assert.ok(start >= 0 && end > start, `Expected production code for ${from}`);
  return shared.slice(start, end).replace('export const ', 'const ');
};

const actualSoaTerms = new Function(
  'roundMoneyValue', 'normalizeDateInput', 'getEffectiveSoaInterestRate', 'getMonthlyAmortizationAmount',
  `${section('export const getComputedSoaTerms =', 'export const createComputedSoaRows =')}\nreturn getComputedSoaTerms;`,
)(
  roundMoney,
  (value) => String(value).slice(0, 10),
  (row) => Number(Number(row.soa_interest_rate_overridden || 0) === 1 ? row.soa_annual_interest_rate : (row.annual_interest_rate ?? row.soa_annual_interest_rate ?? 0)),
  calculateMonthlyAmortization,
);

const actualSoaRows = new Function(
  'roundMoneyValue', 'addMonthsToDate', 'getOrdinalLabel',
  `${section('export const createComputedSoaRows =', 'export const getPaymentTargetRows =')}\nreturn createComputedSoaRows;`,
)(roundMoney, (date, index) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + index);
  return d.toISOString().slice(0,10);
}, (i) => `${i}th`);

const baseForm = {
  modeOfPayment: 'installment', reservationFee: '50000',
  legalMiscFeeMode: 'include_in_monthly', legalMiscFeeAmount: '0',
  downpaymentPercentageMode: '15', downpaymentTermsMode: '6',
  reservationFeeTreatment: 'apply_to_downpayment', dpDiscountPercentage: '0',
  monthlyTermsMode: '36', interestRate: '11.5',
};
const savedTerms = {
  soa_selected_tcp: 2240000,
  soa_selected_lmf_amount: 0,
  soa_mode_of_payment: 'installment', soa_reservation_fee: 50000,
  soa_reservation_fee_applied_to_downpayment: 1,
  soa_starting_date: '2026-10-27', soa_first_due_date: '2026-10-27',
  soa_downpayment_percentage: 15, soa_downpayment_terms: 6,
  soa_monthly_terms: 36, soa_dp_discount_percentage: 0,
  soa_legal_misc_fee_mode: 'include_in_monthly',
  annual_interest_rate: 11.5,
};

test('LA-1805 example: reserve applied to 15% DP cannot increase financed balance by ₱50,000', () => {
  const preview = getPaymentCalculations(2240000, baseForm).preview;
  const terms = actualSoaTerms(savedTerms, []);
  for (const value of [preview.dpTarget, terms.downpaymentTargetTotal]) assert.equal(value, 336000);
  assert.equal(preview.reservationFeeDownpaymentCredit, 50000);
  assert.equal(preview.dpGross, 286000);
  assert.equal(preview.dpNet, 286000);
  assert.equal(preview.dpAmountPerTerm, 47666.67);
  assert.equal(preview.balance, 1904000);
  assert.equal(terms.financedBalance, 1904000);
  assert.equal(preview.monthlyAmortization, 62786.32);
  assert.equal(terms.monthlyAmortization, 62786.32);
  assert.equal(terms.reservationFee + terms.downpaymentGrossTotal + terms.financedBalance, terms.principalTcp);
});

test('generated SOA contains ₱50,000 reservation and only ₱286,000 gross DP, with unchanged financed principal', () => {
  const terms = actualSoaTerms(savedTerms, []);
  const rows = actualSoaRows(terms);
  const reservation = rows.find((r) => r.scheduleType === 'reservation');
  const dps = rows.filter((r) => r.scheduleType === 'downpayment');
  const months = rows.filter((r) => r.scheduleType === 'monthly');
  assert.equal(reservation.principalAmount, 50000);
  assert.equal(dps.length, 6);
  assert.equal(roundMoney(dps.reduce((sum,r) => sum + r.principalAmount,0)), 286000);
  assert.equal(months.length, 36);
  assert.equal(months[0].dueAmount, 62786.32);
  assert.equal(terms.financedBalance, 1904000);
});

test('separate reservation treatment does not force 85% financed principal', () => {
  const preview = getPaymentCalculations(2240000,{...baseForm,reservationFeeTreatment:'separate'}).preview;
  const terms = actualSoaTerms({...savedTerms,soa_reservation_fee_applied_to_downpayment:0},[]);
  assert.equal(preview.dpNet, 336000);
  assert.equal(preview.balance, 1854000);
  assert.equal(terms.financedBalance, 1854000);
  assert.equal(terms.reservationFee + terms.downpaymentGrossTotal + terms.financedBalance, terms.principalTcp);
});

test('DP amount mode calculates financed principal from saved target, not remaining DP cash', () => {
  const preview = getPaymentCalculations(2240000, {
    ...baseForm, downpaymentPercentageMode:'amount', customDownpaymentAmount:'448000',
  }).preview;
  const terms = actualSoaTerms({
    ...savedTerms, soa_downpayment_input_mode:'amount', soa_downpayment_amount:448000,
    soa_downpayment_percentage:20,
  },[]);
  assert.equal(preview.dpNet, 398000);
  assert.equal(preview.balance, 1792000);
  assert.equal(terms.financedBalance, 1792000);
});

test('DP discount changes cash required but does not wrongly add principal to financing', () => {
  const preview = getPaymentCalculations(2240000, {...baseForm,dpDiscountPercentage:'5'}).preview;
  const terms = actualSoaTerms({...savedTerms,soa_dp_discount_percentage:5},[]);
  assert.equal(preview.dpDiscountAmount,16800);
  assert.equal(preview.dpNet,269200);
  assert.equal(preview.balance,1904000);
  assert.equal(terms.financedBalance,1904000);
  assert.equal(terms.downpaymentDiscountTotal,16800);
});

test('reservation UI labels the financed principal separately from unpaid SOA balance', () => {
  assert.match(previewUI,/Financed Principal \(After DP\)/);
  assert.match(previewUI,/SOA outstanding balance/);
  assert.doesNotMatch(previewUI,/<PreviewCard label="Balance" value=\{money\(paymentPreview\.balance\)\}/);
});

