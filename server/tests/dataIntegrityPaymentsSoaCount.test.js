import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');

test('Payments & SOA integrity summary counts payment records and exposes SOA row count', () => {
  const controller = read('controllers/System/dataIntegrity.controller.js');
  const page = read('../client/src/pages/System/DataIntegrity.jsx');

  assert.match(controller, /paymentsSoa:\s*\{[^}]*checked:\s*0[^}]*soaChecked:\s*0/);
  assert.match(controller, /summary\.categories\.paymentsSoa\.checked \+= Number\(report\.counts\?\.payments \|\| 0\)/);
  assert.match(controller, /summary\.categories\.paymentsSoa\.soaChecked \+= Number\(report\.counts\?\.schedules \|\| 0\)/);
  assert.match(page, /Payment records checked/);
  assert.match(page, /soaChecked/);
  assert.match(page, /SOA rows also validated/);
});
