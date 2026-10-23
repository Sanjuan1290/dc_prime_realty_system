import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { ensureArchiveSettings } from '../services/archiveSettings.service.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = name => readFileSync(resolve(root, name), 'utf8');

const fakeDb = ({ tables = 4, settings = null } = {}) => {
  let row = settings;
  const queries = [];
  return {
    queries,
    async query(sql) {
      queries.push(sql);
      if (sql.includes('information_schema.tables')) return [[{ n: tables }]];
      if (sql.startsWith('SELECT archive_days')) return [row ? [row] : []];
      if (sql.startsWith('INSERT IGNORE INTO audit_archive_settings')) {
        if (!row) row = { archive_days: 180, auto_delete_enabled: 0 };
        return [{ affectedRows: 1 }];
      }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
  };
};

test('missing singleton row is seeded once using safe defaults', async () => {
  const db = fakeDb();
  assert.deepEqual(await ensureArchiveSettings(db), {archiveDays:180, autoDeleteEnabled:false});
  assert.equal(db.queries.filter(sql => sql.startsWith('INSERT IGNORE')).length, 1);
  assert.deepEqual(await ensureArchiveSettings(db), {archiveDays:180, autoDeleteEnabled:false});
  assert.equal(db.queries.filter(sql => sql.startsWith('INSERT IGNORE')).length, 1);
});

test('saved nondefault retention and automatic cleanup settings are never overwritten', async () => {
  const db = fakeDb({ settings: {archive_days:365, auto_delete_enabled:1} });
  assert.deepEqual(await ensureArchiveSettings(db), {archiveDays:365, autoDeleteEnabled:true});
  assert.equal(db.queries.filter(sql => sql.startsWith('INSERT IGNORE')).length, 0);
});

test('missing migration is reported as a domain-specific configuration error, not an outage', async () => {
  const db = fakeDb({tables:3});
  await assert.rejects(ensureArchiveSettings(db), err => err.statusCode === 503 && err.code === 'ARCHIVE_MIGRATION_REQUIRED');
  assert.equal(db.queries.filter(sql => sql.startsWith('INSERT IGNORE')).length, 0);
});

test('existing archive management migration remains non-destructive and automatic purge off by default', () => {
  const migration = read('server/migrations/20261018_audit_archive_management.sql');
  assert.match(migration,/CREATE TABLE IF NOT EXISTS audit_archive_settings/);
  assert.match(migration,/INSERT IGNORE INTO audit_archive_settings/);
  assert.match(migration,/auto_delete_enabled TINYINT\(1\) NOT NULL DEFAULT 0/);
});

test('archive endpoints serialize coded errors for local display', () => {
  const controller = read('server/controllers/System/auditArchiveManagement.controller.js');
  assert.match(controller,/ensureArchiveSettings/);
  assert.match(controller,/e\.code \? \{ code: e\.code \}/);
});

test('archive tabs show errors in place and use valid confirmation policies', () => {
  const ui = read('client/src/components/System/auditLogsComponents/AuditArchiveWorkspace.jsx');
  const client = read('client/src/utils/apiClient.js');
  assert.match(ui,/useFetch\(path,\{redirectOnUnavailable:false\}\)/);
  assert.match(ui,/loadError\?null:!data\?\.data\?\.length/);
  assert.match(ui,/historyError\?<p role="alert"/);
  assert.match(ui,/window\.confirm\('Save these archive cleanup settings/);
  for (const route of ['settings','protect','remove-request','remove-confirm']) {
    const call = ui.split(`useFetchPost('/audit-logs/archive/${route}'`)[1];
    assert.ok(call && call.slice(0,300).includes("confirmationHandled:'compact'"), route);
  }
  assert.match(client,/const CONFIRMATION_POLICIES = new Set\(\['compact', 'technical'\]\)/);
});

test('review shortcuts are gone but review sections and stable IDs remain', () => {
  const ui = read('client/src/pages/System/ReviewCenter.jsx');
  assert.doesNotMatch(ui,/aria-label="Review sections"/);
  assert.doesNotMatch(ui,/href=\{`#\$\{id\}`\}/);
  for (const id of ['review-overview','review-changes','review-history','review-decision'])
    assert.ok(ui.includes(`id="${id}"`), `${id} section missing`);
});
