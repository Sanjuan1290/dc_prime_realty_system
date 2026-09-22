import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSoaPdfBuffer,
  formatSoaReference,
  sanitizeAttachmentFileName,
} from '../services/paymentSoaPdf.service.js';

test('formats stable SOA references independently from schedule ids', () => {
  assert.equal(formatSoaReference(29, '2026-07-20'), 'SOA-2026-000029');
});

test('creates a safe PDF attachment filename', () => {
  assert.equal(
    sanitizeAttachmentFileName('SOA-2026-000029 - Bailen Project - LA-0101'),
    'SOA-2026-000029-Bailen-Project-LA-0101.pdf'
  );
});

test('builds a one-page Statement of Account PDF buffer', () => {
  const pdf = buildSoaPdfBuffer({
    soaReference: 'SOA-2026-000029',
    statementDate: '2026-07-20',
    notification: {
      notificationType: 'due_soon',
      projectName: 'Bailen Project',
      unitId: 'LA-0101',
      buyerName: 'Test Buyer',
      dueDate: '2026-07-25',
      description: 'Reservation Fee',
      totalContractPrice: 330000,
      legalMiscFee: 30000,
      paymentDue: 50000,
      penaltyAmount: 0,
      companyName: 'D&C Prime Realty',
      companyEmail: 'dcprimerealty@gmail.com',
      companyContactNumber: '(046) 866-0616',
    },
  });

  assert.ok(Buffer.isBuffer(pdf));
  assert.ok(pdf.length > 1500);
  assert.equal(pdf.subarray(0, 8).toString('latin1'), '%PDF-1.4');
  assert.match(pdf.toString('latin1'), /SOA-2026-000029/);
  assert.match(pdf.toString('latin1'), /STATEMENT OF ACCOUNT/);
  assert.match(pdf.toString('latin1'), /%%EOF/);
});
