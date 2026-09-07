import test from 'node:test';
import assert from 'node:assert/strict';
import { isRetryableTransactionError, runTransactionWithRetry } from '../utils/transactionRetry.js';

test('recognizes TiDB/MySQL deadlock and lock-timeout errors', () => {
  assert.equal(isRetryableTransactionError({ errno: 1213 }), true);
  assert.equal(isRetryableTransactionError({ errno: 1205 }), true);
  assert.equal(isRetryableTransactionError({ code: 'ER_LOCK_DEADLOCK' }), true);
  assert.equal(isRetryableTransactionError({ code: 'ER_LOCK_WAIT_TIMEOUT' }), true);
  assert.equal(isRetryableTransactionError({ errno: 1062, code: 'ER_DUP_ENTRY' }), false);
});

test('retries the whole transaction and releases every connection', async () => {
  let attempts = 0;
  let commits = 0;
  let rollbacks = 0;
  let releases = 0;
  const pool = {
    async getConnection() {
      return {
        async beginTransaction() {},
        async commit() { commits += 1; },
        async rollback() { rollbacks += 1; },
        release() { releases += 1; },
      };
    },
  };

  const result = await runTransactionWithRetry(
    pool,
    async () => {
      attempts += 1;
      if (attempts < 3) throw Object.assign(new Error('deadlock'), { errno: 1213 });
      return 'ok';
    },
    { maxAttempts: 3, baseDelayMs: 0 }
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 3);
  assert.equal(commits, 1);
  assert.equal(rollbacks, 2);
  assert.equal(releases, 3);
});
