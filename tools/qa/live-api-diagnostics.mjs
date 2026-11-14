// Public unauthenticated GETs only. Never reads or submits account credentials.
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const endpoints=process.argv.includes('--wait-for-health')?['https://dc-prime-realty.pages.dev/api/v1/health']:[
  'https://dc-prime-realty.pages.dev/api/v1/health',
  'https://dc-prime-realty.pages.dev/api/v1/system-status',
  'https://dc-prime-realty.pages.dev/api/v1/user/me',
  ...(process.argv.includes('--include-direct')?[
    'https://dc-prime-realty-system.onrender.com/api/v1/health',
    'https://dc-prime-realty-system.onrender.com/api/v1/system-status',
  ]:[]),
];
const results=await Promise.all(endpoints.filter(url=>!process.argv.includes('--pages-only')||new URL(url).hostname==='dc-prime-realty.pages.dev').map(async url=>{
  const started=Date.now();
  try{
    const response=await fetch(url,{signal:AbortSignal.timeout(process.argv.includes('--wait-for-health')?55000:20000),redirect:'manual'});
    const text=await response.text();
    const headers=Object.fromEntries([...response.headers].filter(([key])=>/^(content-type|server|retry-after|cf-ray|cf-cache-status|x-ratelimit-.+|ratelimit-.+|location|x-render-.+)$/.test(key)));
    return {url,status:response.status,elapsedMs:Date.now()-started,headers,body:text.slice(0,650)};
  }catch(error){return {url,error:error.cause?.code||error.name,elapsedMs:Date.now()-started}}
}));
const out=fileURLToPath(new URL('../../QA_REPORTS/evidence/',import.meta.url));mkdirSync(out,{recursive:true});
writeFileSync(out+(process.argv.includes('--wait-for-health')?'live-api-health.json':'live-api-diagnostics.json'),JSON.stringify({checkedAt:new Date().toISOString(),results},null,2));
for(const result of results)console.log(JSON.stringify(result));
