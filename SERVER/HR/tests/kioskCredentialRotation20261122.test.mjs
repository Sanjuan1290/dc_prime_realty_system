import test from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import {KIOSK_PASSWORD_LIFETIME_MS,kioskCredentialStatus,kioskSessionMatchesCredential,validateKioskPassword,regenerateKioskPassword} from '../services/attendanceKioskCredential.service.js';
test('kiosk credential expiry uses server epoch time at the exact fourteen-day boundary',()=>{
 const now=1795300000000,credential={generation:2,passwordHash:'hash',expiresAt:now+KIOSK_PASSWORD_LIFETIME_MS};
 assert.equal(KIOSK_PASSWORD_LIFETIME_MS,14*86400000);
 assert.equal(kioskCredentialStatus(credential,{now:credential.expiresAt-1}).expired,false);
 assert.equal(kioskCredentialStatus(credential,{now:credential.expiresAt}).expired,true);
 assert.equal(kioskCredentialStatus(credential,{now:credential.expiresAt-86400000}).expiringSoon,true);
 assert.equal(kioskSessionMatchesCredential({generation:1,expiresAt:now+10000},credential,{now}),false);
 assert.equal(kioskSessionMatchesCredential({generation:2,expiresAt:now+10000},credential,{now}),true);
 assert.equal(kioskSessionMatchesCredential({generation:2,expiresAt:credential.expiresAt+10000},credential,{now:credential.expiresAt}),false);
});
test('regeneration persists only a bcrypt hash, increments the global generation and never audits the plaintext',async()=>{
 const calls=[],now=1795300000000,connection={async query(sql,args=[]){calls.push({sql,args});if(sql.includes('FROM hr_settings'))return [[{generation:4,passwordHash:'old',expiresAt:now}]];return [{affectedRows:1,insertId:1}]}};
 const generated=await regenerateKioskPassword(connection,{authUser:{id:1,displayName:'Synthetic HR Admin'}},{now});
 assert.equal(generated.generation,5);assert.equal(generated.visibleForSeconds,15);assert.equal(generated.expiresAt,now+14*86400000);
 const update=calls.find(call=>call.sql.includes('UPDATE hr_settings'));assert.notEqual(update.args[0],generated.password);assert.ok(await bcrypt.compare(generated.password,update.args[0]));
 const audit=calls.find(call=>call.sql.includes('INSERT INTO hr_audit_logs'));assert.ok(audit);assert.ok(!JSON.stringify(audit.args).includes(generated.password));assert.ok(!JSON.stringify(audit.args).includes(update.args[0]));
 assert.ok(await validateKioskPassword(generated.password,{generation:5,passwordHash:update.args[0],expiresAt:Date.now()+86400000}));
 assert.equal(await validateKioskPassword('724381',{generation:5,passwordHash:update.args[0],expiresAt:Date.now()+86400000}),false);
});
