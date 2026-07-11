import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const routerDir = path.resolve(here, '../routers/System');

const protectedRouters = [
  'accredited.routers.js',
  'auditLogs.router.js',
  'documents.routers.js',
  'notifications.routers.js',
  'projects.routers.js',
  'sellerGroup.routers.js',
  'systemSettings.routers.js',
];

test('all non-login routers use centralized authentication', async () => {
  for (const filename of protectedRouters) {
    const source = await readFile(path.join(routerDir, filename), 'utf8');
    assert.match(source, /requireAuth/);
    assert.match(source, /router\.use\(requireAuth/);
  }
});

test('user management routes are behind authentication and super-admin role checks', async () => {
  const source = await readFile(path.join(routerDir, 'users.routers.js'), 'utf8');
  const managementGateIndex = source.indexOf('router.use(requireAuth, requirePasswordChanged, requireSuperAdmin)');
  const createUserIndex = source.indexOf("router.post('/createUser'");
  const resetPasswordIndex = source.indexOf("router.patch('/resetPassword/:id'");

  assert.ok(managementGateIndex > 0);
  assert.ok(createUserIndex > managementGateIndex);
  assert.ok(resetPasswordIndex > managementGateIndex);
  assert.match(source, /router\.post\('\/login', loginRateLimiter, login\)/);
});


test('legacy singular documents router was removed', async () => {
  await assert.rejects(
    access(path.join(routerDir, 'documents.router.js')),
    (error) => error?.code === 'ENOENT'
  );
});
