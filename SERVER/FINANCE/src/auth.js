import {randomBytes} from 'node:crypto';
import {hashPassword,verifyPassword,sessionHash} from './passwords.js';
export {hashPassword,verifyPassword,sessionHash};
import {getPool} from './db.js';
import {problem} from './domain.js';
export const COOKIE_NAME = 'dc_finance_session';
const parseCookies = header => Object.fromEntries(String(header||'').split(';').map(s=>s.trim()).filter(s=>s.includes('=')).map(s=>{const p=s.indexOf('=');return [s.slice(0,p),s.slice(p+1)];}));
export function sessionCookie(token, options={}) {
  const secure = options.secure === true;
  return `${COOKIE_NAME}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secure?'; Secure':''}`;
}
export function clearCookie(secure=false) {return `${COOKIE_NAME}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure?'; Secure':''}`;}
export async function login(email,password) {
  const [rows] = await getPool().execute('SELECT id,email,display_name,role,password_hash,is_active FROM finance_users WHERE email=? LIMIT 1',[email.toLowerCase()]);
  const user=rows[0];
  // Equalize missing-user hashing cost to reduce account enumeration signals.
  const valid=verifyPassword(password,user?.password_hash || hashPassword('invalid-placeholder-secret'));
  if (!user || user.is_active!==1 || !valid) throw problem('INVALID_CREDENTIALS','Incorrect email or password.',401);
  const token=randomBytes(32).toString('hex');
  await getPool().execute('INSERT INTO finance_sessions(token_hash,user_id,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 8 HOUR))',[sessionHash(token),user.id]);
  return {token,user:{id:String(user.id),email:user.email,display_name:user.display_name,role:user.role}};
}
export async function requireUser(req,res,next) {
  try {
    const token=parseCookies(req.headers.cookie)[COOKIE_NAME];
    if (!/^[a-f0-9]{64}$/.test(token||'')) throw problem('UNAUTHENTICATED','Sign in to Finance.',401);
    const [rows] = await getPool().execute(`SELECT u.id,u.email,u.display_name,u.role,u.is_active FROM finance_sessions s JOIN finance_users u ON u.id=s.user_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP() LIMIT 1`,[sessionHash(token)]);
    const user=rows[0];if (!user||Number(user.is_active)!==1) throw problem('UNAUTHENTICATED','Session expired.',401);
    req.financeUser=user;req.financeSessionHash=sessionHash(token); next();
  } catch(err) {next(err);}
}
export const requireRole = (...roles) => (req,res,next)=>roles.includes(req.financeUser?.role)?next():next(problem('FORBIDDEN','Your Finance role cannot perform this action.',403));
