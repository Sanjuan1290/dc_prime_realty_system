// Actual production bundles and local APIs. Only the guarded QA database is used.
import {chromium} from 'playwright-core';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../SERVER/SYSTEM/package.json',import.meta.url));
const db=require('mysql2/promise').createPool({host:'127.0.0.1',port:13307,user:'qa_system',password:'qa-isolated-only-password',database:'dc_prime_realty_system_db'});
const [[state]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(state.port,13307);
assert.equal(state.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
await db.execute("INSERT IGNORE INTO lot_projects(lot_project_name,lot_project_slug,lot_project_location,lot_project_location_code) VALUES('PDF 6 QA Project','qa-pdf6','Synthetic QA location','QA6')");
await db.end();
const base='http://127.0.0.1:4179',out=resolve('QA_REPORTS/evidence/pdf6');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),checks=[],errors=[],failures=[];
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const password='Synthetic-QA-only-2026!';
async function signIn(target,path,email){const response=await target.request.post(base+path,{headers:{origin:base,'x-requested-with':'dcprime-finance'},data:{email,password}});assert.equal(response.status(),200,await response.text());}
await signIn(context,'/api/v1/user/login','system@qa.invalid');
await signIn(context,'/hr-api/api/v1/auth/login','hr@qa.invalid');
await signIn(context,'/finance-api/api/v1/auth/login','admin@qa.invalid');
const page=await context.newPage();page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));
page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=500)failures.push({path:new URL(response.url()).pathname,status:response.status()});});
async function check(name,action){try{await action();checks.push({name,status:'PASS'});}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{});}console.log(JSON.stringify(checks.at(-1)));}
async function go(path){await page.goto(base+path);await page.locator('h1').first().waitFor();await page.waitForLoadState('networkidle');assert.doesNotMatch(await page.innerText('body'),/Unable to load this page|Unexpected Application Error|You do not have permission/);assert.equal(await page.getByRole('button',{name:/^Refresh(?:\s|$)/i}).count(),0);}
async function fits(target=page){const size=await target.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size));}
const financeNav=name=>page.getByRole('navigation',{name:'Finance navigation'}).getByRole('button',{name,exact:true});
try{
 await check('Finance dashboard is a compact summary with working role-appropriate shortcuts',async()=>{
  await go('/finance');await page.locator('.finance-dashboard-summary').waitFor();
  assert.equal(await page.locator('.finance-dashboard-summary .finance-metric').count(),3);assert.equal(await page.locator('.finance-plot').count(),0);
  assert.equal(await page.getByText('After payroll corrections',{exact:true}).count(),0);
  for(const name of ['Transactions','Reports','Imports','Audit Logs']){
   await page.getByRole('region',{name:'Finance quick navigation'}).getByRole('button',{name:new RegExp('^'+name)}).click();
   await page.getByRole('heading',{name:name==='Imports'?'Imports':name,exact:true}).first().waitFor();
   await financeNav('Dashboard').click();await page.locator('.finance-dashboard-summary').waitFor();
  }
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await fits();await page.screenshot({path:resolve(out,`dashboard-${width}.png`),fullPage:true,animations:'disabled'});}
 });
 await check('Dashboard empty-month and negative-balance alerts use the loaded summary',async()=>{
  const pattern='**/finance-api/api/v1/finance/reports?*';
  for(const negative of [false,true]){
   await page.route(pattern,async route=>{const response=await route.fetch(),data=await response.json();await route.fulfill({response,json:{...data,period_count:negative?1:0,closing_balance:negative?'-100.01':'0.00',actual_money_in:'0.00',actual_money_out:negative?'100.01':'0.00'}});});
   await page.reload();await page.getByText(negative?'Balance needs attention':'No transactions this month',{exact:true}).waitFor();
   await page.screenshot({path:resolve(out,negative?'negative-balance.png':'empty-month.png'),fullPage:true,animations:'disabled'});await page.unroute(pattern);
  }
 });
 await check('All Finance tabs have no header Refresh and Reports keeps its detailed charts',async()=>{
  await page.reload();await page.locator('.finance-dashboard-summary').waitFor();
  for(const name of ['Transactions','Reports','Categories','Audit Logs','Users','Imports']){
   await financeNav(name).click();await page.getByRole('heading',{name,exact:true}).first().waitFor();await page.waitForLoadState('networkidle');
   assert.equal(await page.getByRole('button',{name:/^Refresh(?:\s|$)/i}).count(),0);assert.equal(await page.getByText('After payroll corrections',{exact:true}).count(),0);
  }
 });
 await check('Viewer and accountant shortcuts do not expose administrator actions',async()=>{
  for(const role of ['viewer','accountant']){
   const limited=await browser.newContext({viewport:{width:390,height:844}});
   try{
    await limited.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
    await signIn(limited,'/finance-api/api/v1/auth/login',`${role}@qa.invalid`);
    const screen=await limited.newPage();await screen.goto(base+'/finance');const shortcuts=screen.getByRole('region',{name:'Finance quick navigation'});await shortcuts.waitFor();
    assert.equal(await shortcuts.getByRole('button').count(),2);assert.equal(await shortcuts.getByRole('button',{name:/Imports|Audit Logs/}).count(),0);await fits(screen);
   }finally{await limited.close();}
  }
 });
 await check('Main Realty pages load without Refresh controls or salary-paid summaries',async()=>{
  await page.setViewportSize({width:1440,height:1000});
  const root='/system/portal/super_admin';
  for(const child of ['','/reports','/company-finances','/projects','/lot-projects','/accredited','/accredited/groups/in-house','/accredited/groups/external','/users','/notifications','/review-center','/audit-logs','/settings']){
   await go(root+child);
   if(child==='/reports'||child==='/company-finances')assert.equal(await page.getByText(/Salary Paid/).count(),0);
   if(child==='/reports'){
    const table=page.locator('section').filter({has:page.getByRole('heading',{name:'Seller Performance Details',exact:true})}).last();
    assert.equal(await table.getByRole('columnheader',{name:'Breakdown',exact:true}).count(),0);
    assert.equal(await table.getByRole('columnheader').count(),10);await page.screenshot({path:resolve(out,'system-reports.png'),fullPage:true,animations:'disabled'});
   }
  }
 });
 await check('Lot Project pages retain inventory and seller reports without the duplicate chart or moved notice',async()=>{
  const root='/system/portal/lot-projects/qa-pdf6';
  for(const child of ['','/reports','/listings','/payments-audit','/commissions','/settings']){
   await go(root+child);assert.equal(await page.getByText('Financial analytics moved to Reports',{exact:true}).count(),0);
   if(child==='/reports'){
    await page.getByRole('heading',{name:'Inventory Value Comparison',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Unit Status Mix',exact:true}).count(),0);
    assert.equal(await page.getByRole('columnheader',{name:'Breakdown',exact:true}).count(),0);
    for(const name of ['Company / Network','Sellers'])await page.getByRole('button',{name,exact:true}).click();
    await page.getByLabel('Search performance',{exact:true}).fill('no matching synthetic seller');
    await page.getByText('No accredited sellers or Networks match the current filters.',{exact:true}).waitFor();
    await page.screenshot({path:resolve(out,'lot-reports.png'),fullPage:true,animations:'disabled'});
   }
  }
 });
 await check('HR employee, attendance, payroll and audit pages load without header Refresh',async()=>{
  for(const path of ['/hr/employees','/hr/attendance-records','/hr/payroll','/hr/audit-logs'])await go(path);
 });
 await check('Browsers have no uncaught errors or new server failures',async()=>{
  assert.deepEqual(errors,[]);
  // The unchanged Settings endpoint uses TiDB ADD COLUMN IF NOT EXISTS DDL.
  // MySQL 8 rejects that syntax; the Settings error-state header is still checked.
  assert.deepEqual(failures.filter(failure=>failure.path!=='/api/v1/system-settings'),[]);
 });
}finally{
 writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors,failures,limitations:failures.filter(failure=>failure.path==='/api/v1/system-settings').map(failure=>({...failure,reason:'Existing TiDB-only ADD COLUMN IF NOT EXISTS syntax is unsupported by the local MySQL 8 test server; Settings header checked in its error state.'}))},null,2));await browser.close();
}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
