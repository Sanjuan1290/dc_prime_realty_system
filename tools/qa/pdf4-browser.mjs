// Real React components and APIs. Only email delivery is replaced by in-memory capture.
import {chromium} from 'playwright-core';
import {createServer} from '../../CLIENT/HR/node_modules/vite/dist/node/index.js';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
Object.assign(process.env,{NODE_ENV:'test',HR_DB_HOST:'127.0.0.1',HR_DB_PORT:'13307',HR_DB_USER:'qa_hr',HR_DB_PASSWORD:'qa-isolated-only-password',HR_DB_NAME:'dc_prime_hr_db',HR_DB_TLS:'false',HR_JWT_SECRET:'qa-hr-only-secret-'.repeat(4)});
const {requestPayrollUndo}=await import('../../SERVER/HR/services/payrollUndo.service.js'),{db}=await import('../../SERVER/HR/db/connect.js');
const fixture=JSON.parse(readFileSync('QA_REPORTS/.runtime/pdf4-fixtures.json','utf8'));
const root=resolve('.'),runtime=resolve('QA_REPORTS/.runtime/pdf4-browser'),out=resolve('QA_REPORTS/evidence/pdf4-browser'),base='http://127.0.0.1:4179';mkdirSync(runtime,{recursive:true});mkdirSync(out,{recursive:true});
const [[database]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(database.port,13307);assert.equal(database.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
await db.query('UPDATE hr_payroll_undo_challenges SET requested_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 20 MINUTE) WHERE user_id=1');
const path=file=>resolve(file).replaceAll('\\','/'),entry=resolve(runtime,'entry.jsx');
writeFileSync(entry,`import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter} from 'react-router-dom';
import SalaryDetail from ${JSON.stringify(path('CLIENT/HR/src/components/System/employeeSalaryComponents/SalaryDetailModal.jsx'))};
import Documents from ${JSON.stringify(path('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/Documents/Documents.jsx'))};
import {requestApiBlob} from ${JSON.stringify(path('CLIENT/SYSTEM/src/utils/apiClient.js'))};
window.qaDownload=async()=>{try{const result=await requestApiBlob('/qa-download',{redirectOnUnavailable:false});return {ok:true,size:result.blob.size}}catch(error){return {status:error.status,code:error.code,message:error.message}}};
function App(){const params=new URLSearchParams(location.search),[open,setOpen]=useState(true);return params.get('screen')==='documents'?<div className="p-4"><Documents canManage documents={['Missing','Submitted','Approved','Rejected'].map((status,index)=>({id:index+1,name:'Synthetic '+status,requirement:index%2?'Optional':'Required',responsibleParty:'client',libraryStatus:index%2?'inactive':'active',status,fileName:index?'synthetic.pdf':'',files:index?[{fileId:index,fileName:'synthetic.pdf',contentPath:'/qa-never-fetched',protected:true,malwareScanStatus:'pending'}]:[]}))}/></div>:open?<SalaryDetail payrollId={${fixture.payrollId}} canRecalculate canFinalize canRelease canPrintReceipt onClose={()=>setOpen(false)}/>:<p>Closed</p>}
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><MemoryRouter><App/></MemoryRouter></QueryClientProvider>);`);
const css=readdirSync(resolve('CLIENT/HR/dist/assets')).find(file=>file.startsWith('index-')&&file.endsWith('.css'));
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/@fs/${path('CLIENT/HR/dist/assets/'+css)}"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${path(entry)}"></script></body></html>`;
const server=await createServer({configFile:false,envDir:false,root:resolve('CLIENT/HR'),resolve:{dedupe:['react','react-dom','react-router-dom','@tanstack/react-query']},css:{postcss:{plugins:[]}},define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api/v1'),'import.meta.env.VITE_HR_API_URL':JSON.stringify('/hr-api/api/v1')},plugins:[{name:'pdf4-harness',configureServer(dev){dev.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(html)})}}],server:{host:'127.0.0.1',port:4189,strictPort:true,fs:{allow:[root]},proxy:{'/api/v1':{target:'http://127.0.0.1:5201',headers:{origin:base}},'/hr-api':{target:'http://127.0.0.1:5202',headers:{origin:base},rewrite:path=>path.replace(/^\/hr-api/,'')}}}});await server.listen();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(12000);
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());page.on('pageerror',error=>errors.push(error.message));page.on('dialog',dialog=>dialog.accept());
let emailCode;
await page.route(`**/employee-payroll/payrolls/${fixture.payrollId}/undo/request`,async route=>{
  try{const result=await requestPayrollUndo(fixture.payrollId,1,route.request().postDataJSON(),{settings:{key:'not-used',from:'qa@invalid'},mailer:async data=>{emailCode=data.code}});await route.fulfill({status:200,json:result})}
  catch(error){await route.fulfill({status:error.statusCode||500,json:{code:error.code,message:error.message}})}
});
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png')}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function login(app,email){const response=await context.request.post(base+(app==='system'?'/api/v1/user/login':app==='hr'?'/hr-api/api/v1/auth/login':'/finance-api/api/v1/auth/login'),{data:{email,password:'Synthetic-QA-only-2026!'},headers:{origin:base,'x-requested-with':'dcprime-finance'}});assert.equal(response.status(),200,await response.text())}
const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
try{
 await login('hr','hr@qa.invalid');
 // A failed browser run may have completed undo before its next assertion.
 // Restore readiness using the real guarded API, never by changing status in SQL.
 const [[initial]]=await db.query('SELECT payroll_status FROM employee_payrolls WHERE employee_payroll_id=?',[fixture.payrollId]);
 for(const action of initial.payroll_status==='draft'?['recalculate','finalize','release']:initial.payroll_status==='finalized'?['release']:[]){
   const path=action==='release'?`/employee-payroll/payrolls/${fixture.payrollId}/release`:`/employee-payroll/drafts/${fixture.payrollId}/${action}`;
   const response=await context.request.post(base+'/hr-api/api/v1'+path,{data:action==='release'?{release_date:'2026-11-18'}:{attendance_review_confirmed:true},headers:{origin:base}});assert.equal(response.status(),200,await response.text());
 }
 await check('Undo opens with explicit cash confirmation; cancellation and Escape preserve payroll',async()=>{
  await page.goto('http://127.0.0.1:4189/');const trigger=page.getByRole('button',{name:'Undo payroll',exact:true});await trigger.click();const dialog=page.getByRole('dialog',{name:'Undo released payroll',exact:true});await dialog.waitFor();assert.equal(await dialog.getByRole('checkbox').isChecked(),false);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await trigger.evaluate(node=>node===document.activeElement),true);
  const [[row]]=await db.query('SELECT payroll_status FROM employee_payrolls WHERE employee_payroll_id=?',[fixture.payrollId]);assert.equal(row.payroll_status,'released');
 });
 await check('Undo requires password and email code, handles failures and completes through the real API',async()=>{
  await page.getByRole('button',{name:'Undo payroll',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Undo released payroll',exact:true});
  await dialog.getByLabel('Reason',{exact:true}).fill('Synthetic browser undo after returned funds');await dialog.getByRole('checkbox').check();await dialog.getByLabel('Your administrator password',{exact:true}).fill('Wrong-password');await dialog.getByRole('button',{name:'Send verification code',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'password is incorrect'}).waitFor();
  await dialog.getByLabel('Your administrator password',{exact:true}).fill('Synthetic-QA-only-2026!');await dialog.getByRole('button',{name:'Send verification code',exact:true}).click();const code=dialog.getByLabel('Email verification code',{exact:true});await code.waitFor();
  await code.fill(emailCode==='000000'?'000001':'000000');await dialog.getByRole('button',{name:'Undo payroll',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'password or email code is incorrect'}).waitFor();
  await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'undo-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  await code.fill(emailCode);await dialog.getByRole('button',{name:'Undo payroll',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByRole('button',{name:'Recalculate Draft',exact:true}).waitFor();await page.screenshot({path:resolve(out,'undo-history.png')});
 });
 await check('The original receipt remains visible and clearly marked as an undone payment',async()=>{
  await page.getByRole('button',{name:'View original receipt',exact:true}).first().click();await page.getByText('Historical receipt — this payroll approval was undone. Preview only.',{exact:true}).waitFor();await page.getByText('Historical Receipt — Payroll Undone — Not Valid for Payment',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Print Receipt',exact:true}).count(),0);await page.getByRole('button',{name:'Close',exact:true}).last().click();
 });
 await check('Draft recalculation, final review and the real release form work together',async()=>{
  await page.getByRole('button',{name:'Recalculate Draft',exact:true}).click();await page.getByText('Draft payroll recalculated.',{exact:true}).waitFor();await page.getByRole('button',{name:'Proceed to Final Review',exact:true}).click();const finalize=page.getByRole('button',{name:'Finalize Salary',exact:true});await finalize.waitFor();await finalize.click();await page.getByRole('button',{name:'Mark as Released',exact:true}).waitFor();await page.getByRole('button',{name:'Mark as Released',exact:true}).click();const release=page.getByRole('dialog',{name:'Mark Payroll as Released',exact:true});await release.waitFor();assert.equal(await page.getByText(/Batch 8/).count(),0);await release.getByLabel(/Witness Name/).fill('Browser QA witness');await page.screenshot({path:resolve(out,'release-desktop.png')});await release.getByRole('button',{name:'Mark as Released',exact:true}).click();await release.waitFor({state:'hidden'});await page.getByRole('button',{name:'Print Receipt',exact:true}).waitFor();
  const [[payroll]]=await db.query('SELECT payroll_status FROM employee_payrolls WHERE employee_payroll_id=?',[fixture.payrollId]);assert.equal(payroll.payroll_status,'released');
 });
 await check('Every document status and requirement has a visible badge and Missing cannot be approved',async()=>{
  await page.goto('http://127.0.0.1:4189/?screen=documents');await page.getByText('Synthetic Missing',{exact:true}).waitFor();
  for(const name of ['Missing','Submitted','Approved','Needs Resubmission','Required','Optional','Active','Deactivated']){const label=page.getByText(name,{exact:true}).first();assert.notEqual(await label.evaluate(node=>getComputedStyle(node).backgroundColor),'rgba(0, 0, 0, 0)',name)}
  const missing=page.getByRole('row').filter({hasText:'Synthetic Missing'});assert.equal(await missing.getByRole('button',{name:'Approve',exact:true}).count(),0);await page.screenshot({path:resolve(out,'documents-desktop.png')});await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'documents-mobile.png')});await page.setViewportSize({width:1440,height:1000});
 });
 await check('Download failures preserve actionable HTTP errors and hide provider HTML',async()=>{
  await page.goto('http://127.0.0.1:4189/');
  for(const status of [400,401,409,503]){await page.route('**/api/v1/qa-download',route=>route.fulfill({status,json:{code:'SYNTHETIC_EXPORT_ERROR',message:'Synthetic export needs review'}}));const result=await page.evaluate(()=>window.qaDownload());assert.equal(result.status,status);assert.equal(result.message,'Synthetic export needs review');await page.unroute('**/api/v1/qa-download')}
  await page.route('**/api/v1/qa-download',route=>route.fulfill({status:502,contentType:'text/html',body:'<html>private provider details</html>'}));const result=await page.evaluate(()=>window.qaDownload());assert.equal(result.status,502);assert.doesNotMatch(result.message,/private|<html|protected file could not/);await page.unroute('**/api/v1/qa-download');
  await page.route('**/api/v1/qa-download',route=>route.fulfill({status:200,contentType:'text/csv',body:'synthetic,csv\r\n'}));assert.equal((await page.evaluate(()=>window.qaDownload())).ok,true);await page.unroute('**/api/v1/qa-download');
 });
 await check('The production HR audit screen shows readable changes with no raw JSON',async()=>{
  await page.goto(base+'/hr/audit-logs');await page.getByRole('heading',{name:'HR & Payroll audit log',exact:true}).waitFor();await page.getByLabel('Action',{exact:true}).fill('payroll.undone');await page.getByRole('button',{name:'Apply filters',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Audit event details',exact:true});await dialog.waitFor();await dialog.getByRole('columnheader',{name:'Before',exact:true}).waitFor();assert.equal(await dialog.locator('pre').count(),0);assert.ok(await dialog.getByText('QA HR Admin',{exact:true}).count());await page.screenshot({path:resolve(out,'hr-audit-desktop.png')});await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'hr-audit-mobile.png')});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await page.setViewportSize({width:1440,height:1000});
 });
 await check('The production Finance audit screen shows named actors and readable event details',async()=>{
  await login('finance','admin@qa.invalid');await page.goto(base+'/finance');await page.getByRole('button',{name:'Audit log',exact:true}).click();await page.getByRole('button',{name:'View details',exact:true}).first().click();const dialog=page.getByRole('dialog',{name:'Audit event details',exact:true});await dialog.waitFor();assert.equal(await dialog.locator('pre').count(),0);assert.ok(await dialog.getByText('QA admin',{exact:true}).count());await page.screenshot({path:resolve(out,'finance-audit-desktop.png')});await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'finance-audit-mobile.png')});await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.setViewportSize({width:1440,height:1000});
 });
 await check('Main-system manual entry and its Finance shortcut are removed while export remains available',async()=>{
  await login('system','system@qa.invalid');await page.goto(base+'/system/portal/super_admin/company-finances');await page.getByRole('heading',{name:'Company Finances',level:1,exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:/^Add (Income|Expense)$/}).count(),0);assert.equal(await page.getByRole('link',{name:'Record income or expense in Finance',exact:true}).count(),0);await page.getByRole('button',{name:'Export to Finance (CSV)',exact:true}).waitFor();
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await server.close();await db.end()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
