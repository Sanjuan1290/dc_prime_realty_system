import {problem} from './domain.js';
const failures = Object.freeze({
  INVITATION_TEST_SENDER_RESTRICTED: 'Invitation not sent. Resend’s test sender cannot email this person. Use a verified sender, then resend.',
  INVITATION_SENDER_NOT_VERIFIED: 'Invitation not sent. Verify the sender’s domain in Resend, then resend.',
  INVITATION_EMAIL_AUTH_FAILED: 'Invitation not sent. Check the Finance email API key, then resend.',
  INVITATION_EMAIL_LIMIT: 'Invitation not sent. The email service is busy or has reached its sending limit. Try again later.',
  INVITATION_DELIVERY_TIMEOUT: 'Email delivery timed out. Try resending the invitation.',
  INVITATION_DELIVERY_FAILED: 'Invitation not sent. The account is still pending. Check the email settings, then resend.',
});
export function invitationFailure(error) {
  const code = Object.hasOwn(failures, error?.code) ? error.code : 'INVITATION_DELIVERY_FAILED';
  return { code, message: failures[code] };
}
const deliveryError = code => problem(code, failures[code], 503);

export function invitationSettings(env=process.env){
  const key=env.RESEND_API_KEY,from=env.EMAIL_FROM,url=env.FINANCE_PUBLIC_URL;
  let parsed;try{parsed=new URL(url);}catch{}
  if(!key||!from||!parsed||parsed.protocol!=='https:')throw problem('EMAIL_NOT_CONFIGURED','Account invitations need RESEND_API_KEY, EMAIL_FROM and an HTTPS FINANCE_PUBLIC_URL configured on the Finance server.',503);
  return {key,from,url:parsed.toString()};
}
export async function sendInvitation({email,name,password,requestId},{settings=invitationSettings(),send=fetch}={}){
  let response;
  try {
    response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${settings.key}`,'Content-Type':'application/json','Idempotency-Key':requestId},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:settings.from,to:[email],subject:'Your D&C Prime Finance account',text:`Hello ${name},\n\nYour Finance account is ready.\nSign in: ${settings.url}\nEmail: ${email}\nTemporary password: ${password}\n\nThis password expires in 24 hours. You must choose a new password before accessing Finance. If you did not expect this invitation, contact your administrator.\n`})});
  } catch(error) {
    throw deliveryError(['AbortError','TimeoutError'].includes(error?.name) ? 'INVITATION_DELIVERY_TIMEOUT' : 'INVITATION_DELIVERY_FAILED');
  }
  if(response.ok)return;
  let detail;
  try { detail=await response.json(); } catch { detail=null; }
  const message=typeof detail?.message==='string'?detail.message.toLowerCase():'';
  if(response.status===403&&message.includes('only send testing emails'))throw deliveryError('INVITATION_TEST_SENDER_RESTRICTED');
  if(response.status===403&&message.includes('domain')&&message.includes('not verified'))throw deliveryError('INVITATION_SENDER_NOT_VERIFIED');
  if(response.status===401||(response.status===403&&['restricted_api_key','suspended_api_key','invalid_permission'].includes(detail?.name)))throw deliveryError('INVITATION_EMAIL_AUTH_FAILED');
  if(response.status===429)throw deliveryError('INVITATION_EMAIL_LIMIT');
  throw deliveryError('INVITATION_DELIVERY_FAILED');
}
