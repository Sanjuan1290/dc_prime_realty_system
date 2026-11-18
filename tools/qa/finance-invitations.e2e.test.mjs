// Real Finance account storage on the guarded disposable DB. No email is sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
Object.assign(process.env,{NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_USERNAME:'qa_finance',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_DATABASE:'dc_prime_finance_db',TIDB_SSL:'false'});
const {getPool}=await import('../../SERVER/FINANCE/src/db.js');
const {createUser,resendInvitation,listUsers}=await import('../../SERVER/FINANCE/src/users.js');
const {sendInvitation}=await import('../../SERVER/FINANCE/src/invitationEmail.js');
const {verifyPassword}=await import('../../SERVER/FINANCE/src/passwords.js');
const db=getPool(),actor={id:1};
let pending,firstHash;
test.before(async()=>{
 const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');
 assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
});
test.after(()=>db.end());
test('A provider restriction leaves a private pending account with a useful warning',async()=>{
 const settings={key:'synthetic-only',from:'Finance <onboarding@resend.dev>',url:'https://qa.invalid/finance'};
 pending=await createUser({email:'invitation-'+randomUUID()+'@qa.invalid',display_name:'QA Invitation',role:'viewer'},actor,{
  checkSettings:()=>settings,
  mailer:data=>sendInvitation(data,{settings,send:async()=>({ok:false,status:403,json:async()=>({name:'validation_error',message:'You can only send testing emails to your own email address.'})})}),
 });
 assert.equal(pending.invitation_status,'failed');assert.equal(pending.invitation_error_code,'INVITATION_TEST_SENDER_RESTRICTED');assert.match(pending.message,/verified sender/);
 assert.equal(pending.must_change_password,true);assert.equal(Object.hasOwn(pending,'password'),false);assert.equal(Object.hasOwn(pending,'password_hash'),false);
 const [[stored]]=await db.query('SELECT * FROM finance_users WHERE id=?',[pending.id]);
 assert.equal(stored.invitation_sent_at,null);assert.equal(stored.must_change_password,1);assert.ok(stored.temporary_password_expires_at);firstHash=stored.password_hash;
});
test('Resending a pending invitation creates a new private password and records success',async()=>{
 let captured;
 const sent=await resendInvitation(pending.id,actor,{checkSettings:()=>({}),mailer:async data=>{captured=data}});
 assert.equal(sent.invitation_status,'sent');assert.equal(captured.email,pending.email);
 const [[stored]]=await db.query('SELECT * FROM finance_users WHERE id=?',[pending.id]);
 assert.ok(stored.invitation_sent_at);assert.equal(stored.must_change_password,1);assert.notEqual(stored.password_hash,firstHash);assert.equal(verifyPassword(captured.password,stored.password_hash),true);
 assert.equal(JSON.stringify(sent).includes(captured.password),false);
 const visible=(await listUsers()).find(user=>String(user.id)===pending.id);
 assert.equal(Object.hasOwn(visible,'password_hash'),false);assert.ok(visible.invitation_sent_at);
});
