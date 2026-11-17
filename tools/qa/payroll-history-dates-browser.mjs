// The API regression prepares a separate synthetic employee for this UI flow.
import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/payroll-history-browser.json','utf8')),base='http://127.0.0.1:4179',out=resolve('QA_REPORTS/evidence/payroll-history-dates');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(12000);
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png')}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function openPayroll(){
 await page.getByRole('link',{name:'Payroll',exact:true}).click();await page.getByLabel('Month',{exact:true}).fill('2026-11');await page.getByLabel(/^Payroll Period/).selectOption('first_half');await page.getByRole('button',{name:'Create Payroll Draft',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Create Payroll Draft',exact:true});await dialog.getByLabel(/^Choose Employees/).selectOption(String(fixture.id));return dialog;
}
try{
 await check('Pre-hire payroll explains the actual date conflict and suppresses false salary/rest-day warnings',async()=>{
  await page.goto(base+'/hr/login');await page.getByLabel('HR email',{exact:true}).fill('hr@qa.invalid');await page.getByLabel('Password',{exact:true}).fill('Synthetic-QA-only-2026!');await page.getByRole('button',{name:'Sign in to HR',exact:true}).click();await page.waitForURL('**/hr/employees');const dialog=await openPayroll();await dialog.getByText('0 ready · 1 outside pay period',{exact:true}).waitFor();await dialog.getByText(/recorded hire date is 2026-11-16/).waitFor();
  assert.equal(await dialog.getByText(/Salary details are missing|Rest days are not set/).count(),0);assert.equal(await dialog.getByRole('button',{name:'Create Drafts for Ready Employees',exact:true}).isDisabled(),true);await page.screenshot({path:resolve(out,'pre-hire-period-desktop.png')});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,'pre-hire-period-mobile.png')});await page.setViewportSize({width:1440,height:1000});await dialog.getByRole('button',{name:'Close Create Payroll Draft',exact:true}).click();
 });
 await check('Edit Employee requires a reason and explains how its hire-date correction moves initial history',async()=>{
  await page.getByRole('link',{name:'Employees',exact:true}).click();await page.getByPlaceholder('Search name, employee code, or attendance barcode...').fill(fixture.code);const row=page.getByRole('row').filter({hasText:fixture.code});await row.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('heading',{name:'Edit Employee',exact:true}).waitFor();await page.getByLabel('Hire Date *',{exact:true}).fill('2026-11-01');await page.getByText(/Correcting the hire date also updates the original salary and rest-day start dates/).waitFor();await page.getByLabel('Reason for changing hire date *',{exact:true}).fill('Correcting the synthetic original onboarding date');await page.screenshot({path:resolve(out,'explicit-date-correction.png')});await page.getByRole('button',{name:'Save Employee',exact:true}).click();await page.getByRole('heading',{name:'Edit Employee',exact:true}).waitFor({state:'hidden'});
 });
 await check('The next payroll check refreshes the corrected history and recognizes Tuesday/Thursday rest days',async()=>{
  const dialog=await openPayroll();await dialog.getByText('1 ready',{exact:true}).waitFor();await dialog.getByText('No payroll issues found.',{exact:true}).waitFor();assert.equal(await dialog.getByText(/Salary details are missing|Rest days are not set|recorded hire date is 2026-11-16/).count(),0);assert.equal(await dialog.getByRole('button',{name:'Create Payroll Draft',exact:true}).isDisabled(),false);await page.screenshot({path:resolve(out,'corrected-period-ready.png')});await dialog.getByRole('button',{name:'Close Create Payroll Draft',exact:true}).click();
 });assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
