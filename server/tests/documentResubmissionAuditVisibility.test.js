import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const server = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const client = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

test('document resubmission writes a discoverable reject audit entry including its reason', () => {
  const documentsController = server('controllers/Lot_Projects/ListingProfile/Documents.controller.js');
  const auditController = server('controllers/System/auditLogs.controller.js');

  const start = documentsController.indexOf('export const requestLotProjectListingDocumentResubmission');
  const end = documentsController.indexOf('export const clearLotProjectListingDocument', start);
  const handler = documentsController.slice(start, end);

  assert.match(handler, /action:\s*'reject'/);
  assert.match(handler, /Requested client document resubmission/);
  assert.match(handler, /Reason:/);
  assert.match(handler, /reason:\s*reason \|\| null/);
  assert.match(auditController, /al\.metadata_json/);
  assert.match(auditController, /metadata:\s*parseMetadataJson\(row\.metadata_json\)/);
  assert.match(auditController, /CAST\(al\.metadata_json AS CHAR\) LIKE \?/);
});

test('audit UI shows resubmission reason and refreshes after the action', () => {
  const profile = client('pages/Lot_Projects/ListingProfile.jsx');
  const documents = client('components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx');
  const details = client('components/System/auditLogsComponents/AuditLogDetailsModal.jsx');

  assert.match(profile, /invalidateQueries\(\{ queryKey: \['audit-logs'\] \}\)/);
  assert.match(documents, /This will be recorded in Audit Logs/);
  assert.match(details, /log\.metadata\?\.reason/);
  assert.match(details, />Reason</);
});


test('audit UI labels document rejection as a resubmission action and exposes the status transition', () => {
  const table = client('components/System/auditLogsComponents/AuditLogTable.jsx');
  const details = client('components/System/auditLogsComponents/AuditLogDetailsModal.jsx');
  const filters = client('components/System/auditLogsComponents/AuditLogFilters.jsx');
  const documentController = server('controllers/Lot_Projects/ListingProfile/Documents.controller.js');

  assert.match(table, /Request Resubmission/);
  assert.match(table, /reject:\s*'bg-amber/);
  assert.match(details, /isDocumentResubmission/);
  assert.match(details, /Previous Status/);
  assert.match(details, /New Status/);
  assert.match(details, /Needs Resubmission/);
  assert.match(filters, /Reject \/ Resubmission/);
  assert.match(filters, /description, or reason/);
  assert.match(documentController, /newStatus:\s*'Rejected'/);
  assert.match(documentController, /newStatusLabel:\s*'Needs Resubmission'/);
});
