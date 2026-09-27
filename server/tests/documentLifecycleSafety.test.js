import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const client = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

test('document deletion is usage-aware and cannot cascade-delete historical usage', () => {
  const controller = server('controllers/System/documents.controller.js');
  const start = controller.indexOf('export const deleteDocument = async');
  const end = controller.indexOf('export const deleteTemplate = async', start);
  const handler = controller.slice(start, end);

  assert.match(controller, /getDocumentUsageSummary/);
  assert.match(controller, /template_document_list/);
  assert.match(controller, /lot_project_default_documents/);
  assert.match(controller, /lot_project_listing_documents/);
  assert.match(controller, /lot_project_client_documents/);
  assert.match(controller, /lot_project_client_document_files/);
  assert.match(handler, /usage\.inUse/);
  assert.match(handler, /DOCUMENT_IN_USE/);
  assert.match(handler, /Deactivate it/);
  assert.doesNotMatch(handler, /safeDeleteByColumn/);
  assert.match(handler, /Permanently deleted unused document/);
});

test('document lifecycle exposes usage preflight plus deactivate/reactivate endpoints', () => {
  const controller = server('controllers/System/documents.controller.js');
  const router = server('routers/System/documents.routers.js');
  assert.match(controller, /export const getDocumentUsage/);
  assert.match(controller, /export const updateDocumentStatus/);
  assert.match(controller, /preservedExistingUsage:\s*true/);
  assert.match(router, /router\.get\('\/:id\/usage',\s*requirePermission\(PERMISSIONS\.SYSTEM_DOCUMENTS_VIEW\),\s*getDocumentUsage\)/);
  assert.match(router, /router\.patch\('\/:id\/status',\s*requirePermission\(PERMISSIONS\.SYSTEM_DOCUMENTS_EDIT\),\s*updateDocumentStatus\)/);
});

test('Document Library warns about usage and offers deactivation instead of destructive deletion', () => {
  const library = client('components/System/documentComponents/DocumentLibrary.jsx');
  assert.match(library, /This document is already in use/);
  assert.match(library, /Deactivate Document/);
  assert.match(library, /Delete Permanently/);
  assert.match(library, /Reactivate Document/);
  assert.match(library, /\/documents\/\$\{document\.document_id\}\/usage/);
  assert.match(library, /\/documents\/\$\{documentId\}\/status/);
});

test('listing profile preserves used documents and displays master deactivation separately from submission status', () => {
  const shared = server('controllers/Lot_Projects/_shared/lotProject.shared.js');
  const documents = client('components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');
  assert.match(shared, /d\.document_status AS library_document_status/);
  assert.match(shared, /libraryStatus:/);
  assert.match(documents, /Library Status/);
  assert.match(documents, /Submission Status/);
  assert.match(documents, /Deactivated/);
  assert.match(documents, /LibraryStatusPill/);
});
