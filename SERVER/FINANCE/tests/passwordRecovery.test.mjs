import test from 'node:test';
import assert from 'node:assert/strict';
import {resetEmail,validateReset,newResetToken,tokenHash,createResetThrottle,recoverySettings,sendResetEmail} from '../src/passwordRecoveryCore.js';
test('Reset tokens contain 256 bits, are hashed in storage and require matching strong passwords',()=>{
 const token=newResetToken();assert.match(token,/^[a-f0-9]{64}$/);assert.notEqual(token,newResetToken());assert.notEqual(tokenHash(token),token);
 assert.equal(resetEmail(' USER@EXAMPLE.COM '),'user@example.com');assert.throws(()=>resetEmail('not an email'));
 assert.throws(()=>validateReset({token:'invalid',new_password:'Unique-password-2026!',confirm_password:'Unique-password-2026!'}));
 assert.throws(()=>validateReset({token:[token],new_password:'Unique-password-2026!',confirm_password:'Unique-password-2026!'}),{status:400});
 assert.throws(()=>validateReset({token,new_password:'short',confirm_password:'short'}));
 assert.throws(()=>validateReset({token,new_password:'Unique-password-2026!',confirm_password:'Other-password-2026!'}));
 assert.deepEqual(validateReset({token,new_password:'Unique-password-2026!',confirm_password:'Unique-password-2026!'}),{hash:tokenHash(token),password:'Unique-password-2026!'});
 assert.throws(()=>validateReset({token,new_password:'🔑'.repeat(30),confirm_password:'🔑'.repeat(30)},72));
});
test('Reset throttles limit both repeated email requests and bulk requests',()=>{
 const throttle=createResetThrottle();for(let i=0;i<3;i++)throttle('local','one@qa.invalid',1000);
 assert.throws(()=>throttle('different','one@qa.invalid',1000),{status:429});
 const bulk=createResetThrottle();for(let i=0;i<10;i++)bulk('bulk',i+'@qa.invalid',1000);
 assert.throws(()=>bulk('bulk','next@qa.invalid',1000),{status:429});bulk('bulk','next@qa.invalid',1000+15*60000);
});
test('Reset email uses only the configured app URL with a private fragment token',async()=>{
 assert.throws(()=>recoverySettings('finance',{}),{code:'EMAIL_NOT_CONFIGURED'});
 assert.throws(()=>recoverySettings('finance',{RESEND_API_KEY:'qa',EMAIL_FROM:'qa@invalid',FINANCE_PUBLIC_URL:'http://unsafe.invalid'}));
 const settings=recoverySettings('finance',{RESEND_API_KEY:'qa',EMAIL_FROM:'qa@invalid',FINANCE_PUBLIC_URL:'https://example.invalid/finance'});
 let email;const token=newResetToken();await sendResetEmail({email:'user@qa.invalid',token,service:'Finance'},{settings,send:async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');email=JSON.parse(options.body);return {ok:true}}});
 assert.match(email.text,new RegExp('https://example.invalid/finance#reset-password='+token));assert.match(email.text,/20 minutes/);assert.deepEqual(email.to,['user@qa.invalid']);
});
