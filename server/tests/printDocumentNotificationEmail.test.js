import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildMissingDocumentsPdfBuffer } from '../services/paymentSoaPdf.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Offer to Buy print does not stretch the form with a forced blank bottom area', () => {
  const page = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/OfferToBuyPrintPage.jsx');
  assert.doesNotMatch(page, /min-height:\s*276mm/);
  assert.match(page, /\.otb-form\s*\{[\s\S]*min-height:\s*0\s*!important;[\s\S]*height:\s*auto\s*!important;/);
});

test('Document Notifications exposes a send email action backed by an authenticated route', () => {
  const page = read('client/src/pages/System/Notifications.jsx');
  const router = read('server/routers/System/notifications.routers.js');
  const controller = read('server/controllers/System/notifications.controller.js');

  assert.match(page, /Send Email/);
  assert.match(page, /notifications\/documents\/\$\{listingId\}\/\$\{clientProfileId\}\/send/);
  assert.match(router, /documents\/:listingId\/:clientProfileId\/send/);
  assert.match(controller, /export const sendDocumentNotification/);
  assert.match(controller, /buildMissingDocumentsPdfBuffer/);
  assert.match(controller, /contentType:\s*'application\/pdf'/);
});

test('Payment and document notification emails use the configured Cloudinary logo as an inline image', () => {
  const controller = read('server/controllers/System/notifications.controller.js');
  const envExample = read('server/.env.example');

  assert.match(controller, /EMAIL_LOGO_CID/);
  assert.match(controller, /process\.env\.EMAIL_LOGO_URL/);
  assert.match(controller, /cid:\s*EMAIL_LOGO_CID/);
  assert.match(controller, /buildBrandedEmailHtml/);
  assert.match(envExample, /EMAIL_LOGO_URL=https:\/\/res\.cloudinary\.com\/dvazrmgq9\/image\/upload\/v1784705909\/logo-mobile_2_i0damo\.png/);
});

test('Missing document requirements attachment is a valid PDF buffer', () => {
  const buffer = buildMissingDocumentsPdfBuffer({
    buyerName: 'Sample Buyer',
    projectName: 'Bailen Project',
    unitId: 'LA-0001',
    missingDocuments: ["BUYER'S INFORMATION FORM", 'INTENT TO BUY'],
    rejectedDocuments: ['CLIENT REGISTRATION FORM'],
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF');
  assert.ok(buffer.length > 1000);
});


const tinyJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AYf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AYf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/Aqf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/Iaf/2gAMAwEAAgADAAAAEP/EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z',
  'base64'
);

test('PDF attachments embed the configured logo instead of always drawing the fallback mark', () => {
  const controller = read('server/controllers/System/notifications.controller.js');
  const buffer = buildMissingDocumentsPdfBuffer({
    buyerName: 'Sample Buyer',
    projectName: 'Bailen Project',
    unitId: 'LA-0001',
    missingDocuments: ['Document 1'],
    logoImage: { content: tinyJpeg },
  });
  const pdfText = buffer.toString('latin1');

  assert.match(controller, /getCloudinaryJpegUrl/);
  assert.match(controller, /const pdfLogoImage = await getPdfLogoImage\(\)/);
  assert.match(controller, /logoImage: pdfLogoImage/);
  assert.match(pdfText, /\/Subtype \/Image/);
  assert.match(pdfText, /\/Logo Do/);
});

test('Missing-document numbering continues across both PDF columns', () => {
  const documents = Array.from({ length: 14 }, (_, index) => `Required Document ${index + 1}`);
  const buffer = buildMissingDocumentsPdfBuffer({
    buyerName: 'Sample Buyer',
    projectName: 'Prime Enclave Project',
    unitId: 'PE-0103',
    missingDocuments: documents,
  });
  const pdfText = buffer.toString('latin1');

  assert.match(pdfText, /\(1\.\) Tj/);
  assert.match(pdfText, /\(7\.\) Tj/);
  assert.match(pdfText, /\(8\.\) Tj/);
  assert.match(pdfText, /\(14\.\) Tj/);
});
