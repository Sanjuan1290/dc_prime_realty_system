const RETRYABLE_TRANSACTION_ERROR_NUMBERS = new Set([1205, 1213, 8005]);
const RETRYABLE_TRANSACTION_ERROR_CODES = new Set([
  'ER_LOCK_WAIT_TIMEOUT',
  'ER_LOCK_DEADLOCK',
  'WRITE_CONFLICT',
]);

export const isRetryableTransactionError = (error = {}) => {
  const errno = Number(error?.errno || error?.number || 0);
  const code = String(error?.code || '').trim().toUpperCase();
  return RETRYABLE_TRANSACTION_ERROR_NUMBERS.has(errno) || RETRYABLE_TRANSACTION_ERROR_CODES.has(code);
};

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

const rollbackQuietly = async (connection, label) => {
  try {
    await connection.rollback();
  } catch (rollbackError) {
    console.error(`${label} rollback failed:`, rollbackError?.message || rollbackError);
  }
};

export const runTransactionWithRetry = async (
  pool,
  operation,
  { maxAttempts = 3, baseDelayMs = 35, label = 'Database transaction' } = {}
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const connection = await pool.getConnection();
    let transactionStarted = false;

    try {
      await connection.beginTransaction();
      transactionStarted = true;

      const result = await operation(connection, { attempt });
      await connection.commit();
      transactionStarted = false;
      return result;
    } catch (error) {
      lastError = error;

      if (transactionStarted) {
        await rollbackQuietly(connection, label);
      }

      if (!isRetryableTransactionError(error) || attempt >= maxAttempts) {
        throw error;
      }
    } finally {
      connection.release();
    }

    await wait(baseDelayMs * attempt);
  }

  throw lastError || new Error(`${label} failed.`);
};

export const runExistingConnectionTransactionWithRetry = async (
  connection,
  operation,
  { maxAttempts = 3, baseDelayMs = 35, label = 'Database transaction' } = {}
) => {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    let transactionStarted = false;

    try {
      await connection.beginTransaction();
      transactionStarted = true;

      const result = await operation(connection, { attempt });
      await connection.commit();
      transactionStarted = false;
      return result;
    } catch (error) {
      lastError = error;

      if (transactionStarted) {
        await rollbackQuietly(connection, label);
      }

      if (!isRetryableTransactionError(error) || attempt >= maxAttempts) {
        throw error;
      }
    }

    await wait(baseDelayMs * attempt);
  }

  throw lastError || new Error(`${label} failed.`);
};


