// Real HR/Finance entrypoints with local stalled sockets or synthetic pools.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=resolve(root,'QA_REPORTS/.runtime/hr-finance-startup'),out=resolve(root,'QA_REPORTS/evidence');mkdirSync(runtime,{recursive:true});mkdirSync(out,{recursive:true});
const baseEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|SystemRoot|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|LOCALAPPDATA|APPDATA|USERPROFILE)$/i.test(key)));
const apps=[{app:'HR',entry:'SERVER/HR/server.js',module:'SERVER/HR/db/connect.js',importPool:'import {db} from',listen:'HR API running on',ready:'HR database connected',database:'dc_prime_hr_db'},{app:'FINANCE',entry:'SERVER/FINANCE/src/server.js',module:'SERVER/FINANCE/src/db.js',importPool:'import {getPool} from',listen:'Finance API listening on',ready:'Finance database connected',database:'dc_prime_finance_db'}];
async function listen(server){await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done)});return server.address().port}
async function freePort(){const server=createServer();const port=await listen(server);await new Promise(done=>server.close(done));return port}
function settings(app,port,dbPort,timeout){return {...baseEnv,NODE_ENV:'test',PORT:String(port),TIDB_HOST:'127.0.0.1',TIDB_PORT:String(dbPort),TIDB_USERNAME:'synthetic_only',TIDB_PASSWORD:'synthetic-password-never-log',TIDB_DATABASE:app.database,TIDB_SSL:'false',TIDB_CONNECT_TIMEOUT_MS:'10000',DATABASE_STARTUP_TIMEOUT_MS:String(timeout),FINANCE_STAGING_ENABLED:'true',FINANCE_PRODUCTION_ENABLED:'false',FINANCE_ALLOWED_ORIGINS:'http://127.0.0.1:4179',HR_CORS_ORIGIN:'http://127.0.0.1:4179',HR_DB_HOST:'127.0.0.1',HR_DB_PORT:String(dbPort),HR_DB_USER:'synthetic_only',HR_DB_PASSWORD:'synthetic-password-never-log',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false',HR_DB_CONNECT_TIMEOUT_MS:'10000',HR_DB_STARTUP_TIMEOUT_MS:String(timeout),HR_STAGING_ONLY:'true',HR_ENABLE_WRITES:'false',HR_ENABLE_JOBS:'false',HR_ENABLE_SALARY_DELIVERY:'false',HR_JWT_SECRET:'synthetic-startup-check-only-secret'};}
const checks=[];
for(const app of apps){
  for(const kind of ['connection-stall','query-stall','healthy','production-healthy','production-tls-guard']){
    const sockets=new Set();let accepted=0;
    const database=createServer(socket=>{accepted++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());socket.write(Buffer.from([1]))});
    const dbPort=await listen(database),port=await freePort();
    let preload;
    if(kind==='healthy'||kind==='production-healthy'||kind==='query-stall'){
      preload=resolve(runtime,`${app.app}-${kind}.mjs`);
      const poolImport=`${app.importPool} ${JSON.stringify(pathToFileURL(resolve(root,app.module)).href)};${app.app==='FINANCE'?'const db=getPool();':''}`;
      writeFileSync(preload,poolImport+(['healthy','production-healthy'].includes(kind)?`
const ready=new Promise(done=>process.once('message',done));
db.getConnection=async()=>{await ready;return {query:async options=>{if(options.sql!=='SELECT 1'&&!String(options).startsWith('INSERT IGNORE INTO hr_'))throw new Error('Unexpected SQL');return [[{ok:1}]]},execute:async sql=>{if(!sql.startsWith('SELECT COLUMN_NAME'))throw new Error('Unexpected schema query');return [[{COLUMN_NAME:'must_change_password'},{COLUMN_NAME:'temporary_password_expires_at'},{COLUMN_NAME:'invitation_sent_at'}]]},release(){},destroy(){}}};
`:`
db.getConnection=async()=>({query:()=>new Promise(()=>{}),release(){},destroy(){}});
`)+`db.query=async sql=>{if(!sql.startsWith('INSERT IGNORE INTO hr_'))throw new Error('Unexpected business query in startup test');return [{affectedRows:0}]};db.execute=async sql=>{if(!sql.startsWith('SELECT COLUMN_NAME'))throw new Error('Unexpected Finance startup query');return [[{COLUMN_NAME:'must_change_password'},{COLUMN_NAME:'temporary_password_expires_at'},{COLUMN_NAME:'invitation_sent_at'}]]};`);
    }
    const env=settings(app,port,dbPort,['healthy','production-healthy'].includes(kind)?5000:1500);
    if(kind==='production-healthy'){env.NODE_ENV='production';env.HR_DB_TLS='true';env.TIDB_SSL='true';}
    if(kind==='production-tls-guard'){env.NODE_ENV='production';env.HR_DB_TLS='false';}
    const child=spawn(process.execPath,[...(preload?['--import',pathToFileURL(preload).href]:[]),resolve(root,app.entry)],{cwd:runtime,env,windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});
    let output='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>output+=data);
    const exited=new Promise((done,reject)=>{child.once('exit',(code,signal)=>done({code,signal}));child.once('error',reject)});
    const watchdog=setTimeout(()=>child.kill(),10000);
    const get=async path=>{const response=await fetch(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(1000)});return {status:response.status,body:await response.json()}};
    try{
      if(kind==='production-tls-guard'){
        const exit=await exited;assert.equal(exit.code,1);assert.ok(!output.includes(app.listen));assert.equal(accepted,0);
        assert.match(output,app.app==='HR'?/require TLS/:/TLS_REQUIRED/);
        checks.push({app:app.app,name:kind,status:'PASS',exitCode:exit.code});
      }else{
        await new Promise((done,reject)=>{
          const timer=setTimeout(()=>{clearInterval(poll);reject(new Error('HTTP port did not open before database readiness'))},5000);
          const poll=setInterval(()=>{if(output.includes(app.listen)){clearTimeout(timer);clearInterval(poll);done()}},10);
        });
        assert.equal((await get('/api/v1/live')).status,200);
        const initial=await get('/api/v1/health');assert.equal(initial.status,503);assert.equal(initial.body.status,'starting');
        if(['healthy','production-healthy'].includes(kind)){
          child.send('database-ready');let ready;
          for(let i=0;i<40;i++){ready=await get('/api/v1/health');if(ready.status===200)break;await new Promise(done=>setTimeout(done,25))}
          assert.equal(ready.status,200);assert.ok(output.includes(app.ready));assert.equal((await get('/api/v1/auth/me')).status,401);assert.equal(accepted,0);
          checks.push({app:app.app,name:kind,status:'PASS',initialReadiness:503,ready:200,unauthenticatedStatus:401});
        }else{
          assert.equal((await get('/api/v1/auth/me')).status,503);
          const login=await fetch(`http://127.0.0.1:${port}/api/v1/auth/login`,{method:'POST',headers:{origin:'http://127.0.0.1:4179','content-type':'application/json','x-requested-with':'dcprime-finance'},body:'{}',signal:AbortSignal.timeout(1000)});assert.equal(login.status,503);
          const exit=await exited;assert.equal(exit.code,1);assert.match(output,/DATABASE_STARTUP_TIMEOUT/);assert.match(output,kind==='query-stall'?/stage: 'query'/:/stage: 'connection'/);assert.ok(!output.includes(app.ready));
          if(kind==='connection-stall')assert.equal(accepted,1);
          checks.push({app:app.app,name:kind,status:'PASS',liveness:200,readiness:503,login:503,exitCode:exit.code});
        }
      }
      assert.doesNotMatch(output,/synthetic-password-never-log/);
    }catch(error){checks.push({app:app.app,name:kind,status:'FAIL',reason:error.message,output})}
    finally{clearTimeout(watchdog);if(child.exitCode===null)child.kill();await exited;for(const socket of sockets)socket.destroy();await new Promise(done=>database.close(done));}
    console.log(JSON.stringify(checks.at(-1)));
  }
}
writeFileSync(resolve(out,'hr-finance-startup-results.json'),JSON.stringify({checks},null,2));
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
