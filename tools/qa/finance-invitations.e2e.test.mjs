// Real Finance account storage on the guarded disposable DB. No email is sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
Object.assign(process.env,{NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_USERNAME:'qa_finance',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_DATABASE:'dc_prime_finance_db',TIDB_SSL:'false'});
const {getPool}=await import('../../SERVER/FINANCE/src/db.js');
const {createUser,resendInvitation,listUsers,deletePendingInvitation}=await import('../../SERVER/FINANCE/src/users.js');
const {login,changePassword,sessionHash}=await import('../../SERVER/FINANCE/src/auth.js');
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

async function invite(role='viewer'){
 let password;
 const user=await createUser({email:'invite-'+randomUUID()+'@qa.invalid',display_name:'QA Pending Invitation',role},actor,{checkSettings:()=>({}),mailer:async data=>{password=data.password}});
 return {...user,password};
}
async function passwordSetup(user){
 const session=await login(user.email,user.password);
 return {financeUser:{id:user.id},financeSessionHash:sessionHash(session.token),body:{current_password:user.password,new_password:'Accepted-QA-only-password-2026!',confirm_password:'Accepted-QA-only-password-2026!'}};
}
test('Deleting an unaccepted invitation removes sessions and reset tokens while retaining its audit history',async()=>{
 const user=await invite(),session=await login(user.email,user.password),token=randomUUID().replaceAll('-','').repeat(2);
 await db.query('INSERT INTO finance_password_resets(user_id,token_hash,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 20 MINUTE))',[user.id,token]);
 assert.deepEqual(await deletePendingInvitation(user.id,actor),{id:user.id,deleted:true});
 for(const table of ['finance_users','finance_sessions','finance_password_resets']){
  const [[row]]=await db.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${table==='finance_users'?'id':'user_id'}=?`,[user.id]);assert.equal(row.n,0);
 }
 const [[entry]]=await db.query("SELECT actor_user_id,metadata_json FROM finance_audit_logs WHERE action='user.invitation.deleted' AND entity_id=?",[user.id]);
 assert.equal(String(entry.actor_user_id),'1');assert.equal(JSON.parse(typeof entry.metadata_json==='string'?entry.metadata_json:JSON.stringify(entry.metadata_json)).email,user.email);
 await assert.rejects(login(user.email,user.password),{code:'INVALID_CREDENTIALS'});
 const response=await fetch('http://127.0.0.1:4179/finance-api/api/v1/auth/me',{headers:{cookie:'dc_finance_session='+session.token}});assert.equal(response.status,401);
});
test('Accepted accounts and the acting administrator cannot be deleted',async()=>{
 const user=await invite();await changePassword(await passwordSetup(user));
 await assert.rejects(deletePendingInvitation(user.id,actor),{code:'INVITATION_NOT_PENDING'});
 await assert.rejects(deletePendingInvitation(1,actor),{code:'INVITATION_NOT_PENDING'});
 assert.equal(Number((await listUsers()).find(row=>String(row.id)===user.id).must_change_password),0);
 await assert.rejects(deletePendingInvitation(pending.id,{id:user.id}),{code:'ADMIN_REQUIRED'});
});
test('Expired invitations can be deleted and the same email invited again',async()=>{
 const user=await invite();await db.query('UPDATE finance_users SET temporary_password_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE id=?',[user.id]);
 await assert.rejects(login(user.email,user.password),{code:'INVITATION_EXPIRED'});
 await deletePendingInvitation(user.id,actor);
 const renewed=await createUser({email:user.email,display_name:'QA Invited Again',role:'viewer'},actor,{checkSettings:()=>({}),mailer:async()=>{}});
 assert.notEqual(renewed.id,user.id);assert.equal(renewed.invitation_status,'sent');
});
test('Unexpected Finance activity blocks deletion without losing records or adding a deletion audit',async()=>{
 const user=await invite();
 const [category]=await db.query("INSERT INTO finance_categories(kind,name,created_by) VALUES('expense',?,?)",['QA linked invitation '+randomUUID(),user.id]);
 await assert.rejects(deletePendingInvitation(user.id,actor),{code:'INVITATION_IN_USE'});
 const [[record]]=await db.query('SELECT created_by FROM finance_categories WHERE id=?',[category.insertId]);assert.equal(String(record.created_by),user.id);
 const [[audit]]=await db.query("SELECT COUNT(*) AS n FROM finance_audit_logs WHERE action='user.invitation.deleted' AND entity_id=?",[user.id]);assert.equal(audit.n,0);
 await db.query('DELETE FROM finance_categories WHERE id=?',[category.insertId]);await deletePendingInvitation(user.id,actor);
});
test('Concurrent delete requests remove the invitation once and produce one audit entry',async()=>{
 const user=await invite();const results=await Promise.allSettled([deletePendingInvitation(user.id,actor),deletePendingInvitation(user.id,actor)]);
 assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
 assert.equal(results.find(result=>result.status==='rejected').reason.code,'NOT_FOUND');
 const [[audit]]=await db.query("SELECT COUNT(*) AS n FROM finance_audit_logs WHERE action='user.invitation.deleted' AND entity_id=?",[user.id]);assert.equal(audit.n,1);
});
test('Password setup and invitation deletion cannot both succeed when they race',async()=>{
 for(let attempt=0;attempt<3;attempt++){
  const user=await invite(),request=await passwordSetup(user);
  const results=await Promise.allSettled(attempt%2?[deletePendingInvitation(user.id,actor),changePassword(request)]:[changePassword(request),deletePendingInvitation(user.id,actor)]);
  assert.equal(results.filter(result=>result.status==='fulfilled').length,1);
  const [[stored]]=await db.query('SELECT must_change_password FROM finance_users WHERE id=?',[user.id]);
  if(stored)assert.equal(stored.must_change_password,0);
  else {const [[sessions]]=await db.query('SELECT COUNT(*) AS n FROM finance_sessions WHERE user_id=?',[user.id]);assert.equal(sessions.n,0)}
 }
});
test('The delete endpoint requires an administrator and rejects invalid or accepted targets',async()=>{
 const base='http://127.0.0.1:4179/finance-api/api/v1',headers={origin:'http://127.0.0.1:4179','x-requested-with':'dcprime-finance'};
 const user=await invite();
 assert.equal((await fetch(base+'/finance/users/'+user.id,{method:'DELETE',headers})).status,401);
 for(const [email,expected] of [['viewer@qa.invalid',403],['accountant@qa.invalid',403],['admin@qa.invalid',200]]){
  const response=await fetch(base+'/auth/login',{method:'POST',headers:{...headers,'content-type':'application/json'},body:JSON.stringify({email,password:'Synthetic-QA-only-2026!'})});assert.equal(response.status,200);
  const cookie=response.headers.get('set-cookie').split(';')[0];
  const removed=await fetch(base+'/finance/users/'+user.id,{method:'DELETE',headers:{...headers,cookie}});assert.equal(removed.status,expected);
  if(expected===200){
   assert.equal((await fetch(base+'/finance/users/1',{method:'DELETE',headers:{...headers,cookie}})).status,409);
   assert.equal((await fetch(base+'/finance/users/invalid',{method:'DELETE',headers:{...headers,cookie}})).status,400);
  }
 }
});
