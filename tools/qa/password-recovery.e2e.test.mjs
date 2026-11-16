// All accounts and email payloads are synthetic; mail is captured, never sent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
Object.assign(process.env,{NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_USERNAME:'qa_finance',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_DATABASE:'dc_prime_finance_db',TIDB_SSL:'false',HR_DB_HOST:'127.0.0.1',HR_DB_PORT:'13307',HR_DB_USER:'qa_hr',HR_DB_PASSWORD:'qa-isolated-only-password',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false'});
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url)),bcrypt=require('bcrypt');
const finance=await import('../../SERVER/FINANCE/src/passwordRecovery.js'),hr=await import('../../SERVER/HR/services/passwordRecovery.service.js');
const {hashPassword}=await import('../../SERVER/FINANCE/src/passwords.js');
const {getPool}=await import('../../SERVER/FINANCE/src/db.js'),{db:hrDb}=await import('../../SERVER/HR/db/connect.js');
const {tokenHash}=await import('../../SERVER/FINANCE/src/passwordRecoveryCore.js');
const pools={finance:getPool(),hr:hrDb},services={finance,hr},oldPassword='Synthetic-old-password-2026!',newPassword='Synthetic-new-password-2026!',settings={key:'qa-not-used',from:'qa@invalid',url:'https://example.invalid/'};
const fixtures={};
async function auth(app,path,body,cookie){
 const base=app==='finance'?'http://127.0.0.1:5203':'http://127.0.0.1:5202';
 const response=await fetch(base+'/api/v1/auth/'+path,{method:body?'POST':'GET',headers:{origin:'http://127.0.0.1:4179','x-requested-with':'dcprime-finance',...(body?{'content-type':'application/json'}:{}),...(cookie?{cookie}:{})},body:body?JSON.stringify(body):undefined});
 return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function createUser(app){
 const email=`reset-${randomUUID()}@qa.invalid`,pool=pools[app];
 if(app==='finance'){
  const [result]=await pool.execute("INSERT INTO finance_users(email,display_name,role,password_hash,is_active) VALUES(?,'Synthetic Reset User','viewer',?,1)",[email,hashPassword(oldPassword)]);return {id:result.insertId,email};
 }
 const [result]=await pool.query("INSERT INTO hr_users(display_name_snapshot,email_snapshot,account_status) VALUES('Synthetic Reset User',?,'active')",[email]);
 await pool.query("INSERT INTO hr_login_identities(hr_user_id,login_email,password_hash,login_state,must_change_password) VALUES(?,?,?,'active',0)",[result.insertId,email,await bcrypt.hash(oldPassword,12)]);return {id:result.insertId,email};
}
test.before(async()=>{
 for(const pool of Object.values(pools)){const [[server]]=await pool.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));}
});
test.after(async()=>{writeFileSync('QA_REPORTS/.runtime/reset-browser-fixtures.json',JSON.stringify(fixtures));await Promise.all(Object.values(pools).map(pool=>pool.end()));});
for(const app of ['finance','hr'])test(`${app}: email reset tokens expire, replace previous links, work once, and revoke all old sessions`,async()=>{
 const service=services[app],pool=pools[app],user=await createUser(app);let captured;
 const options={settings,mailer:async data=>{captured=data}},ip='synthetic-'+app;
 const oldLogin=await auth(app,'login',{email:user.email,password:oldPassword});assert.equal(oldLogin.status,200,JSON.stringify(oldLogin.data));
 const response=await service.requestPasswordReset({email:user.email},ip,options);await new Promise(setImmediate);assert.ok(captured.token);const first=captured.token;
 const unknown=await service.requestPasswordReset({email:'absent-'+randomUUID()+'@qa.invalid'},ip,options);assert.deepEqual(unknown,response);assert.ok(!JSON.stringify(response).includes(first));
 const [[stored]]=await pool.query(`SELECT token_hash FROM ${app}_password_resets WHERE user_id=?`,[user.id]);assert.equal(stored.token_hash,tokenHash(first));assert.notEqual(stored.token_hash,first);
 const payload=token=>({token,new_password:newPassword,confirm_password:newPassword});
 await service.requestPasswordReset({email:user.email},ip,options);await new Promise(setImmediate);const second=captured.token;assert.notEqual(second,first);
 await assert.rejects(service.resetPassword(payload(first)),{code:'PASSWORD_RESET_INVALID'});
 await assert.rejects(service.resetPassword({...payload(second),confirm_password:'Mismatched-password!'}));
 await pool.query(`UPDATE ${app}_password_resets SET expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 SECOND) WHERE user_id=?`,[user.id]);
 await assert.rejects(service.resetPassword(payload(second)),{code:'PASSWORD_RESET_INVALID'});
 await service.requestPasswordReset({email:user.email},ip,options);await new Promise(setImmediate);const third=captured.token;
 const results=await Promise.allSettled([service.resetPassword(payload(third)),service.resetPassword(payload(third))]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 assert.equal((await auth(app,'me',null,oldLogin.cookie)).status,401);
 assert.equal((await auth(app,'login',{email:user.email,password:oldPassword})).status,401);
 assert.equal((await auth(app,'login',{email:user.email,password:newPassword})).status,200);
 await assert.rejects(service.resetPassword(payload(third)),{code:'PASSWORD_RESET_INVALID'});
 const [[count]]=await pool.query(`SELECT COUNT(*) AS n FROM ${app}_password_resets WHERE user_id=?`,[user.id]);assert.equal(count.n,0);
 const inactive=await createUser(app);if(app==='finance')await pool.query('UPDATE finance_users SET is_active=0 WHERE id=?',[inactive.id]);else await pool.query("UPDATE hr_users SET account_status='disabled' WHERE id=?",[inactive.id]);
 captured=null;assert.deepEqual(await service.requestPasswordReset({email:inactive.email},ip,options),response);await new Promise(setImmediate);assert.equal(captured,null);
 // Separate fresh synthetic identity for the real browser reset form.
 const browserUser=await createUser(app);await service.requestPasswordReset({email:browserUser.email},ip,options);await new Promise(setImmediate);fixtures[app]={...browserUser,token:captured.token,password:'Browser-reset-password-2026!'};
});
test('Reset endpoints reject malformed and other-service tokens without changing an account',async()=>{
 for(const app of ['finance','hr']){
  const other=app==='finance'?'hr':'finance';
  for(const token of [[fixtures[app].token],fixtures[other].token]){
   const result=await auth(app,'reset-password',{token,new_password:newPassword,confirm_password:newPassword});assert.equal(result.status,400,JSON.stringify(result.data));
  }
 }
});
