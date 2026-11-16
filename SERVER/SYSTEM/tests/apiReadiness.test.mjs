import test from 'node:test';
import assert from 'node:assert/strict';
import {createApiReadiness} from '../../../CLIENT/shared/apiReadiness.js';
test('cold health is retried once for concurrent session and login checks; successful health is cached',async()=>{
  const calls=[],delays=[];let clock=1;
  const ready=createApiReadiness({fetcher:async(url,options)=>{calls.push({url,options});return calls.length===1?new Response(JSON.stringify({code:'SERVER_WAKING_UP',message:'Starting',retryAfterSeconds:2}),{status:503,headers:{'content-type':'application/json'}}):new Response('{}')},sleep:async ms=>{delays.push(ms);clock+=ms},now:()=>clock});
  await Promise.all([ready('/health'),ready('/health')]);await ready('/health');
  assert.equal(calls.length,2);assert.deepEqual(delays,[2000]);assert.ok(calls.every(c=>c.options.method==='GET'&&!c.options.body));
});
test('security challenges and real rate limits are not automatically retried',async()=>{
  for(const headers of [{'cf-mitigated':'challenge','cf-ray':'diagnostic-ray'},{'retry-after':'60'}]){
    let calls=0;const ready=createApiReadiness({fetcher:async()=>{calls++;return new Response('Blocked',{status:429,headers})}});
    await assert.rejects(ready('/health'),error=>['API_ACCESS_BLOCKED','RATE_LIMITED'].includes(error.code));assert.equal(calls,1);
  }
});
test('proxy forwards application headers and identifies its own request without browser security metadata',async()=>{
  const {proxy}=await import('../../../CLIENT/shared/proxy.js');const original=globalThis.fetch;
  try{
    let sent;
    globalThis.fetch=async(url,options)=>{sent=options;return new Response('{}')};
    const result=await proxy({request:new Request('https://app.example/finance-api/api/v1/auth/me',{headers:{cookie:'dc_finance_session=secret; cf_clearance=private','sec-fetch-site':'same-origin','cf-connecting-ip':'spoofed','x-forwarded-for':'spoofed',origin:'https://app.example',accept:'application/json'}}),env:{FINANCE_API_ORIGIN:'https://finance.example'}},{originVar:'FINANCE_API_ORIGIN',prefix:'/finance-api',system:'finance'});
    assert.equal(result.status,200);assert.equal(sent.headers.get('user-agent'),'dc-prime-pages-api/1.0');assert.equal(sent.headers.get('cookie'),'dc_finance_session=secret');assert.equal(sent.headers.get('origin'),'https://app.example');
    for(const name of ['cf-connecting-ip','x-forwarded-for','sec-fetch-site'])assert.equal(sent.headers.get(name),null);
  }finally{globalThis.fetch=original}
});
