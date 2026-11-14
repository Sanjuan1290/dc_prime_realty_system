import {spawn} from 'node:child_process';
import {readdirSync, writeFileSync, openSync, closeSync, mkdirSync, cpSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
// Unit tests use dummy credentials and a closed local port; builds use local API paths.
const root=fileURLToPath(new URL('../../',import.meta.url));
const runtime=resolve(root,'QA_REPORTS/.runtime');
const evidence=resolve(root,'QA_REPORTS/evidence');
mkdirSync(runtime,{recursive:true});mkdirSync(evidence,{recursive:true});
const env={...process.env,NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'9',TIDB_USERNAME:'unit_only',TIDB_PASSWORD:'unit_only',TIDB_DATABASE:'dc_prime_realty_system_db_test',TIDB_SSL:'false',JWT_SECRET:'unit-only-never-used-on-live-services',HR_DB_HOST:'127.0.0.1',HR_DB_PORT:'9',HR_DB_USER:'unit_only',HR_DB_PASSWORD:'unit_only',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false'};
function run(name,args,cwd=runtime,settings=env){return new Promise(resolveResult=>{const fd=openSync(resolve(evidence,name+'.log'),'w');const child=spawn(process.execPath,args,{cwd,env:settings,windowsHide:true,stdio:['ignore',fd,fd]});child.on('error',e=>{closeSync(fd);resolveResult({name,error:e.message,exitCode:-1})});child.on('exit',exitCode=>{closeSync(fd);console.log(name,exitCode===0?'PASS':'FAIL',exitCode);resolveResult({name,exitCode})})})}
if(process.argv.includes('--build')){
  const apps=[['WEBSITE','',{}],['SYSTEM','system',{VITE_API_URL:'/api/v1'}],['FINANCE','finance',{VITE_FINANCE_API_URL:'/finance-api'}],['HR','hr',{VITE_HR_API_URL:'/hr-api/api/v1',VITE_HR_STAGING_WRITES:'false',VITE_HR_KIOSK_ENABLED:'false'}]];
  const results=await Promise.all(apps.map(async([app,out,extra])=>{
    const cwd=resolve(root,'CLIENT',app);
    if(app==='HR'){const check=await run('hr-client-check',[resolve(cwd,'scripts/check-hr-client.mjs')],cwd);if(check.exitCode!==0)return check}
    if(app==='SYSTEM'){const check=await run('system-prebuild',[resolve(cwd,'scripts/check-review-center-scope.mjs')],cwd);if(check.exitCode!==0)return check}
    const result=await run('build-'+app.toLowerCase(),[resolve(cwd,'node_modules/vite/bin/vite.js'),'build'],cwd,{...process.env,DC_MULTI_APP_BUILD:'1',...extra});
    if(result.exitCode===0){const target=resolve(root,'CLIENT/dist',out);mkdirSync(target,{recursive:true});cpSync(resolve(cwd,'dist'),target,{recursive:true})}
    return result;
  }));
  writeFileSync(resolve(evidence,'build-results.json'),JSON.stringify(results,null,2));
  if(results.some(r=>r.exitCode!==0))process.exitCode=1;
}else{
  const suites=[['finance-unit','SERVER/FINANCE'],['hr-unit','SERVER/HR'],['hr-client-unit','CLIENT/HR'],['website-unit','CLIENT/WEBSITE'],['system-unit','SERVER/SYSTEM']];
  const results=await Promise.all(suites.filter(([name])=>!process.argv.includes('--system-only')||name==='system-unit').map(([name,dir])=>{
    const tests=resolve(root,dir,'tests');
    const args=['--test',...readdirSync(tests).filter(f=>/\.test\.(?:mjs|js)$/.test(f)).map(f=>resolve(tests,f))];
    if(name==='system-unit')args.unshift('--import',pathToFileURL(resolve(tests,'testEnv.js')).href);
    return run(name,args);
  }));
  writeFileSync(resolve(evidence,'unit-results.json'),JSON.stringify(results,null,2));
  if(results.some(r=>r.exitCode!==0))process.exitCode=1;
}
