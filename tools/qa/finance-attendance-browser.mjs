// Real local production bundles and QA APIs. Never sends credentials to a remote host.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(root,'QA_REPORTS/evidence/finance-attendance');mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4179';
const runId=Date.now();const originalDescription=`QA browser cash expense ${runId}`,correctedDescription=`QA browser corrected expense ${runId}`;
const checks=[],errors=[],failedRequests=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();page.setDefaultTimeout(8000);
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.url().startsWith(base)&&r.status()>=500)failedRequests.push({path:new URL(r.url()).pathname,status:r.status()})});
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'})}catch(e){checks.push({name,status:'FAIL',reason:e.message});await page.screenshot({path:resolve(out,`failure-${checks.length}.png`)}).catch(()=>{})}console.log(checks.at(-1).status,name,checks.at(-1).reason||'')}
async function login(path,email){await page.goto(base+path);await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill('Synthetic-QA-only-2026!');await page.locator('form').evaluate(f=>f.requestSubmit())}
async function api(path){return page.evaluate(async p=>{const r=await fetch(p);if(!r.ok)throw new Error('API status '+r.status);return r.json()},path)}
async function layout(name){const metrics=await page.evaluate(()=>({viewport:innerWidth,width:document.documentElement.scrollWidth}));assert.ok(metrics.width<=metrics.viewport+1,JSON.stringify(metrics));await page.screenshot({path:resolve(out,name+'.png'),fullPage:true})}
let financeBefore;
try{
  await check('Finance: sign in and load totals from the real ledger',async()=>{await login('/finance','admin@qa.invalid');await page.getByText('Financial summary',{exact:true}).waitFor();financeBefore=await api('/finance-api/api/v1/finance/dashboard?from=2026-10-01&to=2026-10-31');await page.getByLabel('From',{exact:true}).fill('2026-10-01');await page.getByLabel('To',{exact:true}).fill('2026-10-31');await page.waitForFunction(()=>!document.querySelector('.notice[role=alert]'));await layout('finance-desktop')});
  await check('Finance: post an exact-cent cash expense through the form',async()=>{
    await page.getByRole('button',{name:'New entry',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Finance entry'});
    await dialog.getByRole('combobox',{name:/^Type/}).selectOption('expense');await dialog.getByLabel('Transaction date').fill('2026-10-24');await dialog.getByLabel('Amount (PHP)').fill('12.34');
    const category=await dialog.getByRole('combobox',{name:/^Category/}).locator('option').nth(1).getAttribute('value');await dialog.getByRole('combobox',{name:/^Category/}).selectOption(category);
    await dialog.getByLabel('Description',{exact:true}).fill(originalDescription);await dialog.getByRole('button',{name:'Post transaction',exact:true}).click();await dialog.waitFor({state:'hidden'});
    const after=await api('/finance-api/api/v1/finance/dashboard?from=2026-10-01&to=2026-10-31');assert.equal(Math.round(Number(after.money_out)*100),Math.round(Number(financeBefore.money_out)*100)+1234);
    await page.reload();await page.getByText('Financial summary',{exact:true}).waitFor();await page.getByLabel('From',{exact:true}).fill('2026-10-01');await page.getByLabel('To',{exact:true}).fill('2026-10-31');await page.getByRole('button',{name:'Transactions',exact:true}).click();await page.getByRole('row').filter({hasText:originalDescription}).waitFor();
  });
  await check('Finance: correct a posted entry while retaining original history',async()=>{
    await page.getByRole('row').filter({hasText:originalDescription}).getByRole('button',{name:'Correct',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Finance entry'});
    await dialog.getByLabel('Amount (PHP)').fill('15.55');await dialog.getByLabel('Description',{exact:true}).fill(correctedDescription);await dialog.getByLabel('Reason for correction').fill('QA browser correction verification');await dialog.getByRole('button',{name:'Void and replace',exact:true}).click();await dialog.waitFor({state:'hidden'});
    await page.getByRole('row').filter({hasText:correctedDescription}).waitFor();
    const after=await api('/finance-api/api/v1/finance/dashboard?from=2026-10-01&to=2026-10-31');assert.equal(Math.round(Number(after.money_out)*100),Math.round(Number(financeBefore.money_out)*100)+1555);
  });
  await check('Finance: void the replacement and reconcile dashboard totals',async()=>{
    await page.getByRole('row').filter({hasText:correctedDescription}).getByRole('button',{name:'Void',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Void transaction'});await dialog.getByLabel('Reason',{exact:true}).fill('QA browser void verification');await dialog.getByRole('button',{name:'Confirm void',exact:true}).click();await dialog.waitFor({state:'hidden'});
    const after=await api('/finance-api/api/v1/finance/dashboard?from=2026-10-01&to=2026-10-31');assert.deepEqual(after,financeBefore);
    await page.getByLabel('From',{exact:true}).fill('2026-10-01');await page.getByLabel('To',{exact:true}).fill('2026-10-31');await page.getByRole('combobox',{name:/^Status/}).selectOption('void');await page.getByRole('row').filter({hasText:originalDescription}).waitFor();await page.getByRole('row').filter({hasText:correctedDescription}).waitFor();
  });
  await check('Finance: audit history and reports display real results',async()=>{
    await page.getByRole('button',{name:'Audit Logs',exact:true}).click();await page.getByRole('cell',{name:'Transaction corrected',exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Reports',exact:true}).click();await page.getByRole('region',{name:'Finance report results'}).waitFor();assert.ok(await page.getByRole('button',{name:'Export PDF',exact:true}).isEnabled());await layout('finance-reports');
  });
  await check('Finance: viewer has no entry, user-management or admin tabs',async()=>{
    await page.getByRole('button',{name:'Sign out',exact:true}).click();await login('/finance','viewer@qa.invalid');await page.getByText('Financial summary',{exact:true}).waitFor();
    for(const name of ['New entry','Users','Audit Logs','Imports'])assert.equal(await page.getByRole('button',{name,exact:true}).count(),0);
    await page.setViewportSize({width:390,height:844});await layout('finance-viewer-mobile');
  });
  await check('Attendance: real login, live editing controls and page data load',async()=>{
    await page.setViewportSize({width:1440,height:1000});await login('/hr/login','hr@qa.invalid');await page.waitForURL('**/hr/employees');await page.goto(base+'/hr/attendance-records');await page.getByRole('heading',{name:'Attendance',exact:true}).waitFor();assert.equal(await page.getByText('HR is temporarily read-only.',{exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Manual Attendance',exact:true}).count(),1);await layout('attendance-desktop');
  });
  await check('Attendance: calendar date, employee search and corrected times agree',async()=>{
    const now=new Date();const month=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',month:'numeric'}).format(now));const year=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric'}).format(now));
    const shift=(year-2026)*12+month-10;assert.ok(Math.abs(shift)<24);
    for(let i=0;i<Math.abs(shift);i++)await page.getByRole('button',{name:shift>0?'Previous month':'Next month',exact:true}).click();
    await page.getByRole('button').filter({has:page.locator('span').filter({hasText:/^20$/})}).click();await page.getByPlaceholder('Search employee...').fill('Attendance Synthetic QA');const row=page.getByRole('row').filter({hasText:'Attendance Synthetic QA'});await row.waitFor();assert.match(await row.innerText(),/9:15 AM/);assert.match(await row.innerText(),/7:00 PM/);
    await page.getByPlaceholder('Search employee...').fill('no-such-qa-attendance');await page.getByText('No attendance records for this day',{exact:true}).waitFor();await page.getByPlaceholder('Search employee...').fill('Attendance Synthetic QA');await row.waitFor();
  });
  await check('Attendance: download a valid Excel workbook with employee worksheets',async()=>{
    await page.getByRole('button',{name:'Export Attendance',exact:true}).click();await page.getByRole('heading',{name:'Export Attendance Excel',exact:true}).waitFor();await page.getByLabel('Month',{exact:true}).fill('2026-10');await page.getByLabel('Custom Range',{exact:true}).check();await page.getByLabel('From',{exact:true}).fill('2026-10-01');await page.getByLabel('To',{exact:true}).fill('2026-10-31');
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Download Excel',exact:true}).click();const download=await downloadPromise;const path=resolve(out,'attendance-export.xlsx');await download.saveAs(path);
    const ExcelJS=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url))('exceljs');const workbook=new ExcelJS.Workbook();await workbook.xlsx.readFile(path);assert.ok(workbook.worksheets.length>=2);assert.ok(workbook.worksheets.some(sheet=>sheet.getSheetValues().flat(2).some(value=>String(value).toUpperCase().includes('ATTENDANCE SYNTHETIC QA'))));
    await page.getByRole('button',{name:'Close export modal',exact:true}).click();
  });
  await check('Attendance: 390px page stays inside the mobile viewport',async()=>{await page.setViewportSize({width:390,height:844});await layout('attendance-mobile')});
  await check('Attendance: kiosk link reaches the dedicated kiosk route',async()=>{
    const link=page.getByRole('link',{name:'Open Attendance Kiosk',exact:true});assert.equal(await link.getAttribute('href'),'/hr/kiosk');await link.click();await page.getByRole('heading',{name:'Employee Attendance',exact:true}).waitFor();
  });
  await check('Payroll: released payroll appears in its original period',async()=>{
    await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/hr/payroll');await page.getByRole('heading',{name:'Employee Salary',exact:true}).waitFor();await page.getByLabel('Month',{exact:true}).fill('2026-10');await page.getByRole('row').filter({hasText:'Synthetic Employee'}).waitFor();assert.match(await page.getByRole('row').filter({hasText:'Synthetic Employee'}).innerText(),/Released/i);await layout('payroll-desktop');
  });
  await check('Finance and attendance: no uncaught exceptions or server errors',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(failedRequests,[])});
}finally{
  writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors,failedRequests},null,2));await browser.close();console.log(JSON.stringify({checks:checks.length,passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length}));
}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
