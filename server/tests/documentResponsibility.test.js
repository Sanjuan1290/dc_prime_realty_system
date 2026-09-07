import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizeDocumentResponsibleParty as normalizeClientResponsibleParty,
  resolveDocumentResponsibleParty as resolveClientResponsibleParty,
} from '../../client/src/utils/documentRequirement.js';
import {
  normalizeDocumentResponsibleParty,
  resolveDocumentResponsibleParty,
} from '../utils/documentRequirement.js';
import { buildMissingDocumentsPdfBuffer } from '../services/paymentSoaPdf.service.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('document responsibility normalizers support client, internal, and seller values', () => {
  for (const normalize of [normalizeDocumentResponsibleParty, normalizeClientResponsibleParty]) {
    assert.equal(normalize('client'), 'client');
    assert.equal(normalize('buyer'), 'client');
    assert.equal(normalize('company'), 'internal');
    assert.equal(normalize('Company / Internal'), 'internal');
    assert.equal(normalize('agent'), 'seller');
    assert.equal(normalize('Seller / Agent'), 'seller');
  }
});

test('document responsibility resolver uses listing/project/template overrides before library fallback', () => {
  const sample = {
    document_responsible_party: 'client',
    template_document_list_responsible_party: 'seller',
    lot_project_default_document_responsible_party: 'internal',
    lot_project_listing_document_responsible_party: 'seller',
  };
  assert.equal(resolveDocumentResponsibleParty(sample), 'seller');
  assert.equal(resolveClientResponsibleParty(sample), 'seller');
  assert.equal(resolveDocumentResponsibleParty({ document_responsible_party: 'internal' }), 'internal');
});

test('migration adds responsibility to library, template, project, and listing requirements', () => {
  const migration = read('server/migrations/20260816_document_responsibility.sql');
  assert.match(migration, /document_responsible_party ENUM\('client','internal','seller'\)/);
  assert.match(migration, /template_document_list_responsible_party ENUM\('client','internal','seller'\)/);
  assert.match(migration, /lot_project_default_document_responsible_party ENUM\('client','internal','seller'\)/);
  assert.match(migration, /lot_project_listing_document_responsible_party ENUM\('client','internal','seller'\)/);
  assert.match(migration, /UPDATE lot_project_listing_documents[\s\S]*document_responsible_party/);
});

test('document management UIs keep Required/Optional separate from Responsible Party', () => {
  const documents = read('client/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');
  const editRequirements = read('client/src/components/Lot_Projects/ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal.jsx');
  const addDocument = read('client/src/components/System/documentComponents/AddDocument.jsx');
  const addListing = read('client/src/components/Lot_Projects/ListingComponents/AddListingModal/AddListingModal.jsx');
  const reserve = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveListingModal.jsx');
  const reserveChecklist = read('client/src/components/Lot_Projects/ListingProfileComponents/ReserveListingModal/ReserveDocumentChecklistModal.jsx');

  assert.match(documents, /Missing \/ Optional/);
  assert.match(documents, /Responsible Party/);
  assert.match(documents, /client action/);
  assert.match(documents, /internal action/);
  assert.match(documents, /seller action/);

  for (const source of [editRequirements, addDocument, reserveChecklist]) {
    assert.match(source, /Company \/ Internal/);
    assert.match(source, /Seller \/ Agent/);
  }

  assert.match(addListing, /resolveDocumentResponsibleParty\(document\)/);
  assert.match(reserve, /resolveDocumentResponsibleParty\(document\)/);
  assert.match(reserve, /updateDocumentResponsibleParty/);
});

test('server writes responsibility through document, project, listing, and reservation flows', () => {
  const documentsController = read('server/controllers/System/documents.controller.js');
  const projectsController = read('server/controllers/System/projects.controller.js');
  const listingsController = read('server/controllers/Lot_Projects/Listings/Listings.controller.js');
  const listingDocuments = read('server/controllers/Lot_Projects/ListingProfile/Documents.controller.js');
  const reserveController = read('server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js');
  const shared = read('server/controllers/Lot_Projects/_shared/lotProject.shared.js');

  assert.match(documentsController, /document_responsible_party/);
  assert.match(documentsController, /template_document_list_responsible_party/);
  assert.match(projectsController, /lot_project_default_document_responsible_party/);
  assert.match(listingsController, /lot_project_listing_document_responsible_party/);
  assert.match(listingDocuments, /lot_project_listing_document_responsible_party/);
  assert.match(reserveController, /lot_project_listing_document_responsible_party/);
  assert.match(shared, /responsibleParty:\s*normalizeDocumentResponsibleParty/);
});

test('buyer document notifications are scoped only to client-responsible documents', () => {
  const controller = read('server/controllers/System/notifications.controller.js');
  const notificationsPage = read('client/src/pages/System/Notifications.jsx');

  assert.match(controller, /lot_project_listing_document_responsible_party = 'client'/);
  assert.match(controller, /optionalMissingDocuments/);
  assert.match(controller, /optionalRejectedDocuments/);
  assert.match(controller, /Documents Required From You/);
  assert.match(controller, /Internal\/company and seller\/agent documents are not included/i);
  assert.match(notificationsPage, /client document requirements/i);
  assert.match(notificationsPage, /Client Required/i);
});

test('client document PDF separates required action from optional documents', () => {
  const buffer = buildMissingDocumentsPdfBuffer({
    buyerName: 'Sample Buyer',
    projectName: 'Prime Project',
    unitId: 'PP-0101',
    missingDocuments: ['Intent to Buy'],
    rejectedDocuments: ['Buyer Profile'],
    optionalMissingDocuments: ['TIN No. / TIN ID'],
    optionalRejectedDocuments: ['Optional Supporting ID'],
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.subarray(0, 4).toString('latin1'), '%PDF');
  const pdfText = buffer.toString('latin1');
  assert.match(pdfText, /DOCUMENTS REQUIRED FROM YOU/);
  assert.match(pdfText, /REQUIRED DOCUMENTS FROM YOU/);
  assert.match(pdfText, /OPTIONAL CLIENT DOCUMENTS/);
  assert.match(pdfText, /MISSING \/ OPTIONAL/);
  assert.match(pdfText, /RESUBMIT \/ OPTIONAL/);
});
