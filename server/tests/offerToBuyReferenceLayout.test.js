import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getEmploymentStatusOtherText,
  isEmploymentStatusChecked,
  resolveEmploymentStatus,
} from '../../client/src/utils/employmentStatus.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Offer to Buy print and modal preview use one shared exact-template component', () => {
  const page = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage.jsx');
  const preview = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPreviewModal.jsx');

  assert.match(page, /import OfferToBuyForm from '\.\/OfferToBuyForm'/);
  assert.match(page, /<OfferToBuyForm listing=\{listing\} client=\{client\} soaRows=\{soaRows\}/);
  assert.match(preview, /import OfferToBuyForm from '\.\/OfferToBuyForm'/);
  assert.match(preview, /<OfferToBuyForm listing=\{listing\} client=\{client\} soaRows=\{soaRows\}/);
});

test('Offer to Buy uses the supplied April 2026 PDF page as the exact line template', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyForm.jsx');
  const templatePath = path.join(root, 'client/public/forms/offer-to-buy-individual-apr-2026.png');

  assert.equal(fs.existsSync(templatePath), true);
  assert.match(form, /offer-to-buy-individual-apr-2026\.png/);
  assert.match(form, /className="otb-template-image"/);
  assert.match(form, /Exact April 2026 reference form lines are supplied by the template image/);
  assert.doesNotMatch(form, /<table[\s>]/);
  assert.doesNotMatch(form, /border-collapse/);
});

test('Offer to Buy uses Legal 8.5 x 14 paper in preview, print page, and Save-as-PDF window', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyForm.jsx');
  const page = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage.jsx');
  const shell = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPageShell.jsx');
  const preview = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPreviewModal.jsx');
  const pdf = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/pdfExportUtils.js');

  assert.match(form, /width: 8\.5in/);
  assert.match(form, /height: 14in/);
  assert.match(page, /pageSize="legal"/);
  assert.match(shell, /pageSize === 'legal' \? '8\.5in 14in'/);
  assert.match(preview, /type === 'offer' \? '8\.5in 14in'/);
  assert.match(pdf, /containsOfferToBuy \? '8\.5in 14in' : 'A4 portrait'/);
});

test('Offer to Buy keeps data overlays for pricing, buyer profile, employment, income, and seller details', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyForm.jsx');

  for (const phrase of [
    'plainMoney(tcp)',
    'plainMoney(reservationFee)',
    'plainMoney(downpayment)',
    'principal.presentAddress',
    'second.presentAddress',
    'principal.employerName',
    'second.employerName',
    'plainMoney(monthlyIncome)',
    'sellerTinNo',
    'sellerAddress',
  ]) assert.match(form, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('predefined employment statuses check one box and leave Other blank', () => {
  const privateStatus = resolveEmploymentStatus('Employed - Private');
  assert.equal(privateStatus.checkedKey, 'private');
  assert.equal(privateStatus.otherText, '');
  assert.equal(isEmploymentStatusChecked('Employed - Private', 'private'), true);
  assert.equal(getEmploymentStatusOtherText('Employed - Private'), '');
  assert.equal(isEmploymentStatusChecked('Self-Employed', 'business'), true);
  assert.equal(isEmploymentStatusChecked('Professional', 'professional'), true);
  assert.equal(isEmploymentStatusChecked('OFW', 'ofw'), true);
});

test('unlisted employment statuses appear only on the Other line', () => {
  const student = resolveEmploymentStatus('Student');
  assert.equal(student.checkedKey, '');
  assert.equal(student.isOther, true);
  assert.equal(student.otherText, 'Student');
  assert.equal(getEmploymentStatusOtherText('Unemployed'), 'Unemployed');
  assert.equal(getEmploymentStatusOtherText('Other'), '');
});
