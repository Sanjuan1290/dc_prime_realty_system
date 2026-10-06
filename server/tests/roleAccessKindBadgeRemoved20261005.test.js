import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const matrix = readFileSync(new URL('../../client/src/components/System/userComponents/PermissionMatrix.jsx', import.meta.url), 'utf8');

test('Role & Access permission group cards do not render READ/OPERATE/SYSTEM/REVIEW/AUDIT kind badges', () => {
  assert.doesNotMatch(matrix, /\{group\.kind\s*\?/);
  assert.doesNotMatch(matrix, />\{group\.kind\}</);
});

test('Role & Access still renders group names and the outside-normal warnings, with no locked states', () => {
  assert.match(matrix, /\{group\.group\}/);
  // 2026-10-06: Required / From Staff Role / Restricted governance were removed;
  // every permission is a normal checkbox and unusual access only warns.
  assert.doesNotMatch(matrix, />Required</);
  assert.doesNotMatch(matrix, /From Staff Role/);
  assert.doesNotMatch(matrix, /Restricted governance/);
  assert.match(matrix, /Outside normal role/);
  assert.match(matrix, /Usually System Admin only/);
  assert.doesNotMatch(matrix, />Not Allowed</);
});
