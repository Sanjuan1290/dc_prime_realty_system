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

test('Offer to Buy shared form follows the supplied April 2026 section structure', () => {
  const form = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyForm.jsx');

  for (const label of [
    "Offer To Buy &amp; Buyer&apos;s Profile",
    'PROPERTY DESCRIPTION',
    'OFFER TERMS AND CONDITIONS',
    'INSTALLMENT/In-house Financing',
    'INDIVIDUAL BUYER/S INFORMATION',
    'Work/Business Information',
    'INCOME DETAILS (MONTHLY)',
    'SIGNATURES OF BUYER/S',
    'SALES AGENT:',
    'OTB (Individual) – Revised April 2026',
  ]) {
    assert.match(form, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(form, /Permanent Address:[\s\S]*PermanentZipCode/);
  assert.match(form, /Self-Employed \(With Business\)/);
  assert.match(form, /Self-Employed \(Professional\)/);
  assert.match(form, /OFW\/immigrant/);
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

  // Category words inside a custom job description must not select a checkbox.
  assert.equal(resolveEmploymentStatus('Private Tutor').checkedKey, '');
  assert.equal(getEmploymentStatusOtherText('Private Tutor'), 'Private Tutor');
  assert.equal(resolveEmploymentStatus('Government Consultant').checkedKey, '');
  assert.equal(getEmploymentStatusOtherText('Government Consultant'), 'Government Consultant');
});
