// Production bundles + actual Pages handlers + real isolated QA APIs.
// Run serve-local.mjs first. Never supplies credentials to a remote origin.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));
const phase=process.argv.includes('--baseline')?'baseline':'final';
const out=resolve(root,'QA_REPORTS/evidence/ui-2026-11-03');mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4179';
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({reducedMotion:'reduce'}),page=await context.newPage();
page.setDefaultTimeout(8000);
const checks=[],exceptions=[],responses=[];
page.on('pageerror',e=>exceptions.push({url:page.url(),message:e.message}));
page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=400)responses.push({url:new URL(r.url()).pathname,status:r.status()})});
const slug=s=>s.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'');
async function shot(name){await page.screenshot({path:resolve(out,`${phase}-${slug(name)}.png`),fullPage:true});}
async function check(area,name,fn){try{const metrics=await fn();checks.push({area,name,status:'PASS',...(metrics?{metrics}:{})});console.log('PASS',area,name);}catch(e){checks.push({area,name,status:'FAIL',reason:e.message});console.log('FAIL',area,name,e.message);await shot(`${area}-${name}-failure`);}}
async function go(path){await page.goto(base+path);await page.waitForFunction(()=>document.body.innerText.trim().length>30&&!/^(Loading|Checking)/.test(document.body.innerText.trim()));await page.waitForTimeout(120);}
async function metrics(){return page.evaluate(()=>{
  const rect=e=>e.getBoundingClientRect();
  const visible=e=>{const r=rect(e),s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
  return {width:innerWidth,scroll:document.documentElement.scrollWidth,font:getComputedStyle(document.body).fontFamily,
    poppins:[...document.fonts].filter(f=>f.family.includes('Poppins')).map(f=>f.status),
    broken:[...document.images].filter(i=>visible(i)&&i.complete&&!i.naturalWidth).map(i=>new URL(i.src).pathname),
    wide:[...document.querySelectorAll('main button,main input,main select,main textarea,main h1,main h2')].filter(e=>visible(e)&&rect(e).right>innerWidth+1&&!e.closest('.table-wrap,[class*=overflow-auto],[class*=overflow-x-auto]')).slice(0,8).map(e=>({tag:e.tagName,text:e.textContent.slice(0,60),right:rect(e).right})),
    h1:document.querySelector('h1')?.textContent};
});}
async function layout(){const m=await metrics();assert.ok(m.scroll<=m.width+1,JSON.stringify(m));assert.match(m.font,/Poppins/);assert.deepEqual(m.broken,[],'Broken images');assert.deepEqual(m.wide,[],'Controls or headings outside viewport');return m;}
async function login(path,email){await go(path);await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill('Synthetic-QA-only-2026!');await page.locator('form').evaluate(f=>f.requestSubmit());}
const website=['/','/about-us','/properties','/properties/prime-enclave-maragondon','/properties/luntiang-aguinaldo-bailen','/properties/not-a-project','/blog',
  '/blog/what-to-check-before-buying-a-lot-in-cavite','/blog/bailen-or-maragondon-property-guide','/blog/how-to-prepare-for-a-property-tripping-in-cavite','/blog/not-an-article',
  '/faqs','/site-coordinator','/sellers','/contact-us','/opportunities','/book-tripping','/saved-projects','/visit-checklist','/payment-estimator','/privacy-policy','/terms-of-use','/disclaimer','/invalid-page-example'];
try{
  for(const width of [390,768,1440,1920]){
    await page.setViewportSize({width,height:width===390?844:1000});
    for(const path of website)await check('WEBSITE',`${width} ${path}`,async()=>{await go(path);assert.equal(await page.locator('.website-shell').count(),1);const m=await layout();if(['/','/invalid-page-example','/faqs','/visit-checklist','/saved-projects'].includes(path))await shot(`${width}-${path==='/'?'home':path}`);return m;});
    await check('Responsive layouts',`${width} 404 mark and return home`,async()=>{await go('/invalid-page-example');const r=await page.locator('.dc-not-found-mark').boundingBox();assert.equal(r.width,80);assert.equal(r.height,80);await page.getByRole('link',{name:'Return home',exact:true}).click();await page.waitForURL(base+'/');});
    await check('Responsive layouts',`${width} FAQ spacing and expansion`,async()=>{await go('/faqs');const cards=page.locator('[class~="space-y-2.5"] > *');const gap=await cards.evaluateAll(c=>c[1].getBoundingClientRect().top-c[0].getBoundingClientRect().bottom);assert.ok(gap>=9,`FAQ gap is ${gap}px, expected 10px`);const button=cards.nth(1).getByRole('button');await button.click();await page.waitForFunction(()=>document.querySelector('#faq-2 button')?.getAttribute('aria-expanded')==='true');await button.click();await page.waitForFunction(()=>document.querySelector('#faq-2 button')?.getAttribute('aria-expanded')==='false');});
    for(const [app,path] of [['SYSTEM','/system/portal'],['HR','/hr/login'],['FINANCE','/finance']])await check(app,`${width} login`,async()=>{await context.clearCookies();await go(path);await page.locator('input[type=email]').waitFor();const m=await layout();await shot(`${app}-login-${width}`);return m;});
  }
  await page.setViewportSize({width:390,height:844});
  await check('WEBSITE','mobile navigation, Escape, link selection',async()=>{await go('/');await page.getByRole('button',{name:'Open navigation'}).click();await page.locator('#dc-primary-nav').getByRole('link',{name:'Projects',exact:true}).click();await page.waitForURL('**/properties');await page.getByRole('button',{name:'Open navigation'}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Open navigation'}).waitFor();});
  await check('WEBSITE','saved project card, persistence and clear state',async()=>{await go('/saved-projects');await page.evaluate(()=>localStorage.setItem('dc_prime_saved_projects',JSON.stringify(['prime-enclave-maragondon','luntiang-aguinaldo-bailen'])));await page.reload();await page.getByRole('button',{name:'Clear saved projects'}).waitFor();await layout();await shot('saved-populated-390');await page.getByRole('button',{name:'Clear saved projects'}).click();await page.getByRole('heading',{name:'No saved projects yet'}).waitFor();await page.reload();await page.getByRole('heading',{name:'No saved projects yet'}).waitFor();});
  await check('WEBSITE','booking validation and project preselection',async()=>{await go('/book-tripping?project=luntiang-aguinaldo-bailen');assert.equal(await page.getByLabel('Preferred project').inputValue(),'luntiang-aguinaldo-bailen');await page.getByRole('button',{name:'Prepare visit request'}).click();assert.equal(await page.locator('form').evaluate(f=>f.checkValidity()),false);assert.equal(await page.locator('form :invalid').count()>0,true);await layout();});
  await check('WEBSITE','checklist download',async()=>{await go('/visit-checklist');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download',exact:true}).click();assert.equal((await download).suggestedFilename(),'dc-prime-property-visit-checklist.txt');});
  await check('WEBSITE','FAQ appearance, dynamic rotation and utility states',async()=>{
    await go('/faqs');const button=page.locator('#faq-1 button');await button.scrollIntoViewIfNeeded();
    const style=await button.evaluate(e=>({background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e).borderWidth,rotation:getComputedStyle(e.querySelector('svg')).rotate}));
    assert.equal(style.background,'rgba(0, 0, 0, 0)');assert.equal(style.border,'0px');assert.equal(style.rotation,'180deg');
    await shot('faq-controls');
    // A DOM probe exercises the same generated selectors without mocking an API.
    await page.evaluate(()=>{const e=document.createElement('button');e.id='qa-utility-probe';e.className='bg-white hover:bg-[#f8f6f0] disabled:cursor-not-allowed';e.textContent='Interaction utility probe';document.querySelector('main').prepend(e);});
    const probe=page.locator('#qa-utility-probe');await probe.hover();await page.waitForTimeout(180);assert.equal(await probe.evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(248, 246, 240)');await probe.evaluate(e=>e.disabled=true);assert.equal(await probe.evaluate(e=>getComputedStyle(e).cursor),'not-allowed');await probe.evaluate(e=>e.remove());
  });
  for(const path of ['/','/portal','/system','/system/portal','/hr','/hr/login','/finance','/invalid-page-example','/system/portal/super_admin/users','/hr/employees','/finance/nested-page'])await check('Cloudflare routing',`direct + refresh ${path}`,async()=>{
    await context.clearCookies();await go(path);const url=page.url();await page.reload();await page.waitForFunction(()=>document.body.innerText.trim().length>30&&!/^(Loading|Checking)/.test(document.body.innerText.trim()));assert.equal(page.url(),url);if(path==='/portal')assert.equal(new URL(url).pathname,'/system/portal');
    if(/^\/(system|hr|finance|portal)(\/|$)/.test(path))assert.equal(await page.locator('.website-shell').count(),0);else assert.equal(await page.locator('.website-shell').count(),1);
  });
  await check('Cloudflare routing','redirect query, nested suffix and history',async()=>{
    for(const [from,to] of [['/portal?from=email','/system/portal?from=email'],['/portal/super_admin/users?page=2','/system/portal/super_admin/users?page=2']]){const r=await fetch(base+from,{redirect:'manual'});assert.equal(r.status,302);assert.equal(r.headers.get('location'),base+to);}
    await go('/');await go('/portal');await page.goBack();assert.equal(new URL(page.url()).pathname,'/');await page.goForward();assert.equal(new URL(page.url()).pathname,'/system/portal');
  });
  for(const [app,path,email,ready] of [['FINANCE','/finance','admin@qa.invalid','Financial summary'],['HR','/hr/login','hr@qa.invalid','HR navigation'],['SYSTEM','/system/portal','system@qa.invalid','']]){
    await check(app,'isolated QA login',async()=>{await login(path,email);if(app==='FINANCE')await page.getByText(ready,{exact:true}).waitFor();else if(app==='HR')await page.getByRole('navigation',{name:ready}).waitFor();else await page.waitForURL(u=>u.pathname!=='/system/portal');});
    const landing=page.url();
    for(const width of [390,768,1440,1920])await check(app,`${width} authenticated pages and controls`,async()=>{
      await page.setViewportSize({width,height:width===390?844:1000});await page.goto(landing);await page.waitForTimeout(550);await layout();await shot(`${app}-authenticated-${width}`);
      if(app==='HR')for(const target of ['/hr/employees','/hr/attendance-records','/hr/payroll']){await go(target);await layout();await shot(`${app}-${width}-${target}`);}
      if(app==='HR'){
        await go('/hr/attendance-records');const trigger=page.getByRole('button',{name:'Export Attendance',exact:true});await trigger.click();
        const dialog=page.getByRole('dialog',{name:'Export Attendance Excel'}),close=page.getByRole('button',{name:'Close export modal'});await dialog.waitFor();
        const r=await close.boundingBox();assert.ok(r.y>=0&&r.y+r.height<=page.viewportSize().height,'Modal close control must be inside viewport');
        assert.equal(await close.evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Shift+Tab');assert.equal(await page.getByRole('button',{name:'Download Excel',exact:true}).evaluate(e=>document.activeElement===e),true);await page.keyboard.press('Tab');assert.equal(await close.evaluate(e=>document.activeElement===e),true);
        await layout();await shot(`${app}-${width}-export-modal`);await page.getByRole('button',{name:'Cancel',exact:true}).scrollIntoViewIfNeeded();await page.getByRole('button',{name:'Cancel',exact:true}).click();
        await trigger.click();await page.keyboard.press('Escape');await dialog.waitFor({state:'detached'});assert.equal(await trigger.evaluate(e=>document.activeElement===e),true);
      }
      if(app==='FINANCE'){
        for(const name of ['Transactions','Categories','Finance imports','Reconciliation','Audit log','Users']){const button=page.getByRole('button',{name,exact:true});if(await button.count()){await button.click();await page.waitForTimeout(220);await layout();await shot(`${app}-${width}-${name}`);}}
        await page.getByRole('button',{name:'New entry',exact:true}).click();await page.getByRole('heading',{name:'New cash transaction'}).waitFor();await layout();await shot(`${app}-${width}-entry`);await page.getByRole('button',{name:'Cancel',exact:true}).click();
      }
      if(app==='SYSTEM'){
        for(const suffix of ['projects','users','reports','documents','accredited','notifications','review-center','audit-logs','settings','company-finances']){await go('/system/portal/super_admin/'+suffix);await layout();await shot(`${app}-${width}-${suffix}`);}
        await go('/system/portal/super_admin/users');await page.getByRole('button',{name:'Create System User'}).click();await page.getByRole('dialog',{name:'Create System User'}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).waitFor();await layout();await shot(`${app}-${width}-create-user-modal`);await page.getByRole('button',{name:'Close create system user'}).click();
      }
    });
  }
  await check('Cloudflare routing','built assets return correct MIME and content',async()=>{for(const app of ['','system/','hr/','finance/']){const html=await (await fetch(base+'/'+app)).text();const assets=[...html.matchAll(/(?:src|href)="([^" ]+\.(?:js|css))"/g)].map(m=>m[1]);assert.ok(assets.length>=2);for(const asset of assets){const r=await fetch(base+asset);assert.equal(r.status,200,asset);assert.match(r.headers.get('content-type'),/javascript|css/);}}});
  await check('Responsive layouts','no uncaught browser exceptions',async()=>assert.deepEqual(exceptions,[]));
  await check('Cloudflare routing','no missing assets or unexpected server errors',async()=>assert.deepEqual(responses.filter(r=>r.status===404||(r.status>=500&&r.url!=='/api/v1/system-settings')),[]));
}finally{
  writeFileSync(resolve(out,`${phase}-results.json`),JSON.stringify({phase,browser:browser.version(),checks,exceptions,responses},null,2));
  console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length}));await browser.close();
}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
