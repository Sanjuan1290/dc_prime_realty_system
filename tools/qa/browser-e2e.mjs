// Installed Chrome, real production bundles and real local APIs; no UI mocks.
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),base='http://127.0.0.1:4179';
const evidence=resolve(root,'QA_REPORTS/evidence');mkdirSync(evidence,{recursive:true});
const checks=[],errors=[],requests=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext();const page=await context.newPage();
page.on('pageerror',error=>errors.push(error.message));
page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)requests.push({url:new URL(r.url()).pathname,status:r.status()})});
async function check(app,name,fn){try{await fn();checks.push({app,name,status:'PASS'});console.log('PASS',app,name)}catch(e){checks.push({app,name,status:'FAIL',reason:e.message});console.log('FAIL',app,name,e.message)}}
async function go(path){await page.goto(base+path);await page.waitForFunction(()=>document.body.innerText.trim().length>50&&!/^(Loading|Checking)/.test(document.body.innerText.trim()));await page.waitForTimeout(350)}
async function screenshot(name){await page.screenshot({path:resolve(evidence,name+'.png')})}
async function login(path,email){await go(path);await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill('Synthetic-QA-only-2026!');await page.locator('form').evaluate(form=>form.requestSubmit());}
async function layout(app,name){const data=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,margin:getComputedStyle(document.body).margin,font:getComputedStyle(document.body).fontFamily,broken:[...document.images].filter(i=>i.complete&&i.naturalWidth===0&&i.getBoundingClientRect().width>0).map(i=>new URL(i.src).pathname),h1:document.querySelector('h1')?.innerText}));assert.ok(data.scroll<=data.width+1,JSON.stringify(data));assert.equal(data.margin,'0px');assert.match(data.font,/Poppins/i);assert.deepEqual(data.broken,[]);checks.push({app,name:name+' metrics',status:'PASS',metrics:data})}
try {
  for(const width of [1440,390]){
    await page.setViewportSize({width,height:width===390?844:1000});
    for(const path of ['/','/properties','/properties/prime-enclave-maragondon','/about-us','/blog','/contact-us','/book-tripping','/no-such-qa-page'])await check('WEBSITE',`${width}px ${path}`,async()=>{await go(path);assert.ok(await page.locator('header').count());assert.ok(await page.locator('main').count());if(path==='/no-such-qa-page')assert.match(await page.innerText('body'),/404|not found/i);await layout('WEBSITE',`${width}px ${path}`);if(path==='/')await screenshot(`website-${width}`)});
    if(width===390)await check('WEBSITE','mobile navigation Escape and keyboard focus',async()=>{await go('/');await page.getByRole('button',{name:'Open navigation'}).click();await page.getByRole('button',{name:'Close navigation'}).waitFor();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Open navigation'}).waitFor();await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>document.activeElement!==document.body))});
    for(const [app,path] of [['SYSTEM','/system/portal'],['HR','/hr/login'],['FINANCE','/finance/']])await check(app,`${width}px unauthenticated login and layout`,async()=>{await context.clearCookies();await go(path);await page.locator('input[type=email]').waitFor();await layout(app,`${width}px login`);await screenshot(`${app.toLowerCase()}-login-${width}`)});
  }
  await page.setViewportSize({width:1440,height:1000});
  await check('FINANCE','real browser login, dashboard and refresh persistence',async()=>{await login('/finance/','admin@qa.invalid');await page.getByText('Financial summary',{exact:true}).waitFor();assert.match(await page.locator('.tile strong').first().innerText(),/₱/);await screenshot('finance-dashboard');await go('/finance/');await page.getByText('Financial summary',{exact:true}).waitFor()});
  await check('FINANCE','audit/import/reconciliation tabs execute successfully',async()=>{for(const text of ['Audit log','Finance imports','Reconciliation']){await page.getByRole('button',{name:text,exact:true}).click();await page.waitForTimeout(450);assert.doesNotMatch(await page.innerText('body'),/SERVER_ERROR|Finance request failed/)}});
  await check('FINANCE','390px authenticated dashboard has no horizontal overflow',async()=>{await page.setViewportSize({width:390,height:844});await go('/finance/');await page.getByText('Financial summary',{exact:true}).waitFor();await layout('FINANCE','390px authenticated');await screenshot('finance-dashboard-mobile')});
  await page.setViewportSize({width:1440,height:1000});
  await check('HR','real browser login, employee page and nested refresh',async()=>{await login('/hr/login','hr@qa.invalid');await page.waitForURL('**/hr/employees');await go('/hr/employees');await page.getByRole('navigation',{name:'HR navigation'}).waitFor();await layout('HR','1440px employees');await screenshot('hr-employees')});
  await check('SYSTEM','real browser login and nested refresh',async()=>{await login('/system/portal','system@qa.invalid');await page.waitForURL(url=>!url.pathname.endsWith('/portal'));await page.locator('nav').first().waitFor();const path=new URL(page.url()).pathname;await go(path);assert.ok(!path.endsWith('/portal'));await layout('SYSTEM','1440px authenticated');await screenshot('system-dashboard')});
  await check('ALL','all three browser sessions persist independently',async()=>{const values=await page.evaluate(()=>Promise.all(['/api/v1/user/me','/hr-api/api/v1/auth/me','/finance-api/api/v1/auth/me'].map(async p=>(await fetch(p)).status)));assert.deepEqual(values,[200,200,200])});
  await check('ALL','no uncaught browser exceptions or local 500/asset errors',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(requests.filter(r=>r.status>=500||r.status===404),[])});
}catch(e){checks.push({app:'ALL',name:'browser harness',status:'FAIL',reason:e.message});console.error(e.message)}
finally{writeFileSync(resolve(evidence,'browser-results.json'),JSON.stringify({checks,errors,requests},null,2));console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length}));await browser.close()}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
