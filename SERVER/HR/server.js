import './config/environment.js';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { db } from './db/connect.js';
import { ensureLiveAccess } from './services/liveAccess.service.js';
import { checkStartupDatabase, readStartupTimeout } from './services/serverStartup.service.js';
import hrAuth from './routers/hrAuth.router.js';
import employees from './routers/System/employees.routers.js';
import attendance from './routers/System/attendance.routers.js';
import payroll from './routers/System/employeePayroll.routers.js';
import {listHrAudit} from './controllers/System/hrReports.controller.js';
import {authenticateUser,requirePermission} from './middleware/auth.middleware.js';
import {PERMISSIONS} from './config/permissions.js';
import kiosk from './routers/attendanceKiosk.router.js';
import { startAttendanceAutoTimeoutScheduler } from './jobs/attendanceAutoTimeout.job.js';
import { startSalaryOutboxWorker } from './jobs/salaryOutbox.job.js';
const app=express();app.disable('x-powered-by');app.use(helmet());app.use(express.json({limit:'1mb'}));app.use(cookieParser());
let databaseReady=false;
const startupTimeoutMs=readStartupTimeout(process.env.HR_DB_STARTUP_TIMEOUT_MS,30000,'HR_DB_STARTUP_TIMEOUT_MS');
const allowedOrigins=new Set(String(process.env.HR_CORS_ORIGIN || '').split(',').map(x=>x.trim()).filter(Boolean));
app.use(cors({origin(origin,cb){cb(origin && !allowedOrigins.has(origin) ? Object.assign(new Error('HR origin forbidden'),{statusCode:403}) : null,true)},credentials:true}));
app.get('/api/v1/live',(_req,res)=>res.set('Cache-Control','no-store').json({status:'alive',service:'hr'}));
app.get('/api/v1/health',(_req,res)=>{
  res.set('Cache-Control','no-store');
  if(!databaseReady)return res.status(503).set('Retry-After','5').json({success:false,status:'starting',code:'SERVER_UNAVAILABLE',message:'HR is connecting to its database. Please try again shortly.',retryAfterSeconds:5});
  return res.json({success:true,service:'hr',status:'ok'});
});
app.use('/api/v1',(_req,res,next)=>databaseReady?next():res.status(503).set('Retry-After','5').json({code:'SERVER_UNAVAILABLE',message:'HR is connecting to its database. Please try again shortly.',retryAfterSeconds:5}));
app.use('/api/v1/auth',(_req,res,next)=>{res.set('Cache-Control','no-store');next();},hrAuth);
const writesAllowed=process.env.HR_READ_ONLY!=='true';
const guard=(req,res,next)=> (['POST','PUT','PATCH','DELETE'].includes(req.method) && !writesAllowed) ? res.status(503).json({code:'HR_READ_ONLY',message:'HR is temporarily read-only. Your administrator can restore editing.'}) : next();
app.get('/api/v1/audit-logs',authenticateUser,requirePermission(PERMISSIONS.AUDIT_VIEW),listHrAudit);
app.use('/api/v1/employees',guard,employees);
app.use('/api/v1/attendance',guard,attendance);
app.use('/api/v1/employee-payroll',guard,payroll);
app.use('/api/v1/attendance-kiosk',guard,kiosk);
app.use((_req,res)=>res.status(404).json({code:'HR_ROUTE_NOT_FOUND'}));
app.use((err,_req,res,_next)=>{console.error('[HR]',err.code || err.message);const status=Number(err?.statusCode || 0),publicError=(status>=400&&status<500)||status===503;res.status(publicError?status:500).json({code:publicError?(err.code||'HR_REQUEST_ERROR'):'HR_INTERNAL_ERROR',message:publicError?err.message:'HR request could not be completed.'})});
if (!process.env.HR_JWT_SECRET || process.env.HR_JWT_SECRET.length < 32) throw new Error('HR_JWT_SECRET must be at least 32 characters.');

const port = Number(
  process.env.PORT || process.env.HR_PORT || 5102
)
const server=app.listen(port, '0.0.0.0', async () => {
  console.log(`HR API running on 0.0.0.0:${port} (writes: ${writesAllowed ? 'enabled' : 'read-only'})`);
  console.log(`Checking HR database connection (startup deadline: ${startupTimeoutMs}ms).`);
  try {
    await checkStartupDatabase(db,{timeoutMs:startupTimeoutMs,initialize:ensureLiveAccess});
    databaseReady=true;
    console.log('HR database connected');
    if (process.env.HR_ENABLE_JOBS!=='false' && writesAllowed) startAttendanceAutoTimeoutScheduler();
    if (process.env.HR_ENABLE_SALARY_DELIVERY!=='false' && writesAllowed && process.env.REALTY_FINANCE_SALARY_ENDPOINT && String(process.env.HR_TO_REALTY_INTEGRATION_TOKEN||'').length>=32) startSalaryOutboxWorker();
  }catch(error){
    databaseReady=false;
    console.error('HR initialization failed:',{code:error.code||error.name,stage:error.stage||'background_jobs',timeoutMs:startupTimeoutMs});
    console.error('Check Render HR_DB_* variables, TLS and database network access.');
    server.close();process.exit(1);
  }
});
server.on('error',error=>{console.error('HR port binding failed:',{code:error.code||error.name,port});process.exit(1)});
export { app };
