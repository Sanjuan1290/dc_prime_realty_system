import test from 'node:test';
import assert from 'node:assert/strict';
import { createRateLimiter } from '../middleware/rateLimit.middleware.js';

const makeResponse = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    payload: null,
    setHeader(name, value) { headers.set(name, value); },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; },
    headers,
  };
};

test('blocks requests after the configured limit', () => {
  const limiter = createRateLimiter({ windowMs: 60000, limit: 2 });
  const req = { ip: '127.0.0.1', socket: {} };

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const res = makeResponse();
    let continued = false;
    limiter(req, res, () => { continued = true; });
    assert.equal(continued, true);
    assert.equal(res.statusCode, 200);
  }

  const blocked = makeResponse();
  limiter(req, blocked, () => assert.fail('blocked request must not continue'));
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers.get('Retry-After')) >= 1);
});
