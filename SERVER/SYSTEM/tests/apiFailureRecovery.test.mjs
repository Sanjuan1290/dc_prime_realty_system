import test from 'node:test'
import assert from 'node:assert/strict'
import {readApiFailure} from '../../../CLIENT/shared/apiFailure.js'
import {normalizeUpstreamAvailability} from '../../../CLIENT/shared/upstreamAvailability.js'
const json=(body,status,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}})

test('HR and Finance API error shapes retain messages and exact retry intervals',async()=>{
  for(const payload of [{code:'SERVER_UNAVAILABLE',message:'Waiting for database',retryAfterSeconds:5},{error:{code:'SERVER_UNAVAILABLE',message:'Waiting for database',retryAfterSeconds:5}}]){
    const failure=await readApiFailure(json(payload,503))
    assert.equal(failure.code,'SERVER_UNAVAILABLE');assert.equal(failure.message,'Waiting for database');assert.equal(failure.retryAfterSeconds,5)
  }
})
test('raw Render startup throttles retain provider classification and delay',async()=>{
  const failure=await readApiFailure(new Response('Too Many Requests',{status:429,headers:{'x-render-routing':'hibernate-rate-limited','retry-after':'7'}}))
  assert.equal(failure.code,'SERVER_WAKING_UP');assert.equal(failure.retryAfterSeconds,7)
})
test('application login throttles retain real policy and retry headers',async()=>{
  for(const [code,fallback] of [['HR_LOGIN_RATE_LIMITED',900],['RATE_LIMIT',600]]){
    assert.equal((await readApiFailure(json({code},429))).retryAfterSeconds,fallback)
    assert.equal((await readApiFailure(json({code},429,{'retry-after':'4'}))).retryAfterSeconds,4)
  }
})
test('authentication and validation failures do not create an availability cooldown',async()=>{
  assert.equal((await readApiFailure(json({code:'HR_LOGIN_INVALID'},401))).retryAfterSeconds,0)
  const failure=await readApiFailure(json({error:{code:'INVALID_AMOUNT',message:'Enter a positive amount.'}},400))
  assert.equal(failure.message,'Enter a positive amount.');assert.equal(failure.retryAfterSeconds,0)
})
test('Cloudflare checks are identified separately from a sleeping server without exposing HTML',async()=>{
  for(const response of [new Response('private diagnostics',{status:429,headers:{'cf-mitigated':'challenge'}}),new Response('<html><title>Just a moment...</title><script src="/cdn-cgi/challenge-platform/test">private details</script></html>',{status:429,headers:{'content-type':'text/html'}})]){
    const failure=await readApiFailure(response)
    assert.equal(failure.code,'API_ACCESS_BLOCKED');assert.equal(failure.retryAfterSeconds,0);assert.match(failure.message,/hosting provider blocked/i);assert.doesNotMatch(failure.message,/waking|private|<html/i)
  }
})
test('a challenged upstream receives an explicit JSON failure rather than a startup promise',async()=>{
  const response=await normalizeUpstreamAvailability(new Response('private challenge',{status:429,headers:{'cf-mitigated':'challenge'}}))
  assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),null);
  const failure=await readApiFailure(response);assert.equal(failure.code,'API_ACCESS_BLOCKED');assert.equal(failure.retryAfterSeconds,0)
})
test('non-JSON throttles and gateway errors use safe messages and bounded delays',async()=>{
  for(const status of [429,502,503,504]){
    const failure=await readApiFailure(new Response('<html><body>private diagnostics</body></html>',{status,headers:{'content-type':'text/html'}}),'HR')
    assert.doesNotMatch(failure.message,/private|<html/);assert.equal(failure.retryAfterSeconds,status===429?60:30)
  }
})
