import express from 'express';
import bcrypt from 'bcrypt';
import { db } from '../db/connect.js';
import { authenticateUser,createHrToken,HR_COOKIE } from '../middleware/auth.middleware.js';
const router = express.Router();
const cookieOptions = () => ({ httpOnly:true,secure:process.env.NODE_ENV === 'production',sameSite:'lax',path:'/api/v1',maxAge:8*3600000 });
// Staging only. Provision identities through a separate approved administrative process.
const attempts = new Map();
router.post('/login',async (req,res,next)=> {
  try {
    const key = String(req.ip || 'unknown'); const state = attempts.get(key) || { n:0, until:0 };
    if (state.until > Date.now()) return res.status(429).json({ code:'HR_LOGIN_RATE_LIMITED' });
    const email = String(req.body?.email || '').trim().toLowerCase();const password = String(req.body?.password || '');
    if (!email || !password || email.length > 150 || password.length > 256) return res.status(400).json({ code:'INVALID_LOGIN_INPUT' });
    const [rows] = await db.query(`SELECT u.id,u.display_name_snapshot,u.account_status,i.login_state,i.auth_version,i.password_hash
      FROM hr_users u INNER JOIN hr_login_identities i ON i.hr_user_id = u.id WHERE i.login_email = ? LIMIT 1`,[email]);
    const u=rows[0];
    const valid = u?.password_hash ? await bcrypt.compare(password,u.password_hash) : false;
    if (!valid || u.account_status !== 'active' || u.login_state !== 'active') {
      state.n += 1;state.until = state.n >= 5 ? Date.now()+15*60000 : 0;attempts.set(key,state);
      return res.status(401).json({code:'HR_LOGIN_INVALID'});
    }
    attempts.delete(key);res.cookie(HR_COOKIE,createHrToken(u),cookieOptions());
    return res.json({success:true,user:{id:u.id,displayName:u.display_name_snapshot}});
  } catch(err){return next(err)}
});
router.post('/logout',(_req,res)=>{res.clearCookie(HR_COOKIE,{...cookieOptions(),maxAge:undefined});res.json({success:true});});
router.get('/me',authenticateUser,(req,res)=>res.json({success:true,user:{id:req.authUser.id,displayName:req.authUser.displayName,permissions:[...req.authUser.permissions]}}));
export default router;
