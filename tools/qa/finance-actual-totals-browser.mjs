// Actual Finance build/API. Uses fixtures from finance-actual-totals.e2e.test.mjs.
import {chromium} from 'playwright-core';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {financeMoney} from '../../CLIENT/FINANCE/src/financeFormat.js';
const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url));
const db=require('mysql2/promise').createPool({host:'127.0.0.1',port:13307,user:'qa_finance',password:'qa-isolated-only-password',database:'dc_prime_finance_db',dateStrings:true});
const [[state]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');assert.equal(state.port,13307);
assert.equal(state.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
const base='http://127.0.0.1:4179',headers={origin:base,'x-requested-with':'dcprime-finance'},out=resolve('QA_REPORTS/evidence/finance-actual-totals');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const signedIn=await context.request.post(base+'/finance-api/api/v1/auth/login',{headers,data:{email:'admin@qa.invalid',password:'Synthetic-QA-only-2026!'}});assert.equal(signedIn.status(),200,await signedIn.text());
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
let report;
const nav=name=>page.getByRole('navigation',{name:'Finance navigation'}).getByRole('button',{name,exact:true});
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png'),fullPage:true,animations:'disabled'}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function dates(screen,from='2026-08-01',to='2026-08-11'){
 const section=page.getByRole('region',{name:screen+' Date Filter',exact:true});
 await section.getByLabel('Range',{exact:true}).selectOption('custom');await section.getByLabel('From Date',{exact:true}).fill(from);await section.getByLabel('To Date',{exact:true}).fill(to);
 const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/finance/reports')&&new URL(r.url()).searchParams.get('from')===from&&new URL(r.url()).searchParams.get('to')===to);
 await page.getByRole('button',{name:'Apply dates',exact:true}).click();const result=await response;assert.equal(result.status(),200);report=await result.json();
 await page.waitForFunction(()=>document.querySelector('.finance-report-results')?.getAttribute('aria-busy')==='false');
}
async function summary(selector){
 const cards=page.locator(selector);assert.equal(await cards.locator('.finance-metric').count(),4);assert.equal(await cards.getByText('Closing balance',{exact:true}).count(),0);
 await cards.locator('.finance-metric-income').getByText(financeMoney(report.money_in),{exact:true}).waitFor();
 await cards.locator('.finance-metric-expense').getByText(financeMoney(report.money_out),{exact:true}).waitFor();
 const actual=cards.getByRole('region',{name:'Actual money in and out',exact:true});
 for(const [label,key] of [['Money in','actual_money_in'],['Money out','actual_money_out']]){
  const row=actual.locator('dl>div').filter({has:page.getByText(label,{exact:true})});await row.getByText(financeMoney(report[key]),{exact:true}).waitFor();
 }
 await page.getByText(/Each imported payment is counted once\./).waitFor();
}
async function fits(){const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size));
 const actual=page.getByRole('region',{name:'Actual money in and out',exact:true});assert.ok(await actual.evaluate(node=>node.scrollWidth<=node.clientWidth+1));
}
try{
 await page.goto(base+'/finance');await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
 await check('Dashboard separates gross activity from the screenshot’s actual income and expenses',async()=>{
  await dates('Dashboard');assert.equal(report.money_in,'411329.16');assert.equal(report.money_out,'14925.00');assert.equal(report.actual_money_in,'403866.66');assert.equal(report.actual_money_out,'7462.50');assert.equal(report.net_change,'396404.16');
  await summary('.finance-dashboard-summary');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await fits();await page.screenshot({path:resolve(out,'dashboard-'+width+'.png'),fullPage:true,animations:'disabled'})}
 });
 await check('Reports display the same actual totals and preserve gross chart and table values',async()=>{
  await nav('Reports').click();await dates('Report');await summary('.finance-report-summary');
  const flow=page.getByRole('group',{name:/^Money in and money out by period/});await flow.focus();await flow.press('End');const tooltip=flow.getByRole('tooltip');await tooltip.getByText(financeMoney('7462.50'),{exact:true}).first().waitFor();await flow.press('Escape');
  await page.getByText('View cash flow data table',{exact:true}).click();const totals=page.getByRole('table',{name:'Cash flow data',exact:true}).locator('tfoot');
  await totals.getByText(financeMoney(report.money_in),{exact:true}).waitFor();await totals.getByText(financeMoney(report.money_out),{exact:true}).waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await fits();await page.screenshot({path:resolve(out,'reports-'+width+'.png'),fullPage:true,animations:'disabled'})}
 });
 await check('PDF export includes actual totals and the correction explanation without a Closing balance card',async()=>{
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const file=await download,path=resolve(out,'actual-totals-report.pdf');await file.saveAs(path);
  const {getDocument}=await import('../../CLIENT/SYSTEM/node_modules/pdfjs-dist/legacy/build/pdf.mjs');const pdf=await getDocument({data:new Uint8Array(readFileSync(path)),isEvalSupported:false}).promise;
  let text='';for(let number=1;number<=pdf.numPages;number++)text+=(await(await pdf.getPage(number)).getTextContent()).items.map(item=>item.str).join(' ');
  assert.ok(text.includes('Actual totals'));assert.ok(text.includes('matching undo entries'));assert.doesNotMatch(text,/Closing balance/);
  for(const key of ['money_in','money_out','net_change','actual_money_in','actual_money_out'])assert.ok(text.includes(financeMoney(report[key])),key);
  await pdf.destroy();
 });
 await check('A correction crossing the selected dates shows why actual totals differ from net movement',async()=>{
  await dates('Report','2026-08-11','2026-08-11');assert.equal(report.net_change,'0.00');assert.equal(report.actual_money_in,'0.00');assert.equal(report.actual_money_out,'7462.50');
  await summary('.finance-report-summary');await page.getByText(/A correction crosses this date range/).waitFor();
  await page.screenshot({path:resolve(out,'cross-period-correction.png'),fullPage:true,animations:'disabled'});
 });
 await check('Historical and empty ranges do not apply future reversals or leave stale actual totals',async()=>{
  await dates('Report','2026-08-01','2026-08-10');assert.equal(report.payroll_correction_count,0);assert.equal(report.actual_money_out,'7462.50');assert.equal(await page.getByText(/A correction crosses this date range/).count(),0);
  await dates('Report','2026-07-01','2026-07-31');assert.equal(report.actual_money_in,'0.00');assert.equal(report.actual_money_out,'0.00');await summary('.finance-report-summary');
  await page.getByText('No posted transactions in this period',{exact:true}).waitFor();
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await db.end()}
if(checks.some(result=>result.status!=='PASS'))process.exitCode=1;
