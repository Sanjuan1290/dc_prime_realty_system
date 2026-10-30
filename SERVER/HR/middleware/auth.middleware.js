import jwt from 'jsonwebtoken';
import { db } from '../db/connect.js';
export const HR_COOKIE = 'hr_auth_session';
const denial = (res, status, code) => res.status(status).json({ success:false, code });
const secret = () => {
  if (!String(process.env.HR_JWT_SECRET || '').trim()) throw new Error('HR_JWT_SECRET is not configured.');
  return process.env.HR_JWT_SECRET;
};
export const createHrToken = (actor) => jwt.sign({ ver:Number(actor.auth_version) },secret(), {
  subject:String(actor.id), issuer:'dcprime-hr', audience:'dcprime-hr-api', expiresIn:'8h', algorithm:'HS256',
});
export const authenticateUser = async (req,res,next) => {
  try {
    const cookie = req.cookies?.[HR_COOKIE];
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/i)?.[1];
    // Reject ambiguous dual credential sources to avoid session confusion.
    if (cookie && bearer) return denial(res,401,'HR_AUTH_AMBIGUOUS');
    const token = cookie || bearer;
    if (!token) return denial(res,401,'HR_AUTH_REQUIRED');
    const claims = jwt.verify(token,secret(),{ algorithms:['HS256'],issuer:'dcprime-hr',audience:'dcprime-hr-api' });
    const [rows] = await db.query(`SELECT u.id, u.display_name_snapshot, u.account_status, i.auth_version,
         i.login_state FROM hr_users u INNER JOIN hr_login_identities i ON i.hr_user_id = u.id WHERE u.id = ? LIMIT 1`,[Number(claims.sub)]);
    const user = rows[0];
    if (!user || user.account_status !== 'active' || user.login_state !== 'active' || Number(user.auth_version) !== Number(claims.ver)) return denial(res,401,'HR_AUTH_REVOKED');
    const [permRows] = await db.query(`SELECT DISTINCT rp.permission_code FROM hr_user_roles ur INNER JOIN hr_role_permissions rp ON rp.role_code = ur.role_code WHERE ur.hr_user_id = ?`,[user.id]);
    req.authUser = { id:Number(user.id), displayName:user.display_name_snapshot, permissions:new Set(permRows.map(p=>p.permission_code)) };
    return next();
  } catch (err) { if (['JsonWebTokenError','TokenExpiredError','NotBeforeError'].includes(err.name)) return denial(res,401,'HR_AUTH_INVALID'); return next(err); }
};
export const requirePermission = permission => (req,res,next) => req.authUser?.permissions?.has(permission) ? next() : denial(res,403,'HR_PERMISSION_DENIED');
