import {randomBytes,randomUUID} from 'node:crypto';
import {getPool,withTransaction} from './db.js';
import {hashPassword} from './passwords.js';
import {audit} from './ledger.js';
import {problem} from './domain.js';
import {invitationSettings,sendInvitation} from './invitationEmail.js';
export async function listUsers(){const [rows]=await getPool().execute('SELECT id,email,display_name,role,is_active,must_change_password,invitation_sent_at,temporary_password_expires_at,created_at FROM finance_users ORDER BY id');return rows;}
const temporaryPassword=()=>randomBytes(24).toString('base64url');
async function deliverInvitation(user,password,passwordHash,actor,mailer){
  try{
    await mailer({email:user.email,name:user.display_name,password,requestId:randomUUID()});
    await withTransaction(async conn=>{
      await conn.execute('UPDATE finance_users SET invitation_sent_at=UTC_TIMESTAMP() WHERE id=? AND password_hash=?',[user.id,passwordHash]);
      await audit(conn,actor.id,'user.invitation.sent','user',user.id,{email:user.email});
    });
    return {...user,invitation_status:'sent'};
  }catch{
    return {...user,invitation_status:'failed',message:'The account is pending. Email delivery failed; check the email service, then resend the invitation.'};
  }
}
export async function createUser(body,actor,{mailer=sendInvitation,checkSettings=invitationSettings}={}){
  const email=String(body?.email??'').toLowerCase().trim(),display_name=String(body?.display_name??'').trim(),role=body?.role;
  if(Object.hasOwn(body||{},'password'))throw problem('ADMIN_PASSWORD_FORBIDDEN','Passwords are generated privately and emailed to the account owner.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>190||!display_name||display_name.length>160||!['admin','accountant','viewer'].includes(role))throw problem('INVALID_USER','Valid name, email, and role are required.');
  checkSettings();const password=temporaryPassword(),password_hash=hashPassword(password);
  const user=await withTransaction(async conn=>{
    const [result]=await conn.execute('INSERT INTO finance_users(email,display_name,password_hash,role,must_change_password,temporary_password_expires_at) VALUES(?,?,?,?,1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR))',[email,display_name,password_hash,role]);
    await audit(conn,actor.id,'user.created','user',result.insertId,{email,role,invitation_required:true});
    return {id:String(result.insertId),email,display_name,role,is_active:1,must_change_password:true};
  });
  return deliverInvitation(user,password,password_hash,actor,mailer);
}
export async function resendInvitation(id,actor,{mailer=sendInvitation,checkSettings=invitationSettings}={}){
  if(!/^[1-9]\d{0,17}$/.test(String(id)))throw problem('INVALID_USER','Choose a valid account.');
  checkSettings();const password=temporaryPassword(),password_hash=hashPassword(password);
  const user=await withTransaction(async conn=>{
    const [[user]]=await conn.execute('SELECT id,email,display_name,role,is_active,must_change_password FROM finance_users WHERE id=? FOR UPDATE',[id]);
    if(!user||!Number(user.is_active)||!Number(user.must_change_password))throw problem('INVITATION_NOT_PENDING','Only active accounts awaiting their first password can be invited again.',409);
    await conn.execute('UPDATE finance_users SET password_hash=?,temporary_password_expires_at=DATE_ADD(UTC_TIMESTAMP(),INTERVAL 24 HOUR),invitation_sent_at=NULL WHERE id=?',[password_hash,id]);
    await conn.execute('UPDATE finance_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL',[id]);
    await audit(conn,actor.id,'user.invitation.renewed','user',id,{email:user.email});return user;
  });
  return deliverInvitation(user,password,password_hash,actor,mailer);
}
