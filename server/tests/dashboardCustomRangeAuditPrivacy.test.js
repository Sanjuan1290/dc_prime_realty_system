import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getRequestIpAddress, normalizeIpAddress, parseTrustProxySetting } from '../utils/requestIp.js';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('custom dashboard dates are not expanded to complete months', () => {
  const controller = read('server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js');
  assert.match(controller, /fromDate = requestedFrom;/);
  assert.match(controller, /toDate = requestedTo;/);
  assert.doesNotMatch(controller, /fromDate = startOfMonth\(requestedFrom\)/);
  assert.doesNotMatch(controller, /toDate = endOfMonth\(requestedTo\)/);
  assert.match(controller, /FROM lot_project_commissions c[\s\S]*DATE\(c\.created_at\) BETWEEN \? AND \?/);
  assert.match(controller, /groupPerformanceQuery[\s\S]*DATE\(c\.created_at\) BETWEEN \? AND \?/);
});

test('System and Lot dashboards send the selected exact dates', () => {
  const systemDashboard = read('client/src/pages/System/Dashboard.jsx');
  const lotDashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx');
  assert.match(systemDashboard, /range: dateRange,[\s\S]*from: fromDate,[\s\S]*to: toDate/);
  assert.match(lotDashboard, /new URLSearchParams\(\{ range: dateRange, from: dateFrom, to: dateTo \}\)/);
  assert.match(lotDashboard, /hasInvalidDateRange/);
  assert.match(systemDashboard, /max=\{isCustom \? toDate \|\| undefined : undefined\}/);
  assert.match(systemDashboard, /min=\{isCustom \? fromDate \|\| undefined : undefined\}/);
  assert.match(lotDashboard, /max=\{isCustom \? dateTo \|\| undefined : undefined\}/);
  assert.match(lotDashboard, /min=\{isCustom \? dateFrom \|\| undefined : undefined\}/);
});

test('audit details and normal audit API do not expose Metadata JSON', () => {
  const modal = read('client/src/components/System/auditLogsComponents/AuditLogDetailsModal.jsx');
  const controller = read('server/controllers/System/auditLogs.controller.js');
  assert.doesNotMatch(modal, /Metadata JSON/);
  assert.doesNotMatch(modal, /JSON\.stringify\(log\.metadata/);
  assert.doesNotMatch(controller, /metadata: parseMetadata\(row\.metadata_json\)/);
  assert.doesNotMatch(controller, /SELECT\s+al\.\*/);
});

test('request IP normalization supports local and proxied deployments', () => {
  assert.equal(normalizeIpAddress('::1'), '127.0.0.1');
  assert.equal(normalizeIpAddress('::ffff:203.0.113.8'), '203.0.113.8');
  assert.equal(getRequestIpAddress({ ip: '198.51.100.7' }), '198.51.100.7');
  assert.equal(parseTrustProxySetting('0'), false);
  assert.equal(parseTrustProxySetting('1'), 1);
  assert.equal(parseTrustProxySetting('true'), 1);
  assert.deepEqual(parseTrustProxySetting('loopback, linklocal'), ['loopback', 'linklocal']);
});


test('Lot Project Business Snapshot matches the System Dashboard metric definitions', () => {
  const lotDashboard = read('client/src/pages/Lot_Projects/Dashboard.jsx');
  for (const label of [
    'Total Gross Sales',
    'Cash Collected',
    'Penalty Accumulated',
    'Cash Collectibles − Discount',
    'Total Number of Reservations',
    'Total Net Sales',
    'Pending Cancellations',
    'Finalized Cancellations',
    'Refunded Amount',
    'Discontinued Amount',
  ]) {
    assert.equal(lotDashboard.includes(label), true);
  }
  assert.match(lotDashboard, /Formula: \{formula\}/);
  assert.doesNotMatch(lotDashboard, /label: 'Settled Value'/);
  assert.doesNotMatch(lotDashboard, /label: 'Payable Commission'/);
});
