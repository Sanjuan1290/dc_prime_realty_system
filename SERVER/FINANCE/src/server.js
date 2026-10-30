import 'dotenv/config';
import express from 'express';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import helmet from 'helmet';
import {getPool,assertSafeDatabase} from './db.js';
import {problem,dateInManila} from './domain.js';
import {login,requireUser,requireRole,COOKIE_NAME,sessionCookie,sessionHash,clearCookie} from './auth.js';
import {getDashboard,listTransactions,postTransaction,voidTransaction,correctTransaction,listCategories,createCategory,setCategoryActive,listAudit} from './ledger.js';
import {listUsers,createUser} from './users.js';
import {getFinanceReconciliation} from './reconciliation.js';
import {previewImport,commitImport,approveCategoryMapping,listCategoryMappings,listImportBatches} from './importService.js';
const app=express();app.disable('x-powered-by');app.use(helmet());app.use((req,res,next)=>express.json({limit:req.path==='/api/v1/finance/imports/preview'?'3mb':'64kb'})(req,res,next));
const allowed=(process.env.FINANCE_ALLOWED_ORIGINS||'http://localhost:5177').split(',').map(s=>s.trim()).filter(Boolean);
const secure=process.env.FINANCE_COOKIE_SECURE==='true'||process.env.NODE_ENV==='production';
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin){if(!allowed.includes(origin))return next(problem('ORIGIN_DENIED','Finance origin is not permitted.',403));
    res.set('Access-Control-Allow-Origin',origin);res.set('Vary','Origin');res.set('Access-Control-Allow-Credentials','true');
    res.set('Access-Control-Allow-Headers','Content-Type,X-Requested-With');res.set('Access-Control-Allow-Methods','GET,POST,PATCH,OPTIONS');}
  if(req.method==='OPTIONS')return res.sendStatus(204);
  if(['POST','PATCH','PUT','DELETE'].includes(req.method)){
    if(req.headers['x-requested-with']!=='dcprime-finance')return next(problem('CSRF_GUARD','Missing Finance request header.',403));
    if(!origin || !allowed.includes(origin))return next(problem('CSRF_ORIGIN','Missing or disallowed request origin.',403));
  }
  return next();
});
app.use((req,res,next)=>{res.set('Cache-Control','no-store');next();});
const wrap=fn=>(req,res,next)=>Promise.resolve().then(()=>fn(req,res)).catch(next);
app.get('/api/v1/health',wrap(async(req,res)=>{await getPool().query('SELECT 1');res.json({ok:true,service:'finance'});}));
// In-memory attempt throttle adds a staging-only limit; use distributed protection before production.
const attempts=new Map();
app.post('/api/v1/auth/login',wrap(async(req,res)=>{
  const ip=req.ip||'unknown', now=Date.now(),prev=attempts.get(ip)||{count:0,until:now+600000};
  const a=prev.until<now?{count:0,until:now+600000}:prev;
  if(a.count>=8)throw problem('RATE_LIMIT','Too many login attempts. Try again later.',429);
  a.count++;attempts.set(ip,a);
  const email=String(req.body?.email||'').trim().toLowerCase();const password=req.body?.password;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||typeof password!=='string')throw problem('INVALID_CREDENTIALS','Incorrect email or password.',401);
  const result=await login(email,password);
  attempts.delete(ip);res.set('Set-Cookie',sessionCookie(result.token,{secure}));res.json({user:result.user});
}));
app.get('/api/v1/auth/me',requireUser,wrap(async(req,res)=>{const u=req.financeUser;res.json({user:{id:String(u.id),email:u.email,display_name:u.display_name,role:u.role}});}));
app.post('/api/v1/auth/logout',requireUser,wrap(async(req,res)=>{await getPool().execute('UPDATE finance_sessions SET revoked_at=UTC_TIMESTAMP() WHERE token_hash=?',[req.financeSessionHash]);res.set('Set-Cookie',clearCookie(secure));res.json({ok:true});}));
const prefix='/api/v1/finance';
app.use(prefix,requireUser);
app.get(`${prefix}/dashboard`,wrap(async(req,res)=>res.json(await getDashboard(req.query))));
app.get(`${prefix}/transactions`,wrap(async(req,res)=>res.json(await listTransactions(req.query))));
app.post(`${prefix}/transactions`,requireRole('admin','accountant'),wrap(async(req,res)=>res.status(201).json(await postTransaction(req.body,req.financeUser))));
app.post(`${prefix}/transactions/:id/void`,requireRole('admin'),wrap(async(req,res)=>res.json(await voidTransaction(req.params.id,req.body?.reason,req.financeUser))));
app.post(`${prefix}/transactions/:id/correct`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await correctTransaction(req.params.id,req.body,req.financeUser))));
app.get(`${prefix}/categories`,wrap(async(req,res)=>res.json({categories:await listCategories(req.query.kind)})));
app.post(`${prefix}/categories`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await createCategory(req.body,req.financeUser))));
app.patch(`${prefix}/categories/:id`,requireRole('admin'),wrap(async(req,res)=>res.json(await setCategoryActive(req.params.id,req.body?.is_active,req.financeUser))));
app.get(`${prefix}/audit`,requireRole('admin'),wrap(async(req,res)=>res.json(await listAudit(req.query))));
// Read-only Finance-side reconciliation, no access to Realty or HR databases.
app.get(`${prefix}/reconciliation`,requireRole('admin'),wrap(async(req,res)=>res.json(await getFinanceReconciliation(req.query))));
// Import actions are disabled by default until TiDB and end-to-end acceptance.
const requireImportEnabled=(req,res,next)=>process.env.FINANCE_IMPORTS_ENABLED==='true'?next():next(problem('IMPORT_DISABLED','Finance import is not enabled for this environment.',503));
// Import actions are admin-only and require the explicit enable flag.
app.get(`${prefix}/imports`,requireRole('admin'),wrap(async(req,res)=>res.json(await listImportBatches(req.query))));
app.get(`${prefix}/imports/mappings`,requireRole('admin'),wrap(async(req,res)=>res.json({mappings:await listCategoryMappings()})));
app.post(`${prefix}/imports/mappings`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await approveCategoryMapping(req.body,req.financeUser))));
app.post(`${prefix}/imports/preview`,requireRole('admin'),requireImportEnabled,wrap(async(req,res)=>res.status(201).json(await previewImport(req.body,req.financeUser))));
app.post(`${prefix}/imports/:id/commit`,requireRole('admin'),requireImportEnabled,wrap(async(req,res)=>res.json(await commitImport(req.params.id,req.financeUser))));
app.get(`${prefix}/users`,requireRole('admin'),wrap(async(req,res)=>res.json({users:await listUsers()})));
app.post(`${prefix}/users`,requireRole('admin'),wrap(async(req,res)=>res.status(201).json(await createUser(req.body,req.financeUser))));
app.use((req,res)=>res.status(404).json({error:{code:'NOT_FOUND',message:'Finance endpoint not found.'}}));
app.use((err,req,res,next)=>{const status=err.status|| (err.code==='ER_DUP_ENTRY'?409:500);if(status>=500)console.error('[Finance API error]',{method:req.method,path:req.path,code:err.code||err.name,errno:err.errno||null,sqlState:err.sqlState||null});res.status(status).json({error:{code:err.code==='ER_DUP_ENTRY'?'DUPLICATE':(status>=500?'SERVER_ERROR':err.code||'BAD_REQUEST'),message:status>=500?'Finance request failed.':err.message}});});
if(process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])){
  try {assertSafeDatabase();const port=Number(process.env.PORT||5103);app.listen(port,()=>console.log(`Finance staging server listening on ${port}`));}
  catch(e){console.error(e.code||e.message);process.exitCode=1;}
}
export default app;

