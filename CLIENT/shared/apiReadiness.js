import {readApiFailure} from './apiFailure.js'

// Wake the public health route before sending authentication requests. Sharing
// one in-flight check prevents initial session checks and sign-in from racing.
// Only GET health is retried; passwords and other mutations are sent once.
// A cold service can return several quick 503s while its database initializes.
// Keep polling within the deadline instead of exhausting a fixed attempt count.
export function createApiReadiness({fetcher=(...args)=>fetch(...args),sleep=ms=>new Promise(done=>setTimeout(done,ms)),now=()=>Date.now(),deadlineMs=180000}={}){
  let pending=null,readyUntil=0
  return function ensureReady(url,service='API'){
    if(now()<readyUntil)return Promise.resolve()
    if(pending)return pending
    pending=(async()=>{
      const end=now()+deadlineMs
      while(now()<end){
        const remaining=end-now()
        if(remaining<=0)break
        const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.min(remaining,65000))
        let failure
        try{
          const response=await fetcher(url,{method:'GET',credentials:'include',headers:{Accept:'application/json'},signal:controller.signal})
          if(response.ok){readyUntil=now()+60000;await response.body?.cancel();return}
          failure=await readApiFailure(response,service)
          failure.status=response.status
        }catch(error){failure={code:'SERVER_UNAVAILABLE',message:`${service} could not connect. Please try again shortly.`,status:0,retryAfterSeconds:5}}
        finally{clearTimeout(timer)}
        if(!['SERVER_UNAVAILABLE','SERVER_WAKING_UP','REQUEST_TIMEOUT'].includes(failure.code))throw Object.assign(new Error(failure.message),failure)
        const delay=Math.max(1000,(failure.retryAfterSeconds||5)*1000)
        if(now()+delay>=end)throw Object.assign(new Error(failure.message),failure)
        await sleep(delay)
      }
      throw Object.assign(new Error(`${service} is taking longer to start. Please try again shortly.`),{code:'SERVER_UNAVAILABLE',retryAfterSeconds:30})
    })().finally(()=>{pending=null})
    return pending
  }
}
