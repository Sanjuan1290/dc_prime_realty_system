import {randomUUID} from 'node:crypto';

const failures = Object.freeze({
  PAYROLL_UNDO_EMAIL_NOT_CONFIGURED: 'Verification email is not configured on the HR server. Set RESEND_API_KEY and EMAIL_FROM, then restart HR.',
  PAYROLL_UNDO_TEST_SENDER_RESTRICTED: 'Verification email was not sent. With the Resend test sender, use the email registered with Resend. Other recipients need a verified sender domain.',
  PAYROLL_UNDO_SENDER_NOT_VERIFIED: 'Verification email was not sent. Verify the sender domain in Resend and update EMAIL_FROM on the HR server.',
  PAYROLL_UNDO_EMAIL_AUTH_FAILED: 'Verification email was not sent. Check RESEND_API_KEY on the HR server, then restart HR.',
  PAYROLL_UNDO_EMAIL_LIMIT: 'The email service has reached its sending limit. Wait before requesting a new verification code.',
  PAYROLL_UNDO_EMAIL_TIMEOUT: 'The verification email request timed out. Request a new code.',
  PAYROLL_UNDO_EMAIL_FAILED: 'The verification email could not be delivered. Check the HR email settings and request a new code.',
});
export function payrollUndoEmailFailure(error) {
  const code = Object.hasOwn(failures, error?.code) ? error.code : 'PAYROLL_UNDO_EMAIL_FAILED';
  return Object.assign(new Error(failures[code]), {code, statusCode: 503});
}
const failure = code => payrollUndoEmailFailure({code});

// Verification codes do not contain links and do not need HR_PUBLIC_URL.
export function payrollUndoEmailSettings(env = process.env) {
  const key = String(env.RESEND_API_KEY || '').trim(), from = String(env.EMAIL_FROM || '').trim();
  if (!key || !from) throw failure('PAYROLL_UNDO_EMAIL_NOT_CONFIGURED');
  return {key, from};
}
export async function sendPayrollUndoEmail({email,code,payrollId,employee,reason}, {settings = payrollUndoEmailSettings(), send = fetch} = {}) {
  let response;
  try {
    response = await send('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(15000),
      headers: {Authorization: 'Bearer ' + settings.key, 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID()},
      body: JSON.stringify({from: settings.from, to: [email], subject: 'Confirm payroll undo — D&C Prime HR',
        text: `Your verification code is ${code}.\n\nUndo payroll #${payrollId} for ${employee}.\nReason: ${reason}\n\nThis code expires in 10 minutes and can be used once. If you did not request this, do not share the code. No payroll has been changed.`}),
    });
  } catch (error) {
    throw failure(['AbortError', 'TimeoutError'].includes(error?.name) ? 'PAYROLL_UNDO_EMAIL_TIMEOUT' : 'PAYROLL_UNDO_EMAIL_FAILED');
  }
  if (response.ok) return;
  let detail;
  try { detail = await response.json(); } catch { detail = null; }
  const message = typeof detail?.message === 'string' ? detail.message.toLowerCase() : '';
  if (response.status === 403 && message.includes('only send testing emails')) throw failure('PAYROLL_UNDO_TEST_SENDER_RESTRICTED');
  if (response.status === 403 && message.includes('domain') && message.includes('not verified')) throw failure('PAYROLL_UNDO_SENDER_NOT_VERIFIED');
  if (response.status === 401 || (response.status === 403 && ['restricted_api_key', 'suspended_api_key', 'invalid_permission'].includes(detail?.name))) throw failure('PAYROLL_UNDO_EMAIL_AUTH_FAILED');
  if (response.status === 429) throw failure('PAYROLL_UNDO_EMAIL_LIMIT');
  throw failure('PAYROLL_UNDO_EMAIL_FAILED');
}
