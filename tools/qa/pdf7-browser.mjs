// Production bundles and real local APIs; run pdf7-pagination.e2e.test.mjs first.
import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf7/fixtures.json','utf8'));
const base='http://127.0.0.1:4179',out=resolve('QA_REPORTS/evidence/pdf7');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const headers={origin:base,'x-requested-with':'dcprime-finance'};
for(const [path,email] of [['/finance-api/api/v1/auth/login','admin@qa.invalid'],['/hr-api/api/v1/auth/login','hr@qa.invalid']]){
 const response=await context.request.post(base+path,{headers,data:{email,password:'Synthetic-QA-only-2026!'}});assert.equal(response.status(),200,await response.text());
}
const page=await context.newPage(),checks=[],errors=[],serverErrors=[];page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(response.url().startsWith(base)&&response.status()>=500)serverErrors.push({path:new URL(response.url()).pathname,status:response.status()});});
const nav=name=>page.getByRole('navigation',{name,exact:true});
const financeTab=name=>page.getByRole('navigation',{name:'Finance navigation'}).getByRole('button',{name,exact:true});
async function check(name,action){try{await action();checks.push({name,status:'PASS'});}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{});}console.log(JSON.stringify(checks.at(-1)));}
async function rows(table,count){await page.waitForFunction(({selector,count})=>document.querySelectorAll(selector).length===count,{selector:table,count});}
async function fits(target=page){const size=await target.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size));}
async function paginationReady(label,text){await nav(label).getByText(text,{exact:true}).waitFor();await page.waitForFunction(label=>![...document.querySelectorAll('nav')].find(node=>node.getAttribute('aria-label')===label)?.querySelector('select')?.disabled,label);}
try{
 await page.goto(base+'/finance');await financeTab('Imports').click();
 await check('Import history shows page controls, reaches additional records and changes page size',async()=>{
  const label='Import history pagination';await nav(label).waitFor();
  await rows('.history-table tbody tr',10);assert.equal(await nav(label).getByRole('button',{name:'Previous',exact:true}).isDisabled(),true);
  const first=await page.locator('.history-table tbody tr').first().innerText();
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await nav(label).getByText(/^Page 2 of /).waitFor();await paginationReady(label,await nav(label).getByText(/^Page 2 of /).innerText());
  assert.notEqual(await page.locator('.history-table tbody tr').first().innerText(),first);
  await nav(label).getByLabel('Rows per page').selectOption('20');await rows('.history-table tbody tr',20);await nav(label).getByText(/^Page 1 of /).waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await fits();assert.ok(await nav(label).evaluate(node=>node.scrollWidth<=node.clientWidth+1));await page.screenshot({path:resolve(out,`imports-${width}.png`),fullPage:true,animations:'disabled'});}
 });
 await check('Finance audit pages and applied filters keep correct counts and reset the current page',async()=>{
  await financeTab('Audit Logs').click();await page.locator('select[name="action"]').selectOption(`qa.pdf7.${fixture.key}`);await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  const label='Finance audit pagination';await paginationReady(label,'Page 1 of 3');await rows('.panel table tbody tr',10);
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 2 of 3');
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 3 of 3');await rows('.panel table tbody tr',3);assert.equal(await nav(label).getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
  await nav(label).getByLabel('Rows per page').selectOption('20');await paginationReady(label,'Page 1 of 2');await rows('.panel table tbody tr',20);
 });
 await check('Finance users paginate all filtered accounts and recover correctly from an empty search',async()=>{
  await financeTab('Users').click();await page.getByLabel('Search accounts').fill(fixture.prefix);
  const label='Finance users pagination';await paginationReady(label,'Page 1 of 3');await rows('.panel table tbody tr',10);
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 2 of 3');await page.getByText(`${fixture.prefix} Account 11`,{exact:true}).waitFor();
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 3 of 3');await rows('.panel table tbody tr',3);
  await page.getByLabel('Search accounts').fill('No matching synthetic account');await paginationReady(label,'Page 1 of 1');await nav(label).getByRole('status').getByText('Showing 0–0 of 0',{exact:true}).waitFor();
  assert.equal(await nav(label).getByRole('button',{name:'Next',exact:true}).isDisabled(),true);
  await page.getByLabel('Search accounts').fill(fixture.prefix);await paginationReady(label,'Page 1 of 3');await nav(label).getByLabel('Rows per page').selectOption('20');await paginationReady(label,'Page 1 of 2');await rows('.panel table tbody tr',20);
  await page.screenshot({path:resolve(out,'users.png'),fullPage:true,animations:'disabled'});
 });
 await check('Deleting the last invitations on a page moves the account list to its last remaining page',async()=>{
  const label='Finance users pagination';await nav(label).getByLabel('Rows per page').selectOption('10');await paginationReady(label,'Page 1 of 3');
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 3 of 3');
  for(const number of [21,22,23]){
   const row=page.getByRole('row').filter({has:page.getByText(`${fixture.prefix} Account ${number}`,{exact:true})});
   await row.getByRole('button',{name:'Delete invitation',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Delete Finance invitation?',exact:true});
   await dialog.getByRole('button',{name:'Delete invitation',exact:true}).click();await row.waitFor({state:'hidden'});
  }
  await paginationReady(label,'Page 2 of 2');await rows('.panel table tbody tr',10);await nav(label).getByRole('status').getByText('Showing 11–20 of 20',{exact:true}).waitFor();
 });
 await check('HR payroll pagination preserves full filtered totals, salary actions and filter resets',async()=>{
  await page.goto(base+'/hr/payroll');await page.locator('input[type="month"]').fill(fixture.month);await page.getByRole('combobox',{name:'Department',exact:true}).selectOption(fixture.prefix);
  const label='Payroll pagination';await paginationReady(label,'Page 1 of 3');await rows('main table tbody tr',10);
  const summary=page.getByText('Total Fund Release',{exact:true}).locator('..');await summary.getByText('₱2,300.23',{exact:true}).waitFor();
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 2 of 3');await page.getByText(`${fixture.prefix} Employee 11`,{exact:true}).waitFor();await summary.getByText('₱2,300.23',{exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'View Salary',exact:true}).count(),10);
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 3 of 3');await rows('main table tbody tr',3);
  await page.getByPlaceholder('Name, code, position...').fill(`${fixture.prefix} Employee 01`);await paginationReady(label,'Page 1 of 1');await rows('main table tbody tr',1);await summary.getByText('₱100.01',{exact:true}).waitFor();
  await page.getByPlaceholder('Name, code, position...').fill('');await paginationReady(label,'Page 1 of 3');await nav(label).getByLabel('Rows per page').selectOption('20');await rows('main table tbody tr',20);await summary.getByText('₱2,300.23',{exact:true}).waitFor();
  await page.screenshot({path:resolve(out,'payroll.png'),fullPage:true,animations:'disabled'});
 });
 await check('HR audit Module and Action dropdowns filter by stored values and reset pagination',async()=>{
  await page.goto(base+'/hr/audit-logs');await page.getByRole('combobox',{name:'Module',exact:true}).selectOption(fixture.prefix);await page.getByRole('button',{name:'Apply filters',exact:true}).click();
  const label='HR audit pagination';await paginationReady(label,'Page 1 of 3');
  await nav(label).getByRole('button',{name:'Next',exact:true}).click();await paginationReady(label,'Page 2 of 3');
  await page.getByRole('combobox',{name:'Action',exact:true}).selectOption('pdf7.special');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await paginationReady(label,'Page 1 of 1');await rows('section table tbody tr',1);
  await page.screenshot({path:resolve(out,'hr-audit-filters.png'),fullPage:true,animations:'disabled'});
 });
 await check('Attendance event action labels fit the narrow side panel at mobile, tablet and desktop widths',async()=>{
  await page.goto(base+'/hr/attendance-records');await page.getByRole('button',{name:new RegExp('^'+Number(fixture.today.slice(-2))+'(?:\\s|$)')}).click();
  const card=page.locator('aside .rounded-2xl').filter({has:page.getByText(fixture.prefix+' Event',{exact:true})}).first();
  const edit=card.getByRole('button',{name:'Edit Whole Event',exact:true}),remove=card.getByRole('button',{name:'Remove Company Event',exact:true});await edit.waitFor();
  for(const width of [390,768,1024,1440]){
   await page.setViewportSize({width,height:1000});await edit.scrollIntoViewIfNeeded();
   for(const button of [edit,remove])assert.ok(await button.evaluate(node=>{const label=node.querySelector('span'),rect=node.getBoundingClientRect(),text=label.getBoundingClientRect(),panel=node.closest('aside').getBoundingClientRect();return node.scrollWidth<=node.clientWidth+1&&text.left>=rect.left&&text.right<=rect.right&&rect.right<=panel.right;}),'Event button text must stay inside the button and side panel');
   await page.screenshot({path:resolve(out,`event-actions-${width}.png`),animations:'disabled'});
  }
 });
 await check('Attendance Excel removes the rules panel and uses saved server settings in the workbook',async()=>{
  const response=await context.request.get(base+'/hr-api/api/v1/attendance/settings');assert.equal(response.status(),200);const original=(await response.json()).data;
  const update=async data=>{const result=await context.request.put(base+'/hr-api/api/v1/attendance/settings',{headers,data});assert.equal(result.status(),200,await result.text());};
  try{
   await update({...original,scheduledTimeIn:'09:30',scheduledTimeOut:'18:30',lateAfter:'09:30',redHighlightAfter:'09:45',breakStart:'12:00',breakMinutes:60,regularWorkingMinutes:480});
   await page.getByRole('button',{name:'Export Attendance',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Export Attendance Excel',exact:true});await dialog.waitFor();
   assert.equal(await dialog.getByText('Excel rules',{exact:true}).count(),0);assert.equal(await dialog.locator('input[type="time"]').count(),0);
   const dataPromise=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/attendance/export-data')),downloadPromise=page.waitForEvent('download');
   await dialog.getByRole('button',{name:'Download Excel',exact:true}).click();const data=await(await dataPromise).json();assert.equal(data.data.schedule.scheduledTimeIn.slice(0,5),'09:30');assert.equal(data.data.schedule.scheduledTimeOut.slice(0,5),'18:30');
   const file=await downloadPromise,path=resolve(out,'attendance.xlsx');await file.saveAs(path);
   const require=createRequire(new URL('../../CLIENT/HR/package.json',import.meta.url)),XLSX=require('xlsx-js-style');const workbook=XLSX.read(readFileSync(path),{type:'buffer'});
   const cells=workbook.SheetNames.flatMap(name=>Object.entries(workbook.Sheets[name]));
   assert.ok(cells.some(([key,cell])=>/^L\d+$/.test(key)&&typeof cell.v==='number'&&Math.abs(cell.v-9.5/24)<1e-8),'Workbook scheduled time in must use the saved 09:30 schedule');
   assert.ok(cells.some(([key,cell])=>/^G\d+$/.test(key)&&typeof cell.v==='number'&&Math.abs(cell.v-18.5/24)<1e-8),'Workbook scheduled time out must use the saved 18:30 schedule');
   await page.screenshot({path:resolve(out,'attendance-export.png'),animations:'disabled'});await dialog.getByRole('button',{name:'Cancel',exact:true}).click();
  }finally{await update(original);}
 });
 await check('Anonymous buyer links survive the old URL, direct reload and expiry checks',async()=>{
  const guest=await browser.newContext({viewport:{width:390,height:844}});await guest.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  try{
   const screen=await guest.newPage();screen.on('pageerror',error=>errors.push(error.message));
   await screen.goto(base+'/buyer-form/'+fixture.buyer+'?source=shared');await screen.getByText(`${fixture.prefix} Project`,{exact:true}).waitFor();assert.equal(new URL(screen.url()).pathname,'/system/buyer-form/'+fixture.buyer);assert.equal(new URL(screen.url()).search,'?source=shared');
   await screen.getByRole('button',{name:'Proceed to Final Review',exact:true}).waitFor();await screen.reload();await screen.getByText(`${fixture.prefix} Project`,{exact:true}).waitFor();await fits(screen);await screen.screenshot({path:resolve(out,'buyer-form-mobile.png'),fullPage:true,animations:'disabled'});
   await screen.goto(base+'/buyer-form/'+fixture.expired);await screen.getByText('This buyer form link has expired.',{exact:true}).waitFor();assert.equal(await screen.getByRole('button',{name:'Proceed to Final Review',exact:true}).count(),0);
   assert.equal(await screen.getByRole('heading',{name:'Page not found',exact:true}).count(),0);
  }finally{await guest.close();}
 });
 await check('All scenarios have no uncaught browser exceptions or server errors',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(serverErrors,[]);});
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors,serverErrors},null,2));await browser.close();}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
