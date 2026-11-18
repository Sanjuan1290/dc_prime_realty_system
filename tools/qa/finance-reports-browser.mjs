// Actual Finance build and APIs. Writes only synthetic data on the guarded QA DB.
import {chromium} from 'playwright-core';
import {createRequire} from 'node:module';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {financeMoney} from '../../CLIENT/FINANCE/src/financeFormat.js';

const require=createRequire(new URL('../../SERVER/FINANCE/package.json',import.meta.url));
const db=require('mysql2/promise').createPool({host:'127.0.0.1',port:13307,user:'qa_finance',password:'qa-isolated-only-password',database:'dc_prime_finance_db',dateStrings:true});
const [[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');
assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
const base='http://127.0.0.1:4179',out=resolve('QA_REPORTS/evidence/finance-reports');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const headers={origin:base,'x-requested-with':'dcprime-finance'};
const login=await context.request.post(base+'/finance-api/api/v1/auth/login',{headers,data:{email:'admin@qa.invalid',password:'Synthetic-QA-only-2026!'}});
assert.equal(login.status(),200,await login.text());
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
async function api(path,body){const r=await context.request[body?'post':'get'](base+'/finance-api/api/v1'+path,{headers,...(body?{data:body}:{})});assert.ok(r.ok(),await r.text());return r.json()}
const category=await api('/finance/categories',{kind:'expense',name:'Office supplies, equipment and daily operations '.repeat(2).slice(0,72)+randomUUID().slice(0,8)});
const entry=await api('/finance/transactions',{kind:'expense',amount:'500000.21',transaction_date:'2026-09-10',category_id:category.id,description:'Synthetic report layout and negative balance check'});
let report;
const navigation=name=>page.getByRole('navigation',{name:'Finance navigation'}).getByRole('button',{name,exact:true});
const chart=(name,target=page)=>target.getByRole('group',{name:new RegExp('^'+name)});
async function fits(target=page){const size=await target.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));assert.ok(size.scroll<=size.width+1,JSON.stringify(size))}
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function dates(from,to){const section=page.getByRole('region',{name:'Report Date Filter',exact:true});await section.getByLabel('Range',{exact:true}).selectOption('custom');await section.getByLabel('From Date',{exact:true}).fill(from);await section.getByLabel('To Date',{exact:true}).fill(to);const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/finance/reports')&&new URL(r.url()).searchParams.get('from')===from&&new URL(r.url()).searchParams.get('to')===to);await page.getByRole('button',{name:'Apply dates',exact:true}).click();const r=await response;assert.equal(r.status(),200);report=await r.json();await page.getByRole('region',{name:'Finance report results'}).waitFor();await page.waitForFunction(()=>document.querySelector('.finance-report-results')?.getAttribute('aria-busy')==='false')}
async function hover(group,index,count,balance=false){await group.scrollIntoViewIfNeeded();const box=await group.boundingBox(),left=box.width<420?57:66;await page.mouse.move(box.x+left+(box.width-left-18)/count*(index+(balance?1:0.5)),box.y+100);await group.getByRole('tooltip').waitFor()}
try{
 await page.goto(base+'/finance');await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
 await check('Source and category filters affect both transaction rows and total counts',async()=>{
  const all=await api('/finance/transactions?from=2026-01-01&to=2026-11-30&status=all&page_size=100');
  for(const source of ['manual','realty','hr']){const filtered=await api('/finance/transactions?from=2026-01-01&to=2026-11-30&status=all&page_size=100&source='+source);assert.ok(filtered.transactions.every(row=>row.source_system===source));assert.equal(filtered.total,all.transactions.filter(row=>row.source_system===source).length)}
  const invalid=await context.request.get(base+'/finance-api/api/v1/finance/transactions?source=invalid',{headers});assert.equal(invalid.status(),400);
  await navigation('Transactions').click();const form=page.getByRole('form',{name:'Transaction filters'});await form.waitFor();
  await form.getByLabel('From',{exact:true}).fill('2026-09-01');await form.getByLabel('To',{exact:true}).fill('2026-11-30');await form.getByLabel('Type',{exact:true}).selectOption('expense');await form.getByLabel('Source',{exact:true}).selectOption('manual');await form.getByLabel('Category',{exact:true}).selectOption(String(category.id));
  const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/finance/transactions')&&new URL(r.url()).searchParams.get('category_id')===String(category.id));await form.getByRole('button',{name:'Apply filters',exact:true}).click();const filtered=await(await response).json();assert.equal(filtered.total,1);assert.equal(String(filtered.transactions[0].id),String(entry.id));
  await page.getByRole('button',{name:'Synthetic report layout and negative balance check',exact:true}).waitFor();
  await form.getByLabel('Type',{exact:true}).selectOption('income');assert.equal(await form.getByLabel('Category',{exact:true}).inputValue(),'');
  await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');await form.getByRole('button',{name:'Reset filters',exact:true}).click();await page.waitForFunction(()=>document.querySelector('main')?.getAttribute('aria-busy')==='false');assert.equal(await form.getByLabel('Source',{exact:true}).inputValue(),'all');
 });
 await check('Reports use their date range without the moved breakdown filters',async()=>{
  await navigation('Reports').click();await dates('2026-09-10','2026-09-11');assert.equal(await page.getByText('Breakdown filters',{exact:true}).count(),0);assert.equal(await page.getByLabel('Source',{exact:true}).count(),0);assert.equal(report.filters.kind,'all');assert.equal(report.filters.source,'all');assert.ok(Number(report.closing_balance)<0);
 });
 await check('Every report chart shows exact values on hover and supports keyboard navigation',async()=>{
  const flow=chart('Money in and money out by period');await hover(flow,0,report.series.length);await flow.getByRole('tooltip').getByText(financeMoney(report.series[0].expense),{exact:true}).waitFor();
  const balance=chart('Running cash balance over the report period');await hover(balance,report.series.length-1,report.series.length,true);await balance.getByRole('tooltip').getByText(financeMoney(report.closing_balance),{exact:true}).waitFor();
  await balance.focus();await balance.press('Home');await balance.getByRole('tooltip').getByText('Opening balance',{exact:true}).waitFor();await balance.getByRole('tooltip').getByText(financeMoney(report.opening_balance),{exact:true}).waitFor();await balance.press('End');await balance.getByRole('tooltip').getByText(report.series.at(-1).label,{exact:true}).waitFor();
  await flow.focus();await flow.press('End');await flow.getByRole('tooltip').getByText(report.series.at(-1).label,{exact:true}).waitFor();await flow.press('Home');await flow.getByRole('tooltip').getByText(report.series[0].label,{exact:true}).waitFor();await flow.press('Escape');await flow.getByRole('tooltip').waitFor({state:'hidden'});
  const categories=chart('Top expense categories.');await categories.hover({position:{x:40,y:22}});await categories.getByRole('tooltip').getByText(report.categories.filter(row=>row.kind==='expense')[0].name,{exact:true}).waitFor();await categories.focus();await categories.press('End');await categories.getByRole('tooltip').waitFor();await categories.press('Escape');
  await page.getByLabel('Chart type',{exact:true}).selectOption('income');await page.getByText('No income categories in this period.',{exact:true}).waitFor();await page.getByLabel('Chart type',{exact:true}).selectOption('expense');await chart('Top expense categories.').getByRole('img').waitFor();
 });
 await check('Charts, table disclosure, and filters fit 320, 390, 768 and 1440 pixel screens',async()=>{
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1000});await fits();
   for(const svg of await page.locator('.finance-plot').all())assert.ok(await svg.evaluate(node=>node.getBoundingClientRect().width<=node.parentElement.getBoundingClientRect().width+1));
   await page.getByText('View cash flow data table',{exact:true}).click();const table=page.getByRole('table',{name:'Cash flow data',exact:true});await table.waitFor();assert.equal(await table.locator('tbody tr').count(),report.series.length);await table.locator('tfoot').getByText(financeMoney(report.closing_balance),{exact:true}).waitFor();await fits();
   await page.screenshot({path:resolve(out,'report-'+width+'.png'),fullPage:true});await page.getByText('View cash flow data table',{exact:true}).click();
   await navigation('Transactions').click();await page.getByRole('form',{name:'Transaction filters'}).waitFor();await fits();await page.screenshot({path:resolve(out,'transactions-'+width+'.png'),fullPage:true});await navigation('Reports').click();await dates('2026-09-10','2026-09-11');
  }
 });
 await check('Dashboard charts share the interactions and mobile layout',async()=>{
  await navigation('Dashboard').click();const flow=chart('Money in and money out by period');await flow.waitFor();await flow.focus();await flow.getByRole('tooltip').waitFor();await flow.press('ArrowRight');await flow.getByRole('tooltip').waitFor();
  const category=page.locator('.finance-top-categories>li').first();await category.focus();await category.getByRole('tooltip').waitFor();
  await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'dashboard-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 });
 await check('Touch can inspect a chart and dismiss its tooltip by tapping elsewhere',async()=>{
  const mobile=await browser.newContext({storageState:await context.storageState(),viewport:{width:390,height:844},isMobile:true,hasTouch:true});await mobile.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());const touch=await mobile.newPage();touch.on('pageerror',error=>errors.push(error.message));
  try{await touch.goto(base+'/finance');const flow=chart('Money in and money out by period',touch);await flow.waitFor();await flow.tap({position:{x:130,y:100}});await flow.getByRole('tooltip').waitFor();await touch.getByRole('heading',{name:'Dashboard',exact:true}).tap();await flow.getByRole('tooltip').waitFor({state:'hidden'});await fits(touch)}finally{await mobile.close()}
 });
 await check('Monthly, yearly and empty periods render safely and PDF export still works',async()=>{
  await navigation('Reports').click();await dates('2026-01-01','2026-11-18');assert.equal(report.bucket_size,'month');await chart('Money in and money out by period').focus();await page.getByRole('tooltip').waitFor();
  await dates('2024-01-01','2026-11-18');assert.equal(report.bucket_size,'year');await chart('Running cash balance over the report period').focus();await page.getByRole('tooltip').waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const file=await download;assert.match(file.suggestedFilename(),/\.pdf$/);const path=resolve(out,'finance-report.pdf');await file.saveAs(path);const bytes=readFileSync(path);assert.equal(bytes.subarray(0,5).toString(),'%PDF-');assert.ok(bytes.length>1000);
  await dates('2026-01-01','2026-01-02');await page.getByText('No posted transactions in this period',{exact:true}).waitFor();assert.equal(await page.locator('.finance-plot').count(),0);await fits();
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await db.end()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
