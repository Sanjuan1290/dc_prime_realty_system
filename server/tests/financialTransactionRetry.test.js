import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isRetryableTransactionError,
  runExistingConnectionTransactionWithRetry,
} from '../utils/transactionRetry.js';

test('recognizes TiDB write-conflict errors in addition to deadlock and lock timeout', () => {
  assert.equal(isRetryableTransactionError({ errno: 1213 }), true);
  assert.equal(isRetryableTransactionError({ errno: 1205 }), true);
  assert.equal(isRetryableTransactionError({ errno: 8005 }), true);
  assert.equal(isRetryableTransactionError({ code: 'ER_LOCK_DEADLOCK' }), true);
  assert.equal(isRetryableTransactionError({ code: 'ER_LOCK_WAIT_TIMEOUT' }), true);
  assert.equal(isRetryableTransactionError({ errno: 1062, code: 'ER_DUP_ENTRY' }), false);
});

test('retries a transaction on the existing connection without releasing it', async () => {
  let attempts = 0;
  let begins = 0;
  let commits = 0;
  let rollbacks = 0;
  const connection = {
    async beginTransaction() { begins += 1; },
    async commit() { commits += 1; },
    async rollback() { rollbacks += 1; },
  };

  const result = await runExistingConnectionTransactionWithRetry(
    connection,
    async () => {
      attempts += 1;
      if (attempts === 1) throw Object.assign(new Error('write conflict'), { errno: 8005 });
      return 'ok';
    },
    { maxAttempts: 2, baseDelayMs: 0, label: 'test transaction' }
  );

  assert.equal(result, 'ok');
  assert.equal(attempts, 2);
  assert.equal(begins, 2);
  assert.equal(commits, 1);
  assert.equal(rollbacks, 1);
});


