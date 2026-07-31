import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('seller creation hides the temporary password field', async () => {
  const source = await readProjectFile('client/src/components/System/userComponents/CreateUserModal.jsx');

  assert.match(source, /if \(!isSellerRole && !form\.password\.trim\(\)\)/);
  assert.match(source, /\{!isSellerRole \? \([\s\S]*Temporary Password/);
});

test('seller rows do not show the reset-password action', async () => {
  const source = await readProjectFile('client/src/pages/System/Users.jsx');

  assert.match(source, /const isSellerRecord = \(user\) => sellerRoles\.includes\(user\?\.role\)/);
  assert.match(source, /const canResetUserPassword = \(user\) => canResetPasswords && !isSellerRecord\(user\)/);
  assert.match(source, /\{canResetUserPassword\(user\) \? <button[\s\S]*Reset/);
});
