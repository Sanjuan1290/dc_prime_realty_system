import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('Admin UI never offers Deactivate against a Super Admin target', () => {
  const users = read('client/src/pages/System/Users.jsx');
  assert.match(users, /canDeactivate && canManageTarget\(user\) && user\.status === 'active' && user\.id !== actor\.id/);
});

test('backend still enforces Super Admin target ownership', () => {
  const controller = read('server/controllers/System/users.controllers.js');
  assert.match(controller, /actorCanPerformUserAction/);
  assert.match(controller, /canActorManageUserRole/);
});

test('self-edit refreshes the acting session after auth_version invalidation', () => {
  const controller = read('server/controllers/System/users.controllers.js');
  assert.match(controller, /const refreshActorSessionAfterSelfEdit/);
  assert.match(controller, /auth_version = COALESCE\(auth_version, 0\) \+ 1/);
  assert.match(controller, /jwt\.sign\([\s\S]*authVersion: Number\(authVersion \|\| 0\)/);
  assert.match(controller, /res\.cookie\([\s\S]*getAuthCookieOptions/);
  assert.match(controller, /session_refreshed: sessionRefreshed/);
});

