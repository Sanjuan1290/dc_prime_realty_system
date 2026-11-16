// Kept inside each deployable API; no cross-service database or auth access.
import {createHash, randomBytes, randomUUID} from 'node:crypto';
export const recoveryMessage = 'If this email has an active account, a password reset link will arrive shortly. Check your inbox and spam folder.';
export const resetProblem = (message, status = 400, code = 'PASSWORD_RESET_INVALID') => Object.assign(new Error(message), {status, statusCode: status, code});
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
export const newResetToken = () => randomBytes(32).toString('hex');
export function resetEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  if (email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw resetProblem('Enter a valid email address.');
  return email;
}
export function validateReset(body, maxBytes = Infinity) {
  const {token, new_password: password, confirm_password: confirmation} = body || {};
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw resetProblem('This password reset link is invalid or expired. Request a new link.');
  if (typeof password !== 'string' || password.length < 12 || password.length > 128 || Buffer.byteLength(password) > maxBytes) {
    throw resetProblem(maxBytes === 72 ? 'Use at least 12 characters and no more than 72 UTF-8 bytes for your password.' : 'Use 12–128 characters for your password.');
  }
  if (password !== confirmation) throw resetProblem('The passwords do not match.');
  return {hash: tokenHash(token), password};
}
export function createResetThrottle() {
  const attempts = new Map();
  return (ip, email, now = Date.now()) => {
    for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
    for (const [key, limit] of [['ip:' + String(ip || 'unknown'), 10], ['email:' + tokenHash(email), 3]]) {
      const state = attempts.get(key) || {count: 0, until: now + 15 * 60000};
      if (state.count >= limit) throw resetProblem('Too many reset requests. Please wait 15 minutes before trying again.', 429, 'PASSWORD_RESET_RATE_LIMITED');
      state.count++; attempts.set(key, state);
    }
  };
}
export function recoverySettings(service, env = process.env) {
  let url; try { url = new URL(env[service.toUpperCase() + '_PUBLIC_URL']); } catch {}
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM || !url || url.protocol !== 'https:' || url.username || url.password) {
    throw resetProblem('Password reset email is unavailable. Please contact your administrator.', 503, 'EMAIL_NOT_CONFIGURED');
  }
  url.hash = ''; return {key: env.RESEND_API_KEY, from: env.EMAIL_FROM, url: url.toString()};
}
export async function sendResetEmail({email, token, service}, {settings, send = fetch}) {
  const url = new URL(settings.url); url.hash = 'reset-password=' + token;
  const response = await send('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15000),
    headers: {Authorization: 'Bearer ' + settings.key, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID()},
    body: JSON.stringify({from: settings.from, to: [email], subject: `Reset your D&C Prime ${service} password`,
      text: `A password reset was requested for your D&C Prime ${service} account.\n\nChoose a new password: ${url}\n\nThis private link expires in 20 minutes and can be used once. If you did not request this, ignore this email. Your password has not changed.\n`}),
  });
  if (!response.ok) throw resetProblem('Password reset email could not be delivered.', 503, 'RESET_DELIVERY_FAILED');
}
// Return the same response for known and unknown emails without waiting on mail delivery.
export function dispatchResetEmail(data, settings, mailer = sendResetEmail) {
  Promise.resolve().then(() => mailer(data, {settings})).catch(() => console.error('[password reset] Email delivery failed.'));
}
