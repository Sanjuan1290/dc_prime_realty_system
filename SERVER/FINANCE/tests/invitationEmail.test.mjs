import test from 'node:test';
import assert from 'node:assert/strict';
import { invitationSettings, sendInvitation, invitationFailure } from '../src/invitationEmail.js';

const settings={key:'synthetic-provider-key',from:'Finance <onboarding@resend.dev>',url:'https://qa.invalid/finance'};
const invitation={email:'recipient@qa.invalid',name:'QA User',password:'Synthetic-private-password!',requestId:'synthetic-request'};
const rejected=(status,message,name='validation_error')=>async()=>({ok:false,status,json:async()=>({message,name})});
test('Finance invitations require their own server email settings',()=>{
  assert.throws(()=>invitationSettings({}),{code:'EMAIL_NOT_CONFIGURED'});
  assert.throws(()=>invitationSettings({RESEND_API_KEY:'qa',EMAIL_FROM:'qa@invalid',FINANCE_PUBLIC_URL:'http://qa.invalid/finance'}),{code:'EMAIL_NOT_CONFIGURED'});
  assert.equal(invitationSettings({RESEND_API_KEY:'qa',EMAIL_FROM:'qa@invalid',FINANCE_PUBLIC_URL:'https://qa.invalid/finance'}).url,'https://qa.invalid/finance');
});
test('A successful invitation sends the private password only in the email and returns no credentials',async()=>{
  let body;
  const result=await sendInvitation(invitation,{settings,send:async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');assert.equal(options.method,'POST');assert.equal(options.headers['Idempotency-Key'],invitation.requestId);
    body=JSON.parse(options.body);return {ok:true};
  }});
  assert.equal(result,undefined);assert.deepEqual(body.to,[invitation.email]);assert.ok(body.text.includes(invitation.password));assert.ok(body.text.includes(settings.url));
});
test('The testing-sender restriction explains the required verified sender without returning provider text',async()=>{
  let failure;
  try{await sendInvitation(invitation,{settings,send:rejected(403,'You can only send testing emails to your own email address (owner@qa.invalid). Verify a domain.')} )}catch(error){failure=invitationFailure(error)}
  assert.equal(failure.code,'INVITATION_TEST_SENDER_RESTRICTED');assert.match(failure.message,/verified sender/);assert.doesNotMatch(JSON.stringify(failure),/owner@|Synthetic-private|synthetic-provider/);
});
test('Unverified domains, rejected keys and sending limits produce specific, safe errors',async()=>{
  for(const [status,message,name,code] of [
    [403,'The qa.invalid domain is not verified.','validation_error','INVITATION_SENDER_NOT_VERIFIED'],
    [401,'API key is invalid','validation_error','INVITATION_EMAIL_AUTH_FAILED'],
    [403,'API key is not active','restricted_api_key','INVITATION_EMAIL_AUTH_FAILED'],
    [429,'Limit reached','rate_limit_exceeded','INVITATION_EMAIL_LIMIT'],
  ])await assert.rejects(sendInvitation(invitation,{settings,send:rejected(status,message,name)}),{code,status:503});
});
test('Timeouts, network failures and HTML responses do not expose credentials or raw provider errors',async()=>{
  await assert.rejects(sendInvitation(invitation,{settings,send:async()=>{throw {name:'TimeoutError'}}}),{code:'INVITATION_DELIVERY_TIMEOUT'});
  for(const send of [async()=>{throw new Error(invitation.password)},async()=>({ok:false,status:502,json:async()=>{throw new Error('<html>'+settings.key+'</html>')}})]){
    await assert.rejects(sendInvitation(invitation,{settings,send}),error=>{
      assert.equal(error.code,'INVITATION_DELIVERY_FAILED');assert.doesNotMatch(error.message,/Synthetic-private|synthetic-provider|<html>/);return true;
    });
  }
  assert.equal(invitationFailure(new Error(settings.key)).code,'INVITATION_DELIVERY_FAILED');
});
