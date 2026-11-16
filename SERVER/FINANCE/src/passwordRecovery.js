import {getPool, withTransaction} from './db.js';
import {hashPassword} from './passwords.js';
import {audit} from './ledger.js';
import {recoveryMessage, resetEmail, validateReset, resetProblem, newResetToken, tokenHash, recoverySettings, dispatchResetEmail, createResetThrottle} from './passwordRecoveryCore.js';
const throttle = createResetThrottle();
export async function ensurePasswordRecoverySchema(pool) {
  const [tables] = await pool.execute("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='finance_password_resets'");
  if (tables.length) return;
  await pool.execute(`CREATE TABLE IF NOT EXISTS finance_password_resets (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY, token_hash CHAR(64) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL, requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_finance_password_reset_user FOREIGN KEY (user_id) REFERENCES finance_users(id) ON DELETE CASCADE
  )`);
}
export async function requestPasswordReset(body, ip, {settings: suppliedSettings, mailer} = {}) {
  const email = resetEmail(body?.email); throttle(ip, email);
  const settings = suppliedSettings || recoverySettings('finance');
  const [[user]] = await getPool().execute('SELECT id FROM finance_users WHERE email=? AND is_active=1 LIMIT 1', [email]);
  if (user) {
    const token = newResetToken();
    await getPool().execute(`INSERT INTO finance_password_resets(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE))
      ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),expires_at=VALUES(expires_at),requested_at=UTC_TIMESTAMP()`, [user.id, tokenHash(token)]);
    dispatchResetEmail({email, token, service: 'Finance'}, settings, mailer);
  }
  return {message: recoveryMessage};
}
export async function resetPassword(body) {
  const {hash, password} = validateReset(body);
  return withTransaction(async conn => {
    const [[user]] = await conn.execute(`SELECT u.id FROM finance_password_resets r INNER JOIN finance_users u ON u.id=r.user_id
      WHERE r.token_hash=? AND r.expires_at>UTC_TIMESTAMP() AND u.is_active=1 FOR UPDATE`, [hash]);
    if (!user) throw resetProblem('This password reset link is invalid or expired. Request a new link.');
    const passwordHash = hashPassword(password);
    await conn.execute('UPDATE finance_users SET password_hash=?,must_change_password=0,temporary_password_expires_at=NULL WHERE id=?', [passwordHash, user.id]);
    await conn.execute('UPDATE finance_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL', [user.id]);
    await conn.execute('DELETE FROM finance_password_resets WHERE user_id=?', [user.id]);
    await audit(conn, user.id, 'user.password.reset', 'user', user.id, {});
    return {message: 'Password changed. Sign in with your new password.'};
  });
}
