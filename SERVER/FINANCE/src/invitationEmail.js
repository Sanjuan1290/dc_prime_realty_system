import {problem} from './domain.js';
export function invitationSettings(env=process.env){
  const key=env.RESEND_API_KEY,from=env.EMAIL_FROM,url=env.FINANCE_PUBLIC_URL;
  let parsed;try{parsed=new URL(url);}catch{}
  if(!key||!from||!parsed||parsed.protocol!=='https:')throw problem('EMAIL_NOT_CONFIGURED','Account invitations need RESEND_API_KEY, EMAIL_FROM and an HTTPS FINANCE_PUBLIC_URL configured on the Finance server.',503);
  return {key,from,url:parsed.toString()};
}
export async function sendInvitation({email,name,password,requestId},{settings=invitationSettings(),send=fetch}={}){
  const response=await send('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${settings.key}`,'Content-Type':'application/json','Idempotency-Key':requestId},signal:AbortSignal.timeout(15000),body:JSON.stringify({from:settings.from,to:[email],subject:'Your D&C Prime Finance account',text:`Hello ${name},\n\nYour Finance account is ready.\nSign in: ${settings.url}\nEmail: ${email}\nTemporary password: ${password}\n\nThis password expires in 24 hours. You must choose a new password before accessing Finance. If you did not expect this invitation, contact your administrator.\n`})});
  if(!response.ok)throw problem('INVITATION_DELIVERY_FAILED','Invitation delivery failed.',503);
}
