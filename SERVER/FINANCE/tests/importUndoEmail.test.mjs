import test from 'node:test';
import assert from 'node:assert/strict';
import {undoVerificationEmailSettings,sendUndoVerificationEmail} from '../src/importUndoEmail.js';

const settings={key:'synthetic-resend-key',from:'Finance <finance@example.invalid>'};
const message={email:'admin@example.invalid',name:'Finance Admin',fileName:'finance-import.csv',code:'123456',expiresMinutes:10};

test('Admin override email requires Finance Resend settings',()=>{
  assert.throws(()=>undoVerificationEmailSettings({}),{code:'EMAIL_NOT_CONFIGURED'});
  assert.deepEqual(undoVerificationEmailSettings({RESEND_API_KEY:'key',EMAIL_FROM:'finance@example.invalid'}),{key:'key',from:'finance@example.invalid'});
});

test('Admin override email sends the one-time code to the registered Admin address',async()=>{
  let payload;
  await sendUndoVerificationEmail(message,{settings,send:async(url,options)=>{
    assert.equal(url,'https://api.resend.com/emails');
    assert.equal(options.method,'POST');
    assert.ok(options.headers['Idempotency-Key']);
    payload=JSON.parse(options.body);
    return {ok:true};
  }});
  assert.deepEqual(payload.to,[message.email]);
  assert.match(payload.subject,/Import Undo Verification/);
  assert.match(payload.text,/123456/);
  assert.match(payload.text,/finance-import\.csv/);
  assert.match(payload.text,/expires in 10 minutes/);
});

test('Email provider errors never expose provider response details or the verification code',async()=>{
  await assert.rejects(sendUndoVerificationEmail(message,{settings,send:async()=>({ok:false,status:401})}),error=>{
    assert.equal(error.code,'UNDO_CODE_DELIVERY_FAILED');
    assert.doesNotMatch(error.message,/123456|synthetic-resend-key/);
    return true;
  });
  await assert.rejects(sendUndoVerificationEmail(message,{settings,send:async()=>{throw new Error('123456 synthetic-resend-key')}}),error=>{
    assert.equal(error.code,'UNDO_CODE_DELIVERY_FAILED');
    assert.doesNotMatch(error.message,/123456|synthetic-resend-key/);
    return true;
  });
});
