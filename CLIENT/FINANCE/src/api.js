const ROOT=(import.meta.env.VITE_FINANCE_API_URL||'').replace(/\/$/,'');
export async function api(path,{method='GET',data}={}) {
  const response=await fetch(`${ROOT}/api/v1${path}`,{method,credentials:'include',headers:{'Accept':'application/json',...(data?{'Content-Type':'application/json'}:{}),...(method!=='GET'?{'X-Requested-With':'dcprime-finance'}:{})},...(data?{body:JSON.stringify(data)}:{})});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(body?.error?.message||`Request failed (${response.status})`);
  return body;
}
export const request=(path,method='GET',data)=>api(path,{method,data});
