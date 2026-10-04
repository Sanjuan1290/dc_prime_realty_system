import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('daily penalty scheduler replaces the old hourly job name and interval', () => {
  const job = read('server/jobs/dailyPenalty.job.js');
  const server = read('server/server.js');

  assert.match(job, /export const startDailyPenaltyScheduler/);
  assert.doesNotMatch(job, /export const startDailyPenaltyJob/);
  assert.doesNotMatch(job, /setInterval\s*\(/);
  assert.match(server, /import \{ startDailyPenaltyScheduler \}/);
  assert.match(server, /startDailyPenaltyScheduler\(\)/);
  assert.doesNotMatch(server, /startDailyPenaltyJob/);
});

test('scheduler targets 00:05 Asia Manila and checks for a missed run on startup', () => {
  const job = read('server/jobs/dailyPenalty.job.js');

  assert.match(job, /DAILY_RUN_TIME = '00:05:00'/);
  assert.match(job, /MANILA_UTC_OFFSET = '\+08:00'/);
  assert.match(job, /timeZone: 'Asia\/Manila'/);
  assert.match(job, /runDailyPenaltyRefreshIfDue/);
  assert.match(job, /source: 'startup'/);
});

test('scheduler state serializes same-day claims and records completion', () => {
  const job = read('server/jobs/dailyPenalty.job.js');
  const migration = read('server/migrations/20260816_daily_penalty_scheduler.sql');

  assert.match(job, /FROM system_scheduled_job_state[\s\S]*FOR UPDATE/);
  assert.match(job, /last_success_date/);
  assert.match(job, /already_completed/);
  assert.match(job, /already_running/);
  assert.match(job, /lock_expires_at/);
  assert.match(job, /status = 'completed'/);
  assert.match(job, /status = 'failed'/);

  assert.match(migration, /CREATE TABLE IF NOT EXISTS system_scheduled_job_state/);
  assert.match(migration, /PRIMARY KEY \(job_name\)/);
  assert.match(migration, /daily_penalty_refresh/);
});

test('financial penalty calculation remains delegated to refreshListingPenaltyCache', () => {
  const job = read('server/jobs/dailyPenalty.job.js');

  assert.match(job, /await refreshListingPenaltyCache\(connection, listing, asOfDate\)/);
  assert.match(job, /soa_penalty_calculation_method = 'daily'/);
  assert.match(job, /lot_project_client_profile_status = 'active'/);
  assert.match(job, /lot_project_listing_status = 'sold'/);
});
