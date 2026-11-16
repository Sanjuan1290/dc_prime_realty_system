import bcrypt from 'bcrypt';
import {db} from '../db/connect.js';
import {writeAuditLog} from '../controllers/System/auditLogs.controller.js';
import {recoveryMessage, resetEmail, validateReset, resetProblem, newResetToken, tokenHash, recoverySettings, dispatchResetEmail, createResetThrottle} from './passwordRecoveryCore.js';
const throttle = createResetThrottle();
async function assertPasswordRecoverySchema() {
  const [tables] = await db.query("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='hr_password_resets'");
  if (!tables.length) throw resetProblem('Password reset is temporarily unavailable. Please contact your administrator.', 503, 'PASSWORD_RESET_SETUP_REQUIRED');
}
export async function requestPasswordReset(body, ip, {settings: suppliedSettings, mailer} = {}) {
  const email = resetEmail(body?.email); throttle(ip, email);
  const settings = suppliedSettings || recoverySettings('hr');
  await assertPasswordRecoverySchema();
  const [[user]] = await db.query(`SELECT u.id FROM hr_users u INNER JOIN hr_login_identities i ON i.hr_user_id=u.id
    WHERE i.login_email=? AND u.account_status='active' AND i.login_state='active' LIMIT 1`, [email]);
  if (user) {
    const token = newResetToken();
    await db.query(`INSERT INTO hr_password_resets(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE))
      ON DUPLICATE KEY UPDATE token_hash=VALUES(token_hash),expires_at=VALUES(expires_at),requested_at=UTC_TIMESTAMP()`, [user.id, tokenHash(token)]);
    dispatchResetEmail({email, token, service: 'HR'}, settings, mailer);
  }
  return {message: recoveryMessage};
}
export async function resetPassword(body) {
  const {hash, password} = validateReset(body, 72);
  await assertPasswordRecoverySchema();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [[user]] = await conn.query(`SELECT u.id,u.display_name_snapshot FROM hr_password_resets r INNER JOIN hr_users u ON u.id=r.user_id
      INNER JOIN hr_login_identities i ON i.hr_user_id=u.id WHERE r.token_hash=? AND r.expires_at>UTC_TIMESTAMP()
      AND u.account_status='active' AND i.login_state='active' FOR UPDATE`, [hash]);
    if (!user) throw resetProblem('This password reset link is invalid or expired. Request a new link.');
    const passwordHash = await bcrypt.hash(password, 12);
    await conn.query('UPDATE hr_login_identities SET password_hash=?,must_change_password=0,auth_version=auth_version+1 WHERE hr_user_id=?', [passwordHash, user.id]);
    await conn.query('DELETE FROM hr_password_resets WHERE user_id=?', [user.id]);
    await writeAuditLog(conn, null, {actor: {id: user.id, displayName: user.display_name_snapshot}, action: 'password_reset', module: 'Authentication', entityType: 'hr_user', entityId: String(user.id), title: 'Password reset completed'});
    await conn.commit(); return {message: 'Password changed. Sign in with your new password.'};
  } catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
