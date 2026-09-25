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

test('User Management exposes Reset Password only through the granular reset permission', async () => {
  const source = await readProjectFile('client/src/pages/System/Users.jsx');

  assert.match(source, /SYSTEM_USERS_RESET_PASSWORD/);
  assert.match(source, /const canReset = hasPermission/);
  assert.match(source, /resetMutation/);
  assert.match(source, /\/user\/resetPassword\/\$\{user\.id\}/);
  assert.match(source, /canReset && user\.status === 'active'/);
  assert.doesNotMatch(source, /Resend Login Credentials\?/);
  assert.doesNotMatch(source, /Generate & Send Credentials/);
});
