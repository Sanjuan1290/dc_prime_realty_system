// Production SYSTEM bundle + real Pages proxy + simulated provider responses.
// This script starts only a loopback HTTP server and never accesses a real account/database.
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {proxy} from '../../CLIENT/shared/proxy.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const dist=resolve(root,'CLIENT/dist'),out=resolve(root,'QA_REPORTS/evidence/startup-recovery');mkdirSync(out,{recursive:true});
const originalFetch=globalThis.fetch;
const password='Startup-QA-only-2026!';
const checks=[],exceptions=[];
let scenario;
const json=(body,status=200,headers={})=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json',...headers}});
globalThis.fetch=async(input,options={})=>{
  const url=new URL(input instanceof Request?input.url:input);
  if(url.hostname!=='qa-render.invalid')throw new Error('External access is disabled in this test');
  scenario.requests.push({path:url.pathname,method:options.method});
  const sleep=()=>new Response('Too Many Requests\n',{status:429,headers:{'x-render-routing':'hibernate-rate-limited','retry-after':'2'}});
  if(url.pathname==='/api/v1/user/me')return scenario.kind==='session-unavailable'?json({code:'SERVER_UNAVAILABLE',message:'The server is temporarily unavailable.'},503):json({message:'Not signed in.'},401);
  if(url.pathname==='/api/v1/system-status')return scenario.kind==='initial-startup'?sleep():json({status:'active'});
  if(url.pathname==='/api/v1/user/login'){
    const body=JSON.parse(await new Response(options.body).text());assert.equal(body.password,password);
    if(scenario.kind==='login-startup')return sleep();
    if(scenario.kind==='login-limit')return json({code:'LOGIN_RATE_LIMITED',message:'Too many login attempts. Please wait before trying again.',retryAfterSeconds:2},429,{'retry-after':'2'});
    if(scenario.kind==='plain-limit')return new Response('<html><body>Too Many Requests private diagnostics</body></html>',{status:429,headers:{'content-type':'text/html','retry-after':'2'}});
    if(scenario.kind==='gateway-error')return new Response('<html><body>private gateway diagnostics</body></html>',{status:502,headers:{'content-type':'text/html'}});
    return json({code:'INVALID_CREDENTIALS',message:'Incorrect email or password.'},401);
  }
  return json({code:'TEST_ROUTE_NOT_FOUND'},404);
};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1');
    if(url.pathname.startsWith('/api/v1/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);
      const response=await proxy({request:new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})}),env:{SYSTEM_API_ORIGIN:'https://qa-render.invalid'}},{originVar:'SYSTEM_API_ORIGIN',prefix:'',system:'system'});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    let file=resolve(dist,'.'+decodeURIComponent(url.pathname));
    if(!file.startsWith(dist+sep)){res.writeHead(403);res.end();return}
    try{if(!statSync(file).isFile())file=resolve(dist,'system/index.html')}catch{file=resolve(dist,'system/index.html')}
    res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(readFileSync(file));
  }catch(error){res.writeHead(500);res.end(error.message)}
});
await new Promise(resolveReady=>server.listen(0,'127.0.0.1',resolveReady));
const base=`http://127.0.0.1:${server.address().port}`;
let browser;
try{
  browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  for(const kind of ['initial-startup','login-startup','login-limit','plain-limit','session-unavailable','gateway-error']){
    scenario={kind,requests:[]};const context=await browser.newContext({viewport:{width:1440,height:1000}});const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>exceptions.push(e.message));
    await page.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
    try{
      await page.goto(base+'/system/portal');await page.locator('input[type=email]').fill('startup-qa@example.invalid');await page.locator('input[type=password]').fill(password);
      if(kind!=='initial-startup')await page.getByRole('button',{name:'Sign in',exact:true}).click();
      if(['initial-startup','login-startup','login-limit','plain-limit'].includes(kind)){
        const message=kind.includes('startup')?/waking up/:/Too many (login attempts|requests)/;
        await page.getByRole(kind==='initial-startup'?'status':'alert').filter({hasText:message}).waitFor();
        assert.equal(await page.locator('button[type=submit]').isDisabled(),true);
        const postsBefore=scenario.requests.filter(r=>r.method==='POST').length;
        await page.locator('form').evaluate(form=>form.requestSubmit());await page.waitForTimeout(100);
        assert.equal(scenario.requests.filter(r=>r.method==='POST').length,postsBefore,'Cooldown must block additional submissions');
        await page.screenshot({path:resolve(out,kind+'.png')});
        await page.waitForFunction(()=>!document.querySelector('button[type=submit]').disabled);
        const readsBefore=scenario.requests.filter(r=>r.method==='GET').length;
        await page.evaluate(()=>{window.dispatchEvent(new Event('focus'));document.dispatchEvent(new Event('visibilitychange'))});await page.waitForTimeout(150);
        assert.equal(scenario.requests.filter(r=>r.method==='GET').length,readsBefore,'Returning to a login tab must not trigger more startup checks');
        assert.equal(scenario.requests.filter(r=>r.method==='POST').length,postsBefore,'Never automatically replay a login after the cooldown');
        scenario.kind='normal';await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('alert').filter({hasText:'Incorrect email or password.'}).waitFor();
        assert.equal(scenario.requests.filter(r=>r.method==='POST').length,postsBefore+1);
      }else{
        await page.getByRole('alert').waitFor();
        assert.equal(scenario.requests.filter(r=>r.method==='POST').length,1);
        assert.equal(await page.getByRole('button',{name:'Sign in',exact:true}).isEnabled(),true);
      }
      assert.equal(new URL(page.url()).pathname,'/system/portal');
      assert.equal(await page.locator('input[type=email]').inputValue(),'startup-qa@example.invalid');assert.equal(await page.locator('input[type=password]').inputValue(),password);
      assert.doesNotMatch(await page.innerText('body'),/<html|private (gateway )?diagnostics/);
      checks.push({name:kind,status:'PASS',requests:scenario.requests});
    }catch(error){checks.push({name:kind,status:'FAIL',reason:error.message,requests:scenario.requests});await page.screenshot({path:resolve(out,kind+'-failure.png')}).catch(()=>{})}
    finally{await context.close()}
    console.log(checks.at(-1).status,kind,checks.at(-1).reason||'');
  }
  assert.deepEqual(exceptions,[]);
}finally{
  await browser?.close();server.closeAllConnections();await new Promise(done=>server.close(done));globalThis.fetch=originalFetch;
  writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,exceptions},null,2));
}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
