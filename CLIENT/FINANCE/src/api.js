import {readApiFailure} from '../../shared/apiFailure.js';
import {createApiReadiness} from '../../shared/apiReadiness.js';
const ensureReady=createApiReadiness();
const ROOT=(import.meta.env.VITE_FINANCE_API_URL||'').replace(/\/$/,'');
export class FinanceApiError extends Error {
  constructor(message,{status=0,code='',retryAfterSeconds=0}={}){super(message);this.name='FinanceApiError';this.status=status;this.code=code;this.retryAfterSeconds=retryAfterSeconds;}
}
export async function api(path,{method='GET',data,timeoutMs=60000}={}) {
  if(path==='/auth/me'||path==='/auth/login'){
    try{await ensureReady(`${ROOT}/api/v1/health`,'Finance')}
    catch(error){throw new FinanceApiError(error.message,error)}
  }
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try {
    const response=await fetch(`${ROOT}/api/v1${path}`,{method,credentials:'include',headers:{'Accept':'application/json',...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-Requested-With':'dcprime-finance'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:controller.signal});
    if(!response.ok){const failure=await readApiFailure(response,'Finance');throw new FinanceApiError(failure.message,{status:response.status,code:failure.code,retryAfterSeconds:failure.retryAfterSeconds});}
    return response.json().catch(()=>({}));
  }catch(error){
    if(error instanceof FinanceApiError)throw error;
    throw new FinanceApiError(error.name==='AbortError'?'Finance request timed out. Please try again shortly.':'Finance is temporarily unavailable. Please try again shortly.',{code:error.name==='AbortError'?'REQUEST_TIMEOUT':'SERVER_UNAVAILABLE',retryAfterSeconds:30});
  }finally{clearTimeout(timer);}
}
export const request=(path,method='GET',data)=>api(path,{method,data});
