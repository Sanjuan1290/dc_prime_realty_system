import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PERMISSIONS } from '../config/permissions.js';

const read = (relativePath) => readFileSync(new URL(`../${relativePath}`, import.meta.url), 'utf8');
const matrix = read('../client/src/components/System/userComponents/PermissionMatrix.jsx');
const meta = read('../client/src/utils/permissionMeta.js');
const accessControl = read('controllers/System/accessControl.controller.js');

const catalogKeys = () => {
  const start = accessControl.indexOf('const permissionCatalog = [');
  const block = accessControl.slice(start, accessControl.indexOf('];', start));
  return [...block.matchAll(/PERMISSIONS\.([A-Z_]+)/g)].map(([, name]) => name);
};

test('each module offers one access level selector instead of a checkbox per permission', () => {
  assert.match(meta, /export const ACCESS_LEVELS/);
  for (const label of ['No access', 'View only', 'Can edit', 'Full access']) assert.match(meta, new RegExp(`label: '${label}'`));
  assert.match(meta, /export const getAccessTier/);
  assert.match(matrix, /role="radiogroup"/);
  assert.match(matrix, /applyLevel\(group, level\)/);
  assert.match(matrix, />Custom</);
  // 2026-10-06: no locked levels; every role sees the same four levels.
  assert.doesNotMatch(matrix, /'Role baseline'/);
  assert.doesNotMatch(matrix, /Fixed by role/);
});

test('levels are shortcuts over the same permission keys, so storage and server checks are unchanged', () => {
  assert.match(matrix, /optional\.forEach\(\(key\) => next\.delete\(key\)\)/);
  assert.match(matrix, /level\.keys\.forEach\(\(key\) => next\.add\(key\)\)/);
  assert.match(matrix, /commit\(next\)/);
  assert.doesNotMatch(matrix, /bitmask|JSON\.stringify/);
});

test('per-permission checkboxes stay available under each module, closed by default', () => {
  assert.match(matrix, /const \[expanded, setExpanded\] = useState\(\{\}\)/);
  assert.match(matrix, /Boolean\(needle \|\| filter !== 'all' \|\| expanded\[group\.group\]\)/);
  assert.match(matrix, /Show all details/);
  assert.match(matrix, /Hide all details/);
});

test('every module is listed for every role; nothing is folded away as restricted', () => {
  assert.doesNotMatch(matrix, /restrictedGroups/);
  assert.doesNotMatch(matrix, /Restricted governance/);
  assert.match(matrix, /\{orderedGroups\.map\(renderModule\)\}/);
});

test('sensitive and destructive keys need Full access; price list and buyer printouts count as viewing', () => {
  assert.match(meta, /if \(type === 'Delete' \|\| isSensitivePermission\(key\)\) return 'full'/);
  assert.match(meta, /PERMISSIONS\.SYSTEM_PROJECTS_PRINT_PRICE_LIST/);
  assert.match(meta, /PERMISSIONS\.LOT_PRINTOUTS_USE/);
  assert.doesNotMatch(meta, /VIEW_TIER_PRINTS = new Set\(\[[^\]]*SYSTEM_ACCREDITED_PRINT/);
});

test('catalog splits Reservations and Document Templates into their own modules without losing keys', () => {
  assert.match(accessControl, /group: 'Reservations'[\s\S]*LOT_RESERVATIONS_CREATE[\s\S]*LOT_RESERVATION_CORRECT/);
  assert.match(accessControl, /group: 'Document Templates'[\s\S]*SYSTEM_DOCUMENT_TEMPLATES_VIEW/);
  const keys = catalogKeys();
  assert.equal(new Set(keys).size, keys.length, 'every permission appears in exactly one module');
  for (const name of ['LOT_LISTINGS_VIEW', 'LOT_LISTING_PROFILE_VIEW', 'LOT_RESERVATIONS_CREATE', 'LOT_RESERVATION_CORRECT', 'SYSTEM_DOCUMENTS_DELETE', 'SYSTEM_DOCUMENT_TEMPLATES_DELETE']) {
    assert.ok(keys.includes(name), name);
    assert.ok(PERMISSIONS[name], name);
  }
});

