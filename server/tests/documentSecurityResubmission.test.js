import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const sliceHandler = (source, startName, nextName) => {
  const start = source.indexOf(startName);
  assert.ok(start >= 0, `missing handler ${startName}`);
  const end = nextName ? source.indexOf(nextName, start + startName.length) : source.length;
  return source.slice(start, end > start ? end : source.length);
};

test('protected file delivery is server-proxied and never exposes the Cloudinary private URL to the browser', () => {
  const secure = read('server/services/secureCloudinary.service.js');
  const apiClient = read('client/src/utils/apiClient.js');
  const protectedFile = read('client/src/utils/protectedFile.js');

  assert.match(secure, /fetchAuthenticatedAssetContent/);
  assert.match(secure, /const privateUrl = createAuthenticatedAccessUrl/);
  assert.match(secure, /sendAuthenticatedAssetContent/);
  assert.match(secure, /Cache-Control', 'private, no-store, max-age=0, must-revalidate'/);
  assert.match(secure, /X-Content-Type-Options', 'nosniff'/);
  assert.match(apiClient, /export const requestApiBlob/);
  assert.match(protectedFile, /URL\.createObjectURL/);
  assert.match(protectedFile, /replace\(\/\\\/access-url\$\/, '\/content'\)/);
});

test('all protected viewer controllers expose status metadata plus authenticated content routes instead of raw signed URLs', () => {
  const documents = read('server/controllers/Lot_Projects/ListingProfile/Documents.controller.js');
  const proofs = read('server/controllers/Lot_Projects/ListingProfile/PaymentProofs.controller.js');
  const acknowledgement = read('server/controllers/Lot_Projects/ListingProfile/SignedAcknowledgement.controller.js');
  const income = read('server/controllers/System/ProofOfIncomeSignedCopies.controller.js');

  const documentAccess = sliceHandler(documents, 'export const getLotProjectDocumentFileAccessUrl', 'export const getLotProjectDocumentFileContent');
  const proofAccess = sliceHandler(proofs, 'export const getLotProjectPaymentProofAccessUrl', 'export const getLotProjectPaymentProofContent');
  const ackAccess = sliceHandler(acknowledgement, 'export const getLotProjectPaymentAcknowledgementSignedCopyAccessUrl', 'export const getLotProjectPaymentAcknowledgementSignedCopyContent');
  const incomeAccess = sliceHandler(income, 'export const getAccreditedSellerProofOfIncomeSignedCopyAccessUrl', 'export const getAccreditedSellerProofOfIncomeSignedCopyContent');

  for (const handler of [documentAccess, proofAccess, ackAccess, incomeAccess]) {
    assert.match(handler, /contentPath/);
    assert.doesNotMatch(handler, /createAuthenticatedAccessUrl/);
    assert.doesNotMatch(handler, /\burl\s*:/);
  }

  for (const source of [documents, proofs, acknowledgement, income]) {
    assert.match(source, /sendAuthenticatedAssetContent/);
  }
});

test('client document resubmission uses Rejected status and supersedes old files when corrected files arrive', () => {
  const controller = read('server/controllers/Lot_Projects/ListingProfile/Documents.controller.js');
  const router = read('server/routers/System/projects.routers.js');
  const page = read('client/src/pages/Lot_Projects/ListingProfile.jsx');
  const documents = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');

  assert.match(router, /documents\/:documentId\/resubmission/);
  assert.match(controller, /requestLotProjectListingDocumentResubmission/);
  assert.match(controller, /responsibleParty !== 'client'/);
  assert.match(controller, /lot_project_client_document_status = 'Rejected'/);
  assert.match(controller, /isResubmission/);
  assert.match(controller, /file_status = 'superseded'/);
  assert.match(controller, /Superseded by corrected document resubmission/);
  assert.match(page, /requestDocumentResubmissionMutation/);
  assert.match(documents, /Request Resubmission/);
  assert.match(documents, /Upload Corrected Copy/);
  assert.match(documents, /Needs Resubmission/);
  assert.match(documents, /\['Missing', 'Rejected'\]\.includes\(row\.status\)/);
});

test('signed Proof of Income supports safe deletion while keeping the generated unsigned receipt intact', () => {
  const controller = read('server/controllers/System/ProofOfIncomeSignedCopies.controller.js');
  const router = read('server/routers/System/accredited.routers.js');
  const modal = read('client/src/components/Shared/SignedCopyUploadModal.jsx');
  const accredited = read('client/src/pages/System/Accredited.jsx');

  assert.match(router, /signed-copy\/delete/);
  assert.match(controller, /deleteAccreditedSellerProofOfIncomeSignedCopy/);
  assert.match(controller, /destroyCloudinaryAssets/);
  assert.match(controller, /file_status = 'removed'/);
  assert.match(controller, /system-generated unsigned receipt is unchanged/i);
  assert.match(modal, /allowDelete = false/);
  assert.match(modal, /Delete Signed Copy/);
  assert.match(accredited, /allowDelete/);
});

test('SOA print header uses the D&C logo in the top-left brand block', () => {
  const soa = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/SOAPrintPage.jsx');
  assert.match(soa, /src="\/logo\.png"/);
  assert.match(soa, /alt="D&amp;C Prime Realty"/);
  assert.match(soa, /D&amp;C PRIME REALTY/);
});
