import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('protected document metadata remains visible without a permanent public URL', async () => {
  const utilitiesPath = path.join(
    root,
    'client/src/components/Lot_Projects/ListingProfileComponents/Documents/documentFileUtils.js'
  );
  const { getDocumentFiles } = await import(pathToFileURL(utilitiesPath));

  const files = getDocumentFiles({
    name: 'Buyer Form',
    projectSlug: 'bailen-project',
    imageEntries: [{
      url: '',
      fileId: 42,
      fileName: 'buyer-form.jpg',
      cloudinaryPublicId: 'protected/buyer-form',
      cloudinaryDeliveryType: 'authenticated',
    }],
  });

  assert.equal(files.length, 1);
  assert.equal(files[0].protected, true);
  assert.equal(files[0].fileName, 'buyer-form.jpg');
  assert.equal(
    files[0].accessPath,
    '/projects/lot-projects/bailen-project/document-files/42/access-url'
  );
});

test('listing document mapper keeps protected entries that intentionally have no URL', () => {
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');
  assert.match(shared, /if \(!url && !accessPath && !fileId && !cloudinaryPublicId\) return null/);
  assert.match(
    shared,
    /getListingDocuments = async \([\s\S]*?connection,[\s\S]*?lotProjectId,[\s\S]*?listingId,[\s\S]*?clientProfileId,[\s\S]*?projectSlug = '',[\s\S]*?accountId = 0[\s\S]*?\) =>/
  );
  assert.match(shared, /cd\.lot_project_account_id = \?/);
  assert.match(shared, /parseClientDocumentImages\([\s\S]*?projectSlug[\s\S]*?\)/);
});

test('document modal and print page request short-lived links for protected files', () => {
  const modal = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/DocumentImagesModal.jsx');
  const printouts = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/Printouts.jsx');
  const printPage = read('client/src/components/Lot_Projects/ListingProfileComponents/Printouts/DocumentsPrintPage.jsx');

  assert.match(modal, /getDocumentFiles\(document\)/);
  assert.match(modal, /await useFetch\(file\.accessPath\)/);
  assert.match(modal, /Loading protected document previews/);
  assert.match(printouts, /projectSlug,/);
  assert.match(printPage, /getDocumentFiles\(\{ \.\.\.document, projectSlug \}\)/);
  assert.match(printPage, /await useFetch\(file\.accessPath\)/);
  assert.match(printPage, /Preparing protected document files/);
});
