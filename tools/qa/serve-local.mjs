// Real application entrypoints, isolated DBs, and a local Pages API adapter.
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {createReadStream,mkdirSync,statSync,readFileSync,writeSync,openSync,closeSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve,extname,sep} from 'node:path';
import {proxy} from '../../CLIENT/shared/proxy.js';
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=resolve(root,'QA_REPORTS/.runtime');
mkdirSync(runtime,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>/^(PATH|SystemRoot|WINDIR|TEMP|TMP|COMSPEC|PATHEXT|LOCALAPPDATA|APPDATA|USERPROFILE)$/i.test(k)));
const token='qa-local-integration-token-'.repeat(3);
const common={...env,NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_SSL:'false',CORS_ORIGIN:'http://127.0.0.1:4179',HR_LEGACY_MODE:'frozen'};
const configurations=[
  ['SYSTEM','server.js',{...common,PORT:'5201',TIDB_USERNAME:'qa_system',TIDB_DATABASE:'dc_prime_realty_system_db',JWT_SECRET:'qa-system-only-secret-'.repeat(3),REALTY_HR_STAGING_ONLY:'true',REALTY_HR_SALARY_INGEST:'true',REALTY_HR_INTEGRATION_TOKEN:token}],
  ['HR','server.js',{...env,NODE_ENV:'test',PORT:'5202',HR_STAGING_ONLY:'true',HR_ENABLE_WRITES:'true',HR_ENABLE_JOBS:'true',HR_ALLOW_PAYROLL_RELEASE:'true',HR_ENABLE_SALARY_DELIVERY:'true',REALTY_FINANCE_SALARY_ENDPOINT:'http://127.0.0.1:5201/api/v1/internal/finance/salary-events',HR_TO_REALTY_INTEGRATION_TOKEN:token,HR_DB_HOST:'127.0.0.1',HR_DB_PORT:'13307',HR_DB_USER:'qa_hr',HR_DB_PASSWORD:'qa-isolated-only-password',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false',HR_JWT_SECRET:'qa-hr-only-secret-'.repeat(4),HR_COOKIE_SECURE:'false',HR_CORS_ORIGIN:'http://127.0.0.1:4179',ATTENDANCE_PINCODE:'724381',ATTENDANCE_KIOSK_SECRET:'qa-kiosk-only-'.repeat(4)}],
  ['FINANCE','src/server.js',{...common,PORT:'5203',TIDB_USERNAME:'qa_finance',TIDB_DATABASE:'dc_prime_finance_db',FINANCE_STAGING_ENABLED:'true',FINANCE_PRODUCTION_ENABLED:'false',FINANCE_IMPORTS_ENABLED:'true',FINANCE_ALLOWED_ORIGINS:'http://127.0.0.1:4179',FINANCE_COOKIE_SECURE:'false'}],
  ['WEBSITE','server.js',{...env,NODE_ENV:'test',PORT:'5204'}],
];
const children=[],fds=[];
for(const [app,entry,settings] of configurations){
  const fd=openSync(resolve(root,`QA_REPORTS/evidence/${app.toLowerCase()}-startup.log`),'w');fds.push(fd);
  const child=spawn(process.execPath,[resolve(root,'SERVER',app,entry)],{cwd:runtime,env:settings,windowsHide:true,stdio:['ignore',fd,fd]});
  child.on('error',e=>console.error(app,e.code));children.push(child);
}
const nativeFetch=globalThis.fetch;
const map={'qa-system.invalid':5201,'qa-hr.invalid':5202,'qa-finance.invalid':5203};
globalThis.fetch=(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input);
  if(map[url.hostname]) {url.protocol='http:';url.hostname='127.0.0.1';url.port=String(map[new URL(input).hostname]);return nativeFetch(url,{...options,...(options.body?{duplex:'half'}:{})});}
  return nativeFetch(input,options);
};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.mp4':'video/mp4','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon'};
const dist=resolve(root,'CLIENT/dist');
const server=createServer(async(req,res)=>{
  try {
    const url=new URL(req.url,'http://127.0.0.1:4179');
    const routes=[['/finance-api','finance','FINANCE_API_ORIGIN'],['/hr-api','hr','HR_API_ORIGIN'],['/api','system','SYSTEM_API_ORIGIN']];
    const api=routes.find(([prefix])=>url.pathname.startsWith(prefix+'/'));
    if(api){
      const [prefix,system,originVar]=api;const chunks=[];for await(const c of req)chunks.push(c);
      const body=Buffer.concat(chunks);const request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}: {})});
      const result=await proxy({request,env:{[originVar]:`https://qa-${system}.invalid`}}, {originVar,prefix:system==='system'?'':prefix,system});
      res.statusCode=result.status;for(const [k,v] of result.headers) if(k!=='set-cookie')res.setHeader(k,v);
      const cookies=result.headers.getSetCookie();if(cookies.length)res.setHeader('set-cookie',cookies);
      return res.end(Buffer.from(await result.arrayBuffer()));
    }
    let file=resolve(dist,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(dist+sep)&&file!==dist){res.statusCode=403;return res.end();}
    let stat;try{stat=statSync(file)}catch{}
    if(stat?.isDirectory()) file=resolve(file,'index.html');
    else if(!stat){
      if(extname(url.pathname)){res.statusCode=404;return res.end('Missing asset');}
      const app=['system','hr','finance'].find(x=>url.pathname===`/${x}`||url.pathname.startsWith(`/${x}/`));
      file=resolve(dist,app||'','index.html');
    }
    res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.setHeader('cache-control','no-store');
    createReadStream(file).on('error',()=>{res.statusCode=404;res.end()}).pipe(res);
  }catch(e){res.statusCode=500;res.end(JSON.stringify({code:e.code||e.name}));}
});
server.listen(4179,'127.0.0.1');
let stopping=false;
const stop=()=>{if(stopping)return;stopping=true;server.close();for(const c of children)c.kill();for(const fd of fds)closeSync(fd);process.exit();};
process.on('SIGINT',stop);process.on('SIGTERM',stop);
console.log('QA Pages adapter: http://127.0.0.1:4179; APIs 5201-5203; WEBSITE host 5204. No external credentials loaded.');
