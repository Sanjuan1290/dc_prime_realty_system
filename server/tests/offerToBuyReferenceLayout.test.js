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

test('Offer to Buy print and modal preview use one shared reference-form component', () => {
  const page = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage.jsx');
  const preview = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPreviewModal.jsx');

  assert.match(page, /import OfferToBuyForm from '\.\/OfferToBuyForm'/);
  assert.match(page, /<OfferToBuyForm listing=\{listing\} client=\{client\} soaRows=\{soaRows\}/);
  assert.match(preview, /import OfferToBuyForm from '\.\/OfferToBuyForm'/);
  assert.match(preview, /<OfferToBuyForm listing=\{listing\} client=\{client\} soaRows=\{soaRows\}/);
});

test('Offer to Buy shared form keeps the supplied April 2026 vector reference geometry on Legal paper', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyForm.jsx');

  for (const pattern of [
    /Offer To Buy & Buyer\\'s Profile/,
    /Real Estate Sales – For Individual/,
    /PROPERTY DESCRIPTION/,
    /OFFER TERMS AND CONDITIONS/,
    /INSTALLMENT\/In-house Financing/,
    /INDIVIDUAL BUYER\/s INFORMATION/,
    /Work\/Business Information/,
    /INCOME DETAILS \(MONTHLY\)/,
    /SIGNATURES of BUYER\/S/,
    /SALES AGENT:/,
    /OTB \(Individual\) – Revised April 2026/,
    /\(With Business\)/,
    /\(Professional\)/,
    /OFW\/immigrant/,
    /Permanent Address:/,
  ]) {
    assert.match(form, pattern);
  }

  // Legal / long bond is an exact 8.5in x 14in page.
  assert.match(form, /@page otb\s*\{[\s\S]*size:\s*legal portrait/);
  assert.match(form, /\.otb-page\s*\{[\s\S]*width:\s*8\.5in;[\s\S]*height:\s*14in;/);
  assert.match(form, /viewBox="0 0 612 1008"/);
  assert.match(form, /data-print-page-size="8\.5in 14in"/);

  // The form remains vector-based: the rules/text are recreated, not a raster background image.
  assert.match(form, /const H_LINES = \[/);
  assert.match(form, /const V_LINES = \[/);
  assert.match(form, /const TEXT_RUNS = \[/);
  assert.match(form, /const BUYER_CELLS = \[/);
  assert.match(form, /const ValLines =/);
  assert.doesNotMatch(form, /TEMPLATE_URL/);
  assert.doesNotMatch(form, /otb-template-image/);

  // The reference has no separate permanent zip cell; saved zip is appended to the address.
  assert.match(form, /PermanentZipCode/);
});

test('Offer to Buy uses Legal paper in every browser print path', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyForm.jsx');
  const shell = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPageShell.jsx');
  const preview = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/PrintPreviewModal.jsx');
  const pdfUtils = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/pdfExportUtils.js');

  assert.match(form, /size:\s*legal portrait/);
  assert.match(shell, /pageSize === 'legal' \? 'legal portrait'/);
  assert.match(preview, /type === 'offer' \? 'legal portrait' : 'A4 portrait'/);
  assert.match(pdfUtils, /containsOfferToBuy \? 'legal portrait' : 'A4 portrait'/);
  assert.match(preview, /openElementInPdfPrintWindow\(previewContentRef\.current/);
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

  assert.equal(resolveEmploymentStatus('Private Tutor').checkedKey, '');
  assert.equal(getEmploymentStatusOtherText('Private Tutor'), 'Private Tutor');
  assert.equal(resolveEmploymentStatus('Government Consultant').checkedKey, '');
  assert.equal(getEmploymentStatusOtherText('Government Consultant'), 'Government Consultant');
});

