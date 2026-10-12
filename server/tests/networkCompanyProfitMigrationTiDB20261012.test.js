import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = path.dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(path.resolve(directory, '../migrations/20261012_network_company_profit_releases.sql'), 'utf8');

// Regression protection against the previously rejected INSERT ... SELECT ... ON DUPLICATE syntax.
test('historical network profit accounts insert only when missing', () => {
  assert.match(sql, /INSERT INTO lot_project_network_profit_accounts[\s\S]+?FROM lot_project_commissions c/);
  assert.match(sql, /AND NOT EXISTS\s*\(\s*SELECT 1\s*FROM lot_project_network_profit_accounts existing[\s\S]+?existing\.lot_project_account_id = c\.lot_project_account_id[\s\S]+?existing\.seller_group_id = sg\.seller_group_id/);
  assert.match(sql, /HAVING MIN\(c\.company_profit_rate_snapshot\) = MAX\(c\.company_profit_rate_snapshot\)/);
});

test('only missing release stages insert without modifying historical payments', () => {
  assert.match(sql, /INSERT INTO lot_project_network_profit_releases[\s\S]+?CROSS JOIN\s*\(/);
  assert.match(sql, /WHERE NOT EXISTS\s*\(\s*SELECT 1\s*FROM lot_project_network_profit_releases existing[\s\S]+?existing\.profit_account_id = profit\.id[\s\S]+?existing\.release_stage = stage\.release_stage\s*\)/);
  assert.doesNotMatch(sql, /\bUPDATE\s+lot_project_network_profit_releases\b/i);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\b|\bTRUNCATE\b|\bDROP\s+TABLE\b/i);
  assert.doesNotMatch(sql, /\bON DUPLICATE KEY UPDATE\b/i);
});

test('retention stage balances rounding to the saved total', () => {
  assert.match(sql, /SELECT '1st Release' AS release_stage, 20 AS trigger_percent, 20 AS release_percent/);
  assert.match(sql, /SELECT '2nd Release',40,20/);
  assert.match(sql, /SELECT '3rd Release',60,20/);
  assert.match(sql, /SELECT '4th Release',75,15/);
  assert.match(sql, /SELECT 'Retention',100,25/);
  assert.match(sql, /profit\.gross_profit_snapshot - ROUND\(profit\.gross_profit_snapshot \* 0\.20, 2\) \* 3 - ROUND\(profit\.gross_profit_snapshot \* 0\.15, 2\)/);
});
