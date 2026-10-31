// Queries only. Never imports service entrypoints or starts workers.
import {readFileSync, mkdirSync, writeFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url));
const dotenv=require('dotenv');
const mysql=require('mysql2/promise');
const results=[];
for(const app of ['SYSTEM','HR','FINANCE']) {
  const env=dotenv.parse(readFileSync(resolve(root,'SERVER',app,'.env')));
  const hr=app==='HR';
  const pool=mysql.createPool({host:env[hr?'HR_DB_HOST':'TIDB_HOST'],port:Number(env[hr?'HR_DB_PORT':'TIDB_PORT']||4000),
    user:env[hr?'HR_DB_USER':'TIDB_USERNAME'],password:env[hr?'HR_DB_PASSWORD':'TIDB_PASSWORD'],
    database:env[hr?'HR_DB_NAME':'TIDB_DATABASE'],ssl:{minVersion:'TLSv1.2',rejectUnauthorized:true},connectTimeout:10000,connectionLimit:1,dateStrings:true});
  const result={app,environment:'live/development; read-only diagnosis only',checks:[]};
  try {
    const [identity]=await pool.query('SELECT DATABASE() AS db, VERSION() AS version');
    result.database=identity[0].db;result.engine=identity[0].version;
    const [tables]=await pool.execute('SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA=DATABASE()');
    result.tableCount=tables.length;
    if(app==='FINANCE') {
      Object.assign(process.env,env);
      const {getPool}=await import('../../SERVER/FINANCE/src/db.js');
      const {getDashboard,listTransactions,listCategories,listAudit}=await import('../../SERVER/FINANCE/src/ledger.js');
      const {listImportBatches}=await import('../../SERVER/FINANCE/src/importService.js');
      const {getFinanceReconciliation}=await import('../../SERVER/FINANCE/src/reconciliation.js');
      // Capture the SQL template only, without credentials, values or row data.
      const financePool=getPool(), execute=financePool.execute.bind(financePool);
      financePool.execute=async(sql,values)=>{try{return await execute(sql,values)}catch(e){result.failedSql=sql;throw e}};
      for(const [name,fn] of Object.entries({dashboard:()=>getDashboard({from:'2026-10-01',to:'2026-10-30'}),transactions:()=>listTransactions({from:'2026-10-01',to:'2026-10-30'}),categories:()=>listCategories(),audit:()=>listAudit(),imports:()=>listImportBatches(),reconciliation:()=>getFinanceReconciliation({from:'2026-10-01',to:'2026-10-30'})})){
        try {await fn();result.checks.push({name,status:'PASS'});}catch(e){result.checks.push({name,status:'FAIL',code:e.code,errno:e.errno,sqlState:e.sqlState});}
      }
      await financePool.end();
    }
    result.status=result.checks.some(c=>c.status==='FAIL')?'FAIL':'PASS';
  } catch(e) {result.status='BLOCKED';result.code=e.code||e.name;}
  finally {await pool.end();}
  results.push(result);console.log(JSON.stringify(result));
}
mkdirSync(resolve(root,'QA_REPORTS/evidence'),{recursive:true});
writeFileSync(resolve(root,'QA_REPORTS/evidence/live-readonly.json'),JSON.stringify(results,null,2));
