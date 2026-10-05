import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const matrix = readFileSync(new URL('../../client/src/components/System/userComponents/PermissionMatrix.jsx', import.meta.url), 'utf8');

test('Role & Access permission group cards do not render READ/OPERATE/SYSTEM/REVIEW/AUDIT kind badges', () => {
  assert.doesNotMatch(matrix, /\{group\.kind\s*\?/);
  assert.doesNotMatch(matrix, />\{group\.kind\}</);
});

test('Role & Access still renders group names and permission-state indicators', () => {
  assert.match(matrix, /\{group\.group\}/);
  assert.match(matrix, />Required</);
  // Intentional UI change: inherited access is labeled in plain language and
  // normal cross-department permissions warn instead of being blocked.
  assert.match(matrix, /From Staff Role/);
  assert.match(matrix, /Outside normal role/);
  assert.match(matrix, /Restricted governance/);
  assert.doesNotMatch(matrix, />Not Allowed</);
});
