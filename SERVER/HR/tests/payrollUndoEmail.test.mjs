import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollUndoEmailSettings,payrollUndoEmailFailure,sendPayrollUndoEmail} from '../services/payrollUndoEmail.js';

const settings={key:'synthetic-secret',from:'HR <onboarding@resend.dev>'};
const data={email:'new-login@qa.invalid',code:'123456',payrollId:42,employee:'Synthetic Employee',reason:'Correct the recorded payment'};
const fail=(status,message,name='validation_error')=>async()=>({ok:false,status,json:async()=>({message,name})});

test('Undo code email only requires HR sender and key, regardless of the reset URL',()=>{
  assert.deepEqual(payrollUndoEmailSettings({RESEND_API_KEY:' synthetic-secret ',EMAIL_FROM:settings.from}),settings);
  assert.deepEqual(payrollUndoEmailSettings({RESEND_API_KEY:settings.key,EMAIL_FROM:settings.from,HR_PUBLIC_URL:'http://localhost:5175'}),settings);
  for(const env of [{},{RESEND_API_KEY:settings.key},{EMAIL_FROM:settings.from},{RESEND_API_KEY:'  ',EMAIL_FROM:settings.from}]) {
    assert.throws(()=>payrollUndoEmailSettings(env),error=>error.code==='PAYROLL_UNDO_EMAIL_NOT_CONFIGURED'&&error.statusCode===503&&!/Password reset/.test(error.message));
  }
});
test('Undo email uses the current login recipient and sends a single-use code without a reset link',async()=>{
  let sent;
  await sendPayrollUndoEmail(data,{settings,send:async(url,request)=>{
    assert.equal(url,'https://api.resend.com/emails');assert.equal(request.method,'POST');
    assert.equal(request.headers.Authorization,'Bearer '+settings.key);assert.ok(request.signal);
    assert.match(request.headers['Idempotency-Key'],/^[a-f0-9-]{36}$/);
    sent=JSON.parse(request.body);return {ok:true};
  }});
  assert.deepEqual(sent.to,[data.email]);assert.equal(sent.from,settings.from);assert.match(sent.text,/123456/);
  assert.match(sent.text,/expires in 10 minutes/);assert.match(sent.text,/No payroll has been changed/);assert.doesNotMatch(sent.text,/reset-password|https?:/);
});
test('Resend test-recipient and sender-domain restrictions are actionable and redact provider details',async()=>{
  for(const [message,code] of [
    ['You can only send testing emails to your own email address. PRIVATE PROVIDER DETAIL','PAYROLL_UNDO_TEST_SENDER_RESTRICTED'],
    ['The private.invalid domain is not verified. PRIVATE PROVIDER DETAIL','PAYROLL_UNDO_SENDER_NOT_VERIFIED'],
  ]) await assert.rejects(sendPayrollUndoEmail(data,{settings,send:fail(403,message)}),error=>error.code===code&&error.statusCode===503&&!/PRIVATE|private\.invalid/.test(error.message));
});
test('Rejected keys, rate limits, timeouts and other provider failures keep payroll-specific errors',async()=>{
  for(const [send,code] of [
    [fail(401,'private key'), 'PAYROLL_UNDO_EMAIL_AUTH_FAILED'],
    [fail(403,'private key','restricted_api_key'), 'PAYROLL_UNDO_EMAIL_AUTH_FAILED'],
    [fail(429,'private quota'), 'PAYROLL_UNDO_EMAIL_LIMIT'],
    [async()=>{throw Object.assign(new Error('private timeout'),{name:'TimeoutError'})}, 'PAYROLL_UNDO_EMAIL_TIMEOUT'],
    [async()=>{throw new Error('private network')}, 'PAYROLL_UNDO_EMAIL_FAILED'],
    [async()=>({ok:false,status:500,json:async()=>{throw new Error('private HTML')}}), 'PAYROLL_UNDO_EMAIL_FAILED'],
  ]) await assert.rejects(sendPayrollUndoEmail(data,{settings,send}),error=>error.code===code&&error.statusCode===503&&!/private/i.test(error.message));
  assert.equal(payrollUndoEmailFailure(new Error('provider secret')).code,'PAYROLL_UNDO_EMAIL_FAILED');
  assert.equal(payrollUndoEmailFailure({code:'PAYROLL_UNDO_EMAIL_LIMIT',message:'provider secret'}).message.includes('secret'),false);
});
