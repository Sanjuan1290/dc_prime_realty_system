import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readClient = (relativePath) => readFileSync(new URL(`../../client/src/${relativePath}`, import.meta.url), 'utf8');

const matrix = readClient('components/System/userComponents/PermissionMatrix.jsx');
const roleAccess = readClient('components/System/settingsComponents/RoleAccessControl.jsx');

test('Role & Access Control hides Optional status labels while preserving selectable permissions', () => {
  assert.doesNotMatch(matrix, />Optional<\/span>/);
  assert.doesNotMatch(matrix, />Select All Optional<\/button>/);
  assert.doesNotMatch(matrix, />Clear Optional<\/button>/);
  // 2026-10-05 (plan item 26): Select All was limited to view permissions with a confirm click.
  assert.doesNotMatch(matrix, />Select All<\/button>/);
  assert.match(matrix, /Select all View/);
  assert.match(matrix, />Clear All<\/button>/);
  assert.match(matrix, /const isLocked = \(\) => disabled/);
  assert.match(matrix, /Outside normal role/);
  assert.doesNotMatch(matrix, />Not Allowed</);
  assert.doesNotMatch(roleAccess, /Optional permissions may be adjusted below\./);
  assert.match(roleAccess, /including permissions from other departments, can be added to any role/);
});
