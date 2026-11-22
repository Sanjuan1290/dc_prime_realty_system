import {randomBytes} from 'node:crypto';
import {hashPassword,verifyPassword,sessionHash} from './passwords.js';
export {hashPassword,verifyPassword,sessionHash};
import {getPool,withTransaction} from './db.js';
import {audit} from './ledger.js';
import {problem} from './domain.js';
export const COOKIE_NAME = 'dc_finance_session';
const parseCookies = header => Object.fromEntries(String(header||'').split(';').map(s=>s.trim()).filter(s=>s.includes('=')).map(s=>{const p=s.indexOf('=');return [s.slice(0,p),s.slice(p+1)];}));
export function sessionCookie(token, options={}) {
  const secure = options.secure === true;
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure?'; Secure':''}`;
}
export function clearCookie(secure=false) {return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`;}
export async function login(email,password) {
  const [rows] = await getPool().execute('SELECT id,email,display_name,role,password_hash,is_active,must_change_password,temporary_password_expires_at,temporary_password_expires_at>UTC_TIMESTAMP() AS temporary_valid FROM finance_users WHERE email=? LIMIT 1',[email.toLowerCase()]);
  const user=rows[0];
  // Equalize missing-user hashing cost to reduce account enumeration signals.
  const valid=verifyPassword(password,user?.password_hash || hashPassword('invalid-placeholder-secret'));
  if (!user || user.is_active!==1 || !valid) throw problem('INVALID_CREDENTIALS','Incorrect email or password.',401);
  if(Number(user.must_change_password)&&!Number(user.temporary_valid))throw problem('INVITATION_EXPIRED','Your temporary password has expired. Ask an administrator to resend your invitation.',401);
  const token=randomBytes(32).toString('hex');
  await getPool().execute('INSERT INTO finance_sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[sessionHash(token),user.id]);
  return {token,user:publicUser(user)};
}
export const publicUser=u=>({id:String(u.id),email:u.email,display_name:u.display_name,role:u.role,must_change_password:Boolean(Number(u.must_change_password))});
export async function requireUser(req,res,next) {
  try {
    const token=parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!/^[a-f0-9]{64}$/.test(token||'')) throw problem('UNAUTHENTICATED','Sign in to Finance.',401);
    const [rows] = await getPool().execute(`SELECT u.id,u.email,u.display_name,u.role,u.is_active,u.must_change_password,u.temporary_password_expires_at>UTC_TIMESTAMP() AS temporary_valid FROM finance_sessions s JOIN finance_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() LIMIT 1`,[sessionHash(token)]);
    const user=rows[0];if (!user||Number(user.is_active)!==1) throw problem('UNAUTHENTICATED','Session expired.',401);
    if(Number(user.must_change_password)&&!Number(user.temporary_valid))throw problem('INVITATION_EXPIRED','Your temporary password has expired. Ask an administrator to resend your invitation.',401);
    req.financeUser=user;req.financeSessionHash=sessionHash(token); next();
  } catch(err) {next(err);}
}
export const requirePermanentPassword=(req,res,next)=>Number(req.financeUser?.must_change_password)?next(problem('PASSWORD_CHANGE_REQUIRED','Choose your own password before accessing Finance.',403)):next();
export async function changePassword(req){
  const {current_password,new_password,confirm_password}=req.body||{};
  if(new_password!==confirm_password)throw problem('PASSWORD_CONFIRMATION','The new passwords do not match.');
  const passwordHash=hashPassword(new_password);
  return withTransaction(async conn=>{
    const [[user]]=await conn.execute('SELECT id,email,display_name,role,password_hash,is_active,must_change_password,temporary_password_expires_at>UTC_TIMESTAMP() AS temporary_valid FROM finance_users WHERE id=? FOR UPDATE',[req.financeUser.id]);
    if(!user||!Number(user.is_active)||!verifyPassword(current_password,user.password_hash))throw problem('INVALID_PASSWORD','Current password is incorrect.',401);
    if(Number(user.must_change_password)&&!Number(user.temporary_valid))throw problem('INVITATION_EXPIRED','Ask an administrator to resend your invitation.',401);
    if(verifyPassword(new_password,user.password_hash))throw problem('PASSWORD_REUSED','Choose a password different from your temporary password.');
    const [[session]]=await conn.execute('SELECT token_hash FROM finance_sessions WHERE token_hash=? AND user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP() FOR UPDATE',[req.financeSessionHash,user.id]);
    if(!session)throw problem('UNAUTHENTICATED','Session expired.',401);
    await conn.execute('UPDATE finance_users SET password_hash=?,must_change_password=0,temporary_password_expires_at=NULL WHERE id=?',[passwordHash,user.id]);
    await conn.execute('UPDATE finance_import_undo_authorizations SET consumed_at=UTC_TIMESTAMP() WHERE admin_user_id=? AND consumed_at IS NULL',[user.id]);
    await conn.execute('UPDATE finance_sessions SET revoked_at=UTC_TIMESTAMP() WHERE user_id=? AND token_hash<>? AND revoked_at IS NULL',[user.id,req.financeSessionHash]);
    await audit(conn,user.id,'user.password.changed','user',user.id,{});
    return {user:publicUser({...user,must_change_password:0})};
  });
}
export const requireRole = (...roles) => (req,res,next)=>roles.includes(req.financeUser?.role)?next():next(problem('FORBIDDEN','Your Finance role cannot perform this action.',403));
