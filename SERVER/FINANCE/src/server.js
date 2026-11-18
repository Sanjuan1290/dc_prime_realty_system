import 'dotenv/config';
import express from 'express';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import helmet from 'helmet';
import {ensureFinanceSchema} from './liveSchema.js';
import {getPool,assertSafeDatabase} from './db.js';
import {checkStartupDatabase,readStartupTimeout} from './serverStartup.js';
import {problem,dateInManila} from './domain.js';
import {login,requireUser,requireRole,publicUser,changePassword,requirePermanentPassword,COOKIE_NAME,sessionCookie,sessionHash,clearCookie} from './auth.js';
import {getDashboard,listTransactions,getTransaction,postTransaction,voidTransaction,correctTransaction,listCategories,createCategory,setCategoryActive,deleteCategory,listAudit} from './ledger.js';
import {listUsers,createUser,resendInvitation,updateUser,deletePendingInvitation} from './users.js';
import {getFinanceReport} from './reports.js';
import {getFinanceReconciliation} from './reconciliation.js';
import {previewImport,commitImport,listImportBatches,getImportDetails} from './importService.js';
import {previewUndoImport,undoImport} from './importUndo.js';
import {requestPasswordReset,resetPassword} from './passwordRecovery.js';
const app=express();app.disable('x-powered-by');app.use(helmet());app.use((req,res,next)=>express.json({limit:req.path==='/api/v1/finance/imports/preview'?'3mb':'64kb'})(req,res,next));
let databaseReady=false;
const allowed=(process.env.FINANCE_ALLOWED_ORIGINS||'http://localhost:5177').split(',').map(s=>s.trim()).filter(Boolean);
const secure=process.env.FINANCE_COOKIE_SECURE==='true'||process.env.NODE_ENV==='production';
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin){if(!allowed.includes(origin))return next(problem('ORIGIN_DENIED','Finance origin is not permitted.',403));
    res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Credentials','true');
    res.set('Access-Control-Allow-Headers','Content-Type,X-Requested-With');res.set('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');}
  if(req.method==='OPTIONS')return res.sendStatus(204);
  if(['POST','PATCH','PUT','DELETE'].includes(req.method)){
    if(req.headers['x-requested-with']!=='dcprime-finance')return next(problem('CSRF_GUARD','Missing Finance request header.',403));
    if(!origin || !allowed.includes(origin))return next(problem('CSRF_ORIGIN','Missing or disallowed request origin.',403));
  }
  return next();
});
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
app.get('/api/v1/live',(_req,res)=>res.json({status:'alive',service:'finance'}));
app.get('/api/v1/health',(_req,res)=>{
  if(!databaseReady)return res.status(503).set('Retry-After','5').json({status:'starting',code:'SERVER_UNAVAILABLE',message:'Finance is connecting to its database. Please try again shortly.',retryAfterSeconds:5});
  return res.json({ok:true,service:'finance'});
});
app.use('/api/v1',(_req,res,next)=>databaseReady?next():res.status(503).set('Retry-After','5').json({error:{code:'SERVER_UNAVAILABLE',message:'Finance is connecting to its database. Please try again shortly.',retryAfterSeconds:5}}));
// In-memory attempt throttle adds a staging-only limit; use distributed protection before production.
const attempts=new Map();
app.post('/api/v1/auth/login',wrap(async(req,res)=>{
  const ip=req.ip||'unknown', now=Date.now(),prev=attempts.get(ip)||{count:0,until:now+600000};
  const a=prev.until<now?{count:0,until:now+600000}:prev;
  if(a.count>=8){res.set('Retry-After',String(Math.max(1,Math.ceil((a.until-now)/1000))));throw problem('RATE_LIMIT','Too many login attempts. Try again later.',429);}
  a.count++;attempts.set(ip,a);
  const email=String(req.body?.email||'').trim().toLowerCase();const password=req.body?.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string')throw problem('INVALID_CREDENTIALS','Incorrect email or password.',401);
  const result=await login(email,password);
  attempts.delete(ip);res.set('Set-Cookie',sessionCookie(result.token,{secure}));res.json({user:result.user});
}));
app.get('/api/v1/auth/me',requireUser,wrap(async(req,res)=>{const u=req.financeUser;res.json({user:publicUser(u)});}));
app.post('/api/v1/auth/logout',requireUser,wrap(async(req,res)=>{await getPool().execute('UPDATE finance_sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=?',[req.financeSessionHash]);res.set('Set-Cookie',clearCookie(secure));res.json({ok:true});}));
app.post('/api/v1/auth/change-password',requireUser,wrap(async(req,res)=>res.json(await changePassword(req))));
app.post('/api/v1/auth/forgot-password',wrap(async(req,res)=>res.json(await requestPasswordReset(req.body,req.ip))));
app.post('/api/v1/auth/reset-password',wrap(async(req,res)=>{const result=await resetPassword(req.body);res.set('Set-Cookie',clearCookie(secure));res.json(result);}));
const prefix='/api/v1/finance';
app.use(prefix,requireUser,requirePermanentPassword);
app.use(prefix,(req,res,next)=>process.env.FINANCE_READ_ONLY==='true'&&['POST','PATCH','PUT','DELETE'].includes(req.method)?next(problem('FINANCE_READ_ONLY','Finance is temporarily read-only. Your administrator can restore editing.',503)):next());
app.get(`${prefix}/dashboard`,wrap(async(req,res)=>res.json(await getDashboard(req.query))));
app.get(`${prefix}/reports`,wrap(async(req,res)=>res.json(await getFinanceReport(req.query))));
app.get(`${prefix}/transactions`,wrap(async(req,res)=>res.json(await listTransactions(req.query))));
app.get(`${prefix}/transactions/:id`,wrap(async(req,res)=>res.json(await getTransaction(req.params.id,{includeImport:req.financeUser.role==='admin'}))));
app.post(`${prefix}/transactions`,requireRole('admin','accountant'),wrap(async(req,res)=>res.status(201).json(await postTransaction(req.body,req.financeUser))));
app.post(`${prefix}/transactions/:id/void`,requireRole('admin'),wrap(async(req,res)=>res.json(await voidTransaction(req.params.id,req.body?.reason,req.financeUser))));
app.post(`${prefix}/transactions/:id/correct`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await correctTransaction(req.params.id,req.body,req.financeUser))));
app.get(`${prefix}/categories`,wrap(async(req,res)=>res.json({categories:await listCategories(req.query.kind)})));
app.post(`${prefix}/categories`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await createCategory(req.body,req.financeUser))));
app.patch(`${prefix}/categories/:id`,requireRole('admin'),wrap(async(req,res)=>res.json(await setCategoryActive(req.params.id,req.body?.is_active,req.financeUser))));
app.delete(`${prefix}/categories/:id`,requireRole('admin'),wrap(async(req,res)=>res.json(await deleteCategory(req.params.id,req.financeUser))));
app.get(`${prefix}/audit`,requireRole('admin'),wrap(async(req,res)=>res.json(await listAudit(req.query))));
// Read-only Finance-side reconciliation, no access to Realty or HR databases.
app.get(`${prefix}/reconciliation`,requireRole('admin'),wrap(async(req,res)=>res.json(await getFinanceReconciliation(req.query))));
// Imports are live; administrators can explicitly pause them independently.
const requireImportEnabled=(req,res,next)=>process.env.FINANCE_IMPORTS_READ_ONLY!=='true'?next():next(problem('IMPORT_DISABLED','Imports are temporarily paused by your administrator.',503));
// Imports retain admin access, preview validation and an atomic commit.
app.get(`${prefix}/imports`,requireRole('admin'),wrap(async(req,res)=>res.json(await listImportBatches(req.query))));
app.get(`${prefix}/imports/:id`,requireRole('admin'),wrap(async(req,res)=>res.json(await getImportDetails(req.params.id))));
app.post(`${prefix}/imports/preview`,requireRole('admin'),requireImportEnabled,wrap(async(req,res)=>res.status(201).json(await previewImport(req.body,req.financeUser))));
app.post(`${prefix}/imports/:id/commit`,requireRole('admin'),requireImportEnabled,wrap(async(req,res)=>res.json(await commitImport(req.params.id,req.financeUser))));
app.get(`${prefix}/imports/:id/undo-preview`,requireRole('admin'),wrap(async(req,res)=>res.json(await previewUndoImport(req.params.id))));
app.post(`${prefix}/imports/:id/undo`,requireRole('admin'),wrap(async(req,res)=>res.json(await undoImport(req.params.id,req.body,req.financeUser))));
app.get(`${prefix}/users`,requireRole('admin'),wrap(async(req,res)=>res.json({users:await listUsers()})));
app.patch(`${prefix}/users/:id`,requireRole('admin'),wrap(async(req,res)=>res.json(await updateUser(req.params.id,req.body,req.financeUser))));
app.delete(`${prefix}/users/:id`,requireRole('admin'),wrap(async(req,res)=>res.json(await deletePendingInvitation(req.params.id,req.financeUser))));
app.post(`${prefix}/users/:id/invitation`,requireRole('admin'),wrap(async(req,res)=>res.json(await resendInvitation(req.params.id,req.financeUser))));
app.post(`${prefix}/users`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await createUser(req.body,req.financeUser))));
app.use((req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Finance endpoint not found.'}}));
app.use((err,req,res,next)=>{const status=err.status|| (err.code==='ER_DUP_ENTRY'?409:500);if(status>=500)console.error('[Finance API error]',{method:req.method,path:req.path,code:err.code||err.name,errno:err.errno||null,sqlState:err.sqlState||null});res.status(status).json({error:{code:err.code==='ER_DUP_ENTRY'?'DUPLICATE':(status>=500&&status!==503?'SERVER_ERROR':err.code||'BAD_REQUEST'),message:status>=500&&status!==503?'Finance request failed.':err.message}});});
if(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  try {
    assertSafeDatabase();
    const pool=getPool(),port=Number(process.env.PORT||5103),timeoutMs=readStartupTimeout(process.env.DATABASE_STARTUP_TIMEOUT_MS,30000,'DATABASE_STARTUP_TIMEOUT_MS');
    const server=app.listen(port,'0.0.0.0',async()=>{
      console.log(`Finance API listening on ${port}`);
      console.log(`Checking Finance database connection (startup deadline: ${timeoutMs}ms).`);
      try{await checkStartupDatabase(pool,{timeoutMs,initialize:ensureFinanceSchema});databaseReady=true;console.log('Finance database connected');}
      catch(error){console.error('Finance initialization failed:',{code:error.code||error.name,stage:error.stage,timeoutMs});console.error('Check Render TIDB_* variables, TLS and database network access.');server.close();process.exit(1);}
    });
    server.on('error',error=>{console.error('Finance port binding failed:',{code:error.code||error.name,port});process.exit(1)});
  }
  catch(e){console.error(e.code||e.message);process.exitCode=1;}
}
export default app;

