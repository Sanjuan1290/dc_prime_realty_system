import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(dirname, '..', '..');

const router = fs.readFileSync(
  path.join(root, 'server/routers/System/users.routers.js'),
  'utf8'
);
const limiter = fs.readFileSync(
  path.join(root, 'server/middleware/loginRateLimit.middleware.js'),
  'utf8'
);

test('login route is limited to ten attempts per fifteen-minute IP window', () => {
  assert.match(router, /import \{ loginRateLimit \} from '\.\.\/\.\.\/middleware\/loginRateLimit\.middleware\.js'/);
  assert.match(router, /router\.post\('\/login', loginRateLimit, login\)/);

  assert.match(limiter, /LOGIN_WINDOW_MS = 15 \* 60 \* 1000/);
  assert.match(limiter, /LOGIN_MAX_ATTEMPTS = 10/);
  assert.match(limiter, /getRequestIpAddress\(req\)/);
  assert.match(limiter, /status\(429\)/);
  assert.match(limiter, /LOGIN_RATE_LIMITED/);
  assert.match(limiter, /Retry-After/);
});
