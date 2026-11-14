import test from 'node:test'
import assert from 'node:assert/strict'
import {getRenderStartupError,getRetryAfterSeconds,normalizeUpstreamAvailability} from '../../../CLIENT/shared/upstreamAvailability.js'
import {proxy} from '../../../CLIENT/shared/proxy.js'
import {onRequest as standaloneProxy} from '../../../CLIENT/SYSTEM/functions/api/[[path]].js'

const sleeping = (headers={}) => new Response('Too Many Requests\n', {status:429,headers:{'x-render-routing':'hibernate-rate-limited',...headers}})

test('Render wake-up throttle becomes a non-cacheable startup error with a retry interval',async()=>{
  const response=await normalizeUpstreamAvailability(sleeping())
  assert.equal(response.status,503)
  assert.equal(response.headers.get('retry-after'),'60')
  assert.match(response.headers.get('cache-control'),/no-store/)
  const body=await response.json()
  assert.equal(body.code,'SERVER_WAKING_UP')
  assert.equal(body.retryAfterSeconds,60)
  assert.match(body.message,/waking up/)
  assert.equal(body.error.message,body.message)
})
test('Render startup recovery respects a supplied Retry-After',async()=>{
  const response=await normalizeUpstreamAvailability(sleeping({'retry-after':'120'}))
  assert.equal(response.headers.get('retry-after'),'120')
  assert.equal((await response.json()).retryAfterSeconds,120)
})
test('real login rate limits retain the original status, response and retry period',async()=>{
  const body={code:'LOGIN_RATE_LIMITED',message:'Too many login attempts.',retryAfterSeconds:900}
  const original=new Response(JSON.stringify(body),{status:429,headers:{'content-type':'application/json','retry-after':'900'}})
  const response=await normalizeUpstreamAvailability(original)
  assert.equal(response,original)
  assert.equal(response.status,429)
  assert.deepEqual(await response.json(),body)
  assert.equal(getRenderStartupError(response),null)
})
test('ordinary success, authentication errors and unrelated throttles are unchanged',async()=>{
  for(const status of [200,401,429,503]){
    const response=new Response('unchanged',{status})
    assert.equal(await normalizeUpstreamAvailability(response),response)
  }
})
test('Retry-After accepts seconds and HTTP dates, with bounded invalid-value handling',()=>{
  assert.equal(getRetryAfterSeconds('90'),90)
  assert.equal(getRetryAfterSeconds('1.2'),2)
  assert.equal(getRetryAfterSeconds('999999'),3600)
  for(const value of ['','invalid','-1','0'])assert.equal(getRetryAfterSeconds(value,60),60)
  const seconds=getRetryAfterSeconds(new Date(Date.now()+120000).toUTCString())
  assert.ok(seconds>=119&&seconds<=120)
})
test('combined and standalone Pages proxies normalize the provider response without replaying a login',async()=>{
  const originalFetch=globalThis.fetch
  try{
    for(const handler of [context=>proxy(context,{originVar:'SYSTEM_API_ORIGIN',prefix:'',system:'system'}),standaloneProxy]){
      let count=0
      globalThis.fetch=async(_url,options)=>{count++;assert.equal(options.method,'POST');return sleeping()}
      const request=new Request('https://realty.example/api/v1/user/login',{method:'POST',body:'{}'})
      const response=await handler({request,env:{SYSTEM_API_ORIGIN:'https://backend.example'}})
      assert.equal(response.status,503)
      assert.equal((await response.json()).code,'SERVER_WAKING_UP')
      assert.equal(count,1,'Never automatically replay a mutation')
    }
  }finally{globalThis.fetch=originalFetch}
})
