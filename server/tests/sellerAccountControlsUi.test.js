import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readProjectFile = (relativePath) =>
  readFile(new URL(`../../${relativePath}`, import.meta.url), 'utf8');

test('system-user creation no longer exposes a temporary password field', async () => {
  const source = await readProjectFile('client/src/components/System/userComponents/CreateSystemUserModal.jsx');

  assert.doesNotMatch(source, /form\.password/);
  assert.doesNotMatch(source, /Temporary Password \*/);
  assert.match(source, /Final Review/);
  assert.match(source, /Role and account code become immutable account identity/);
});

test('System Users removes the redundant Reset Password action because login has Forgot Password', async () => {
  const source = await readProjectFile('client/src/pages/System/Users.jsx');

  assert.doesNotMatch(source, /const canReset = hasPermission/);
  assert.doesNotMatch(source, /resetMutation/);
  assert.doesNotMatch(source, /\/user\/resetPassword\/\$\{user\.id\}/);
  assert.doesNotMatch(source, /> Reset<\/button>/);
  assert.doesNotMatch(source, /Resend Login Credentials\?/);
  assert.doesNotMatch(source, /Generate & Send Credentials/);
});
