import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('audit log router exposes archive endpoints and no delete-all endpoint', async () => {
  const router = await readProjectFile('routers/System/auditLogs.router.js');
  assert.match(router, /\/archive\/request/);
  assert.match(router, /\/archive\/confirm/);
  assert.doesNotMatch(router, /delete-all/i);
});

test('audit archival removes only records copied by cutoff and never runs DELETE FROM audit_logs without a WHERE clause', async () => {
  const controller = await readProjectFile('controllers/System/auditLogs.controller.js');
  assert.match(controller, /INSERT INTO audit_logs_archive/);
  assert.match(controller, /DELETE FROM audit_logs WHERE audit_log_created_at < \?/);
  assert.doesNotMatch(controller, /DELETE FROM audit_logs\s*[`;]/);
});

test('migration protects active and archived audit tables with database triggers', async () => {
  const migration = await readProjectFile('migrations/20260715_audit_log_archival.sql');
  assert.match(migration, /trg_audit_logs_archive_only_delete/);
  assert.match(migration, /Archived audit records are append-only/);
  assert.match(migration, /Audit archive events are append-only/);
});

