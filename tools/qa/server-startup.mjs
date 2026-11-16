// Real SYSTEM entrypoint with disposable local network failures or a synthetic pool.
// Sanitized child environments prevent loading live credentials or starting live jobs.
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=resolve(root,'QA_REPORTS/.runtime/startup-check'),out=resolve(root,'QA_REPORTS/evidence');mkdirSync(runtime,{recursive:true});mkdirSync(out,{recursive:true});
const dbUrl=pathToFileURL(resolve(root,'SERVER/SYSTEM/db/connect.js')).href;
const healthyPreload=resolve(runtime,'healthy-db.mjs'),queryPreload=resolve(runtime,'query-stall-db.mjs');
writeFileSync(healthyPreload,`import {db} from ${JSON.stringify(dbUrl)};
const ready=new Promise(resolve=>process.once('message',()=>resolve()));
db.getConnection=async()=>{await ready;return {query:async q=>{if(q.sql!=='SELECT 1')throw new Error('Unexpected SQL');return [[{ok:1}]]},release(){},destroy(){}}};
db.query=async()=>{throw new Error('Unexpected business query in startup test')};
`);
writeFileSync(queryPreload,`import {db} from ${JSON.stringify(dbUrl)};
db.getConnection=async()=>({query:()=>new Promise(()=>{}),release(){},destroy(){}});
db.query=async()=>{throw new Error('Unexpected business query in startup test')};
`);
async function listen(server){await new Promise((done,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',done)});return server.address().port}
async function freePort(){const server=createServer();const port=await listen(server);await new Promise(done=>server.close(done));return port}
const systemEnv=Object.fromEntries(Object.entries(process.env).filter(([key])=>/^(PATH|SystemRoot|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|LOCALAPPDATA|APPDATA|USERPROFILE)$/i.test(key)));
const checks=[];
for(const kind of ['connection-stall','query-stall','healthy']){
  const sockets=new Set();let accepted=0;
  const database=createServer(socket=>{accepted++;sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.on('error',()=>socket.destroy());socket.write(Buffer.from([1]))});
  const dbPort=await listen(database),port=await freePort();
  const preload=kind==='healthy'?healthyPreload:kind==='query-stall'?queryPreload:null;
  const child=spawn(process.execPath,[...(preload?['--import',pathToFileURL(preload).href]:[]),resolve(root,'SERVER/SYSTEM/server.js')],{
    cwd:runtime,windowsHide:true,stdio:['ignore','pipe','pipe','ipc'],
    env:{...systemEnv,NODE_ENV:'test',PORT:String(port),TIDB_HOST:'127.0.0.1',TIDB_PORT:String(dbPort),TIDB_USERNAME:'synthetic_only',TIDB_PASSWORD:'synthetic-password-never-log',TIDB_DATABASE:'synthetic_startup_check',TIDB_SSL:'false',TIDB_CONNECT_TIMEOUT_MS:'10000',DATABASE_STARTUP_TIMEOUT_MS:kind==='healthy'?'5000':'1500',JWT_SECRET:'synthetic-startup-check-only-secret',HR_LEGACY_MODE:'frozen'},
  });
  let output='';child.stdout.on('data',chunk=>{output+=chunk});child.stderr.on('data',chunk=>{output+=chunk});
  const exited=new Promise((done,reject)=>{child.once('exit',(code,signal)=>done({code,signal}));child.once('error',reject)});
  const watchdog=setTimeout(()=>child.kill(),10000);
  const get=async path=>{const response=await fetch(`http://127.0.0.1:${port}${path}`,{signal:AbortSignal.timeout(1000)});return {status:response.status,body:await response.json(),retryAfter:response.headers.get('retry-after')}};
  try{
    await new Promise((done,reject)=>{
      const timer=setTimeout(()=>{clearInterval(poll);reject(new Error('HTTP port did not open before database readiness'))},5000);
      const poll=setInterval(()=>{if(output.includes(`Server running on 0.0.0.0:${port}`)){clearTimeout(timer);clearInterval(poll);done()}},10);
    });
    const live=await get('/api/v1/live');assert.equal(live.status,200);assert.equal(live.body.status,'alive');
    const initial=await get('/api/v1/health');assert.equal(initial.status,503);assert.equal(initial.body.status,'starting');
    if(kind==='healthy'){
      child.send('database-ready');
      let ready;
      for(let i=0;i<40;i++){ready=await get('/api/v1/health');if(ready.status===200)break;await new Promise(done=>setTimeout(done,25))}
      assert.equal(ready.status,200);assert.equal(ready.body.message,'API is healthy');
      assert.ok(output.indexOf('Server running on')<output.indexOf('TiDB connected'));
      const auth=await get('/api/v1/user/me');assert.equal(auth.status,401);
      checks.push({name:kind,status:'PASS',liveness:live.status,initialReadiness:initial.status,ready:ready.status,unauthenticatedStatus:auth.status});
    }else{
      const status=await get('/api/v1/system-status');assert.equal(status.status,503);assert.equal(status.retryAfter,'5');
      const login=await fetch(`http://127.0.0.1:${port}/api/v1/user/login`,{method:'POST',headers:{'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(1000)});assert.equal(login.status,503);
      const exit=await exited;assert.equal(exit.code,1);assert.match(output,/DATABASE_STARTUP_TIMEOUT/);assert.match(output,kind==='query-stall'?/stage: 'query'/:/stage: 'connection'/);
      assert.doesNotMatch(output,/TiDB connected|Next daily penalty|synthetic-password-never-log/);
      if(kind==='connection-stall')assert.equal(accepted,1);
      checks.push({name:kind,status:'PASS',liveness:live.status,readiness:initial.status,login:login.status,exitCode:exit.code});
    }
  }catch(error){checks.push({name:kind,status:'FAIL',reason:error.message,output})}
  finally{
    clearTimeout(watchdog);if(child.exitCode===null)child.kill();await exited;
    for(const socket of sockets)socket.destroy();await new Promise(done=>database.close(done));
  }
  console.log(JSON.stringify(checks.at(-1)));
}
writeFileSync(resolve(out,'server-startup-results.json'),JSON.stringify({checks},null,2));
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
