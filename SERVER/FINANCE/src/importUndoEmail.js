import {randomUUID} from 'node:crypto';
import {problem} from './domain.js';

export function undoVerificationEmailSettings(env = process.env) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
    throw problem('EMAIL_NOT_CONFIGURED', 'Admin email verification is unavailable. Configure RESEND_API_KEY and EMAIL_FROM on the Finance server.', 503);
  }
  return {key: env.RESEND_API_KEY, from: env.EMAIL_FROM};
}

export async function sendUndoVerificationEmail({email, name, fileName, code, expiresMinutes = 10}, {settings, send = fetch} = {}) {
  if (!settings?.key || !settings?.from) throw problem('EMAIL_NOT_CONFIGURED', 'Admin email verification is unavailable. Contact your administrator.', 503);
  let response;
  try {
    response = await send('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${settings.key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': randomUUID(),
      },
      body: JSON.stringify({
        from: settings.from,
        to: [email],
        subject: 'D&C Prime Finance – Import Undo Verification',
        text: `Hello ${name || 'Finance Admin'},\n\nA request was made to undo an imported Finance file:\n${fileName}\n\nYour verification code is: ${code}\n\nThis code expires in ${expiresMinutes} minutes and can authorize only this import undo. It can be used once. Do not share this code.\n\nIf you did not request this, ignore this email and keep your Finance account secure.\n`,
      }),
    });
  } catch {
    throw problem('UNDO_CODE_DELIVERY_FAILED', 'The verification email could not be sent. Try again later.', 503);
  }
  if (!response.ok) {
    throw problem('UNDO_CODE_DELIVERY_FAILED', 'The verification email could not be sent. Check the Finance email settings and try again.', 503);
  }
}
