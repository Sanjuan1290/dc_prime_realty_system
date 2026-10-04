import crypto from 'node:crypto';

const clean = (value) => String(value ?? '').trim();

export const SENSITIVE_ACTION_CODE_EXPIRY_MINUTES = Math.max(
  5,
  Math.min(Number(process.env.DESTRUCTIVE_ACTION_CODE_EXPIRY_MINUTES || 10), 30)
);

export const SENSITIVE_ACTION_CODE_MAX_ATTEMPTS = Math.max(
  3,
  Math.min(Number(process.env.DESTRUCTIVE_ACTION_MAX_ATTEMPTS || 5), 10)
);

const verificationSecret = () => {
  const secret = clean(
    process.env.DESTRUCTIVE_ACTION_CODE_SECRET ||
    process.env.AUDIT_DELETE_CODE_SECRET ||
    process.env.JWT_SECRET
  );
  if (!secret) {
    throw Object.assign(new Error('Set DESTRUCTIVE_ACTION_CODE_SECRET for sensitive-action verification.'), { statusCode: 500 });
  }
  return secret;
};

export const generateSensitiveActionCode = () => String(crypto.randomInt(100000, 1000000));

export const hashSensitiveActionCode = (code) => crypto
  .createHmac('sha256', verificationSecret())
  .update(clean(code))
  .digest('hex');

export const sensitiveActionCodeMatches = (code, expectedHash) => {
  const actual = Buffer.from(hashSensitiveActionCode(code), 'hex');
  const expected = Buffer.from(clean(expectedHash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
};

export const hashSensitiveActionPayload = (payload) => crypto
  .createHash('sha256')
  .update(JSON.stringify(payload))
  .digest('hex');

export const getSensitiveActionRequestIp = (req) => clean(
  req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || req.ip
).split(',')[0].trim();

export const maskSensitiveActionEmail = (email = '') => {
  const [local = '', domain = ''] = clean(email).split('@');
  if (!domain) return 'your account email';
  return `${local.slice(0, 2)}${'*'.repeat(Math.max(local.length - 2, 3))}@${domain}`;
};

export const expirePendingSensitiveActions = async (connection, userId, actionType) => {
  await connection.query(
    `UPDATE destructive_action_verifications
     SET status = 'expired'
     WHERE user_id = ? AND action_type = ? AND status = 'pending'`,
    [Number(userId), clean(actionType)]
  );
};

export const createSensitiveActionVerification = async (connection, {
  userId,
  actionType,
  entityType,
  entityId,
  payload,
  reason,
  requestIp,
}) => {
  const code = generateSensitiveActionCode();
  await expirePendingSensitiveActions(connection, userId, actionType);
  const [result] = await connection.query(
    `INSERT INTO destructive_action_verifications (
       user_id, action_type, entity_type, entity_id, code_hash, payload_hash, reason,
       attempt_count, max_attempts, expires_at, status, request_ip
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), 'pending', ?)`,
    [
      Number(userId),
      clean(actionType),
      clean(entityType),
      clean(entityId),
      hashSensitiveActionCode(code),
      hashSensitiveActionPayload(payload),
      clean(reason),
      SENSITIVE_ACTION_CODE_MAX_ATTEMPTS,
      SENSITIVE_ACTION_CODE_EXPIRY_MINUTES,
      clean(requestIp),
    ]
  );
  return { verificationId: Number(result.insertId), code };
};

export const verifyAndConsumeSensitiveAction = async (connection, {
  verificationId,
  userId,
  actionType,
  entityType,
  entityId,
  code,
  payload,
}) => {
  const [rows] = await connection.query(
    `SELECT *, expires_at < NOW() AS is_expired
     FROM destructive_action_verifications
     WHERE destructive_action_verification_id = ?
       AND user_id = ?
       AND action_type = ?
       AND entity_type = ?
       AND entity_id = ?
     LIMIT 1
     FOR UPDATE`,
    [Number(verificationId), Number(userId), clean(actionType), clean(entityType), clean(entityId)]
  );
  const verification = rows[0];
  if (!verification || verification.status !== 'pending') {
    return { ok: false, statusCode: 400, message: 'Verification request is no longer active.' };
  }
  if (Number(verification.is_expired || 0) === 1) {
    await connection.query(
      `UPDATE destructive_action_verifications SET status = 'expired' WHERE destructive_action_verification_id = ?`,
      [Number(verificationId)]
    );
    return { ok: false, statusCode: 400, message: 'This verification code has expired. Request a new code.' };
  }
  if (clean(verification.payload_hash) !== hashSensitiveActionPayload(payload)) {
    await connection.query(
      `UPDATE destructive_action_verifications SET status = 'expired' WHERE destructive_action_verification_id = ?`,
      [Number(verificationId)]
    );
    return { ok: false, statusCode: 409, message: 'The proposed correction changed after verification. Review it and request a new code.' };
  }

  const attemptCount = Number(verification.attempt_count || 0) + 1;
  if (!sensitiveActionCodeMatches(code, verification.code_hash)) {
    const status = attemptCount >= Number(verification.max_attempts || SENSITIVE_ACTION_CODE_MAX_ATTEMPTS) ? 'locked' : 'pending';
    await connection.query(
      `UPDATE destructive_action_verifications SET attempt_count = ?, status = ? WHERE destructive_action_verification_id = ?`,
      [attemptCount, status, Number(verificationId)]
    );
    return {
      ok: false,
      statusCode: status === 'locked' ? 429 : 401,
      message: status === 'locked' ? 'Too many incorrect codes. Request a new verification code.' : 'Verification code is incorrect.',
    };
  }

  await connection.query(
    `UPDATE destructive_action_verifications
     SET status = 'used', attempt_count = ?, verified_at = NOW(), used_at = NOW()
     WHERE destructive_action_verification_id = ?`,
    [attemptCount, Number(verificationId)]
  );
  return { ok: true, verification };
};
