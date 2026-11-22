// Run bulk-time-out.e2e.test.mjs first. Uses production bundles and real local APIs.
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/bulk-time-out-fixtures.json','utf8'));
const require=createRequire(new URL('../../SERVER/HR/package.json',import.meta.url)),mysql=require('mysql2/promise');
const db=mysql.createPool({host:'127.0.0.1',port:13307,user:'qa_hr',password:'qa-isolated-only-password',database:'dc_prime_hr_db',dateStrings:true});
const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
const base='http://127.0.0.1:4179',out=resolve('QA_REPORTS/evidence/bulk-time-out');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),checks=[],errors=[],dialogs=[];
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const headers={origin:base};
async function api(path,data,method=data?'post':'get',target=context){const result=await target.request[method](base+'/hr-api/api/v1'+path,{headers,...(data?{data}:{})});assert.equal(result.status(),method==='post'&&['/employees','/attendance/manual'].includes(path)?201:200,await result.text());return (await result.json()).data}
await api('/auth/login',{email:'hr@qa.invalid',password:'Synthetic-QA-only-2026!'});
const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',async dialog=>{dialogs.push(dialog.message());await dialog.dismiss()});
const nav=()=>page;
const bulk=()=>page.getByRole('button',{name:'Bulk Time Out Adjustment',exact:true});
const modal=()=>page.getByRole('dialog',{name:'Bulk Time Out Adjustment',exact:true});
const checkbox=index=>page.getByRole('checkbox',{name:'Select '+fixture.employees[index].name,exact:true});
async function ready(){await page.waitForFunction(()=>![...document.querySelectorAll('input[aria-label^="Select "]')].find(node=>node.getAttribute('aria-label').startsWith('Select all'))?.disabled)}
async function open(){await page.goto(base+'/hr/attendance-records');await page.getByLabel('Date',{exact:true}).fill(fixture.date);await page.getByPlaceholder('Search employee...').fill(fixture.prefix);await page.locator('select:has(option[value="25"])').selectOption('50');await checkbox(0).waitFor();await ready()}
async function review(){await modal().getByLabel('New Time Out for all selected').fill('19:00');await modal().getByLabel('Adjustment reason').fill('Authorized overtime - browser verification');await modal().getByRole('button',{name:'Preview adjustment',exact:true}).click();await modal().getByRole('region',{name:'Bulk adjustment preview'}).waitFor()}
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,`failure-${checks.length}.png`),fullPage:true}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
const original=await api('/attendance/settings');
try{
 await api('/attendance/settings',{...original,scheduledTimeIn:'09:00',scheduledTimeOut:'18:00',automaticTimeOut:'18:00',breakStart:'12:00',breakMinutes:60,regularWorkingMinutes:480},'put');
 for(const employee of fixture.employees.slice(0,3))await db.execute("UPDATE employee_attendance_records SET actual_time_out='18:00:00',time_out_source='automatic' WHERE employee_attendance_id=?",[employee.attendance_id]);
 for(let i=7;i<=31;i++){
  const name=String(i).padStart(2,'0');const [[existing]]=await db.execute('SELECT employee_id FROM employees WHERE first_name=? AND last_name=?',[fixture.prefix,name]);
  if(existing)continue;
  const employee=await api('/employees',{first_name:fixture.prefix,last_name:name,department:'Administration',position:'QA Clerk',hire_date:'2026-11-01',monthly_basic_salary:15000,rest_days:['monday']});
  await api('/attendance/manual',{employee_id:employee.employee_id,attendance_date:fixture.date,actual_time_in:'09:00',actual_time_out:'18:00',reason:'Synthetic bulk browser pagination fixture'});
 }
 await check('Selection persists across pages; missing Time In is disabled; clear and date changes reset selection',async()=>{
  await open();assert.ok(await bulk().isDisabled());assert.ok(await checkbox(5).isDisabled());
  await page.locator('select:has(option[value="25"])').selectOption('25');await page.getByText(/^Page 1 of 2/).waitFor();await ready();
  const first=page.getByRole('checkbox',{name:new RegExp('^Select '+fixture.prefix)}).first(),firstName=(await first.getAttribute('aria-label')).slice(7);await first.check();
  await nav().getByRole('button',{name:'Next',exact:true}).click();await nav().getByText(/^Page 2 of 2/).waitFor();await ready();
  await checkbox(0).check();await page.getByText(/^2 selected across pages/).waitFor();
  await bulk().click();await modal().getByText(fixture.employees[0].name,{exact:false}).waitFor();await modal().getByText(firstName,{exact:false}).waitFor();await modal().getByRole('button',{name:'Cancel',exact:true}).click();
  await page.getByRole('button',{name:'Clear selection',exact:true}).click();assert.ok(await bulk().isDisabled());
  await nav().getByRole('button',{name:'Prev',exact:true}).click();await page.getByRole('checkbox',{name:'Select '+firstName,exact:true}).check();
  await page.getByLabel('Date',{exact:true}).fill('2026-11-21');await page.getByText(/^0 selected across pages/).waitFor();assert.ok(await bulk().isDisabled());
 });
 await check('Required reason, preview, editing review inputs and cancel do not save any attendance',async()=>{
  await open();for(let i=0;i<3;i++)await checkbox(i).check();await bulk().click();assert.equal(await modal().getByRole('button',{name:'Confirm and save',exact:true}).count(),0);
  await modal().getByLabel('New Time Out for all selected').fill('19:00');await modal().getByRole('button',{name:'Preview adjustment',exact:true}).click();assert.equal(await modal().getByLabel('Adjustment reason').evaluate(node=>node.validity.valueMissing),true);
  await review();assert.equal(await modal().locator('tbody tr').count(),3);assert.equal(await modal().getByText('+1h',{exact:true}).count(),3);assert.equal(await modal().getByText('1h',{exact:true}).count(),3);
  for(const width of [390,768,1440]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,`preview-${width}.png`),fullPage:true,animations:'disabled'})}
  await modal().getByLabel('Adjustment reason').fill('Updated authorized overtime');assert.equal(await modal().getByRole('button',{name:'Confirm and save',exact:true}).count(),0);
  await modal().getByRole('button',{name:'Cancel',exact:true}).click();
  for(const employee of fixture.employees.slice(0,3)){const [[row]]=await db.execute('SELECT actual_time_out FROM employee_attendance_records WHERE employee_attendance_id=?',[employee.attendance_id]);assert.equal(row.actual_time_out,'18:00:00')}
 });
 await check('Stale preview displays a conflict and requires a new review',async()=>{
  await bulk().click();await review();
  await db.execute('UPDATE employee_attendance_records SET notes=? WHERE employee_attendance_id=?',['Concurrent browser test edit',fixture.employees[0].attendance_id]);
  await modal().getByRole('button',{name:'Confirm and save',exact:true}).click();await modal().getByText(/Attendance or payroll changed after the preview/).waitFor();
  assert.equal(await modal().getByRole('button',{name:'Confirm and save',exact:true}).count(),0);await modal().getByRole('button',{name:'Cancel',exact:true}).click();
 });
 await check('Confirming the preview updates exactly three employees and clears selection without extra browser prompts',async()=>{
  const [[unselectedBefore]]=await db.execute('SELECT * FROM employee_attendance_records WHERE employee_attendance_id=?',[fixture.employees[3].attendance_id]);
  await bulk().click();await review();await modal().getByRole('button',{name:'Confirm and save',exact:true}).click();await modal().waitFor({state:'hidden'});await page.getByText(/^Time Out updated for 3 employee/).waitFor();await page.getByText(/^0 selected across pages/).waitFor();
  for(const employee of fixture.employees.slice(0,3)){const [[row]]=await db.execute('SELECT actual_time_in,actual_time_out FROM employee_attendance_records WHERE employee_attendance_id=?',[employee.attendance_id]);assert.deepEqual(row,{actual_time_in:'09:00:00',actual_time_out:'19:00:00'})}
  const [[unselectedAfter]]=await db.execute('SELECT * FROM employee_attendance_records WHERE employee_attendance_id=?',[fixture.employees[3].attendance_id]);assert.deepEqual(unselectedAfter,unselectedBefore);assert.deepEqual(dialogs,[]);
  await page.screenshot({path:resolve(out,'saved.png'),fullPage:true,animations:'disabled'});
 });
 await check('View-only account cannot see selection checkboxes or the bulk action',async()=>{
  const viewer=await browser.newContext();try{
   await viewer.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await api('/auth/login',{email:'hrviewer@qa.invalid',password:'Synthetic-QA-only-2026!'},'post',viewer);
   const screen=await viewer.newPage();await screen.goto(base+'/hr/attendance-records');await screen.getByPlaceholder('Search employee...').fill(fixture.prefix);await screen.getByText(fixture.employees[0].name,{exact:true}).waitFor();assert.equal(await screen.getByRole('button',{name:'Bulk Time Out Adjustment',exact:true}).count(),0);assert.equal(await screen.getByRole('checkbox',{name:/^Select /}).count(),0);
  }finally{await viewer.close()}
 });
 assert.deepEqual(errors,[],'Browser runtime errors');
}finally{
 await api('/attendance/settings',original,'put');writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors,dialogs},null,2));await browser.close();await db.end();
}
if(checks.some(check=>check.status==='FAIL'))process.exitCode=1;
