import {randomBytes,randomUUID} from 'node:crypto';
import {getPool,withTransaction} from './db.js';
import {hashPassword} from './passwords.js';
import {audit} from './ledger.js';
import {problem} from './domain.js';
import {invitationSettings,sendInvitation,invitationFailure} from './invitationEmail.js';
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
  }catch(error){
    const failure=invitationFailure(error);
    return {...user,invitation_status:'failed',invitation_error_code:failure.code,message:failure.message};
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

export async function updateUser(id,body,actor) {
  if(!/^[1-9]\d{0,17}$/.test(String(id))) throw problem('INVALID_USER','Choose a valid account.');
  const {role,is_active:active}=body??{};
  if((role===undefined&&active===undefined)||
    (role!==undefined&&!['admin','accountant','viewer'].includes(role))||
    (active!==undefined&&typeof active!=='boolean')) throw problem('INVALID_USER','Choose a valid Finance role and status.');
  return withTransaction(async conn=>{
    // Serialize changes to administrator membership before checking who can still sign in.
    const [administrators]=await conn.execute("SELECT id,must_change_password FROM finance_users WHERE role='admin' AND is_active=1 ORDER BY id FOR UPDATE");
    if(!administrators.some(admin=>String(admin.id)===String(actor.id)&&!Number(admin.must_change_password))) {
      throw problem('ADMIN_REQUIRED','An enabled Finance Admin must update account access.',403);
    }
    const [[user]]=await conn.execute('SELECT id,role,is_active,must_change_password FROM finance_users WHERE id=? FOR UPDATE',[id]);
    if(!user) throw problem('NOT_FOUND','Finance account not found.',404);
    const before={role:user.role,is_active:Boolean(Number(user.is_active))};
    const after={role:role??before.role,is_active:active??before.is_active};
    if(before.role===after.role&&before.is_active===after.is_active) return {id:String(id),...after};
    const removesUsableAdmin=before.role==='admin'&&before.is_active&&!Number(user.must_change_password)&&
      (after.role!=='admin'||!after.is_active);
    if(removesUsableAdmin&&!administrators.some(admin=>String(admin.id)!==String(id)&&!Number(admin.must_change_password))) {
      throw problem('LAST_ADMIN','Keep at least one enabled Finance Admin who has completed password setup.',409);
    }
    await conn.execute('UPDATE finance_users SET role=?,is_active=? WHERE id=?',[after.role,Number(after.is_active),id]);
    if(!after.is_active) {
      await conn.execute('UPDATE finance_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND revoked_at IS NULL',[id]);
      await conn.execute('DELETE FROM finance_password_resets WHERE user_id=?',[id]);
    }
    await audit(conn,actor.id,'user.access_changed','user',id,{before,after});
    return {id:String(id),...after};
  });
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

export async function deletePendingInvitation(id,actor) {
  if(!/^[1-9]\d{0,17}$/.test(String(id)))throw problem('INVALID_USER','Choose a valid account.');
  return withTransaction(async conn=>{
    // Use the same lock order as access changes. Recheck acceptance under the
    // user lock also held by password setup/reset, so acceptance and deletion serialize.
    const [administrators]=await conn.execute("SELECT id,must_change_password FROM finance_users WHERE role='admin' AND is_active=1 ORDER BY id FOR UPDATE");
    if(!administrators.some(admin=>String(admin.id)===String(actor.id)&&!Number(admin.must_change_password))) {
      throw problem('ADMIN_REQUIRED','An enabled Finance Admin must delete invitations.',403);
    }
    const [[user]]=await conn.execute('SELECT id,email,display_name,role,must_change_password FROM finance_users WHERE id=? FOR UPDATE',[id]);
    if(!user)throw problem('NOT_FOUND','Finance account not found.',404);
    if(!Number(user.must_change_password)||String(user.id)===String(actor.id)) {
      throw problem('INVITATION_NOT_PENDING','Only invitations that have not been accepted can be deleted.',409);
    }
    const [[activity]]=await conn.execute(`SELECT
      EXISTS(SELECT 1 FROM finance_transactions WHERE created_by=? OR voided_by=?) OR
      EXISTS(SELECT 1 FROM finance_categories WHERE created_by=?) OR
      EXISTS(SELECT 1 FROM finance_import_batches WHERE created_by=? OR committed_by=?) OR
      EXISTS(SELECT 1 FROM finance_import_category_mappings WHERE approved_by=?) AS has_activity`,Array(6).fill(id));
    if(Number(activity.has_activity))throw problem('INVITATION_IN_USE','This account has Finance records. Disable its access instead of deleting it.',409);
    await audit(conn,actor.id,'user.invitation.deleted','user',user.id,{email:user.email,display_name:user.display_name,role:user.role});
    // Sessions and password reset tokens are removed by their ON DELETE CASCADE.
    await conn.execute('DELETE FROM finance_users WHERE id=?',[id]);
    return {id:String(id),deleted:true};
  });
}
