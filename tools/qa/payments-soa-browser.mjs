// Real React components, local Vite transforms and synthetic account props only.
// All network access is restricted to the loopback test server.
import {chromium} from 'playwright-core';
import {createServer} from '../../CLIENT/SYSTEM/node_modules/vite/dist/node/index.js';
import {mkdirSync,writeFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),runtime=resolve(root,'QA_REPORTS/.runtime/payments-soa'),out=resolve(root,'QA_REPORTS/evidence/payments-soa');mkdirSync(runtime,{recursive:true});mkdirSync(out,{recursive:true});
const path=file=>resolve(root,file).replaceAll('\\','/');
const entry=resolve(runtime,'harness.jsx');
writeFileSync(entry,`import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {MemoryRouter,Routes,Route} from 'react-router-dom';
import PaymentsSOA from ${JSON.stringify(path('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/PaymentsSOA/Payments_SOA.jsx'))};
import TabErrorBoundary from ${JSON.stringify(path('CLIENT/SYSTEM/src/components/Shared/TabErrorBoundary.jsx'))};
import {PERMISSIONS} from ${JSON.stringify(path('CLIENT/SYSTEM/src/config/permissions.js'))};

const params=new URLSearchParams(location.search),role=params.get('role')||'super_admin',scenario=params.get('scenario')||'reservation';
const reservation={id:1,paymentId:1,type:'Reservation',amount:50000,paymentDate:'2026-11-16',referenceId:'SYNTHETIC-QA-RESERVATION',status:'Verified',method:'Cash'};
const other={id:2,paymentId:2,type:'Downpayment',amount:10000,paymentDate:'2026-11-16',referenceId:'SYNTHETIC-QA-DP',status:scenario==='cancelled-dp'?'Cancelled':'Verified',method:'Cash'};
const payments=scenario==='none'?[]:scenario==='reservation'?[reservation]:[reservation,other];
const listing={id:1,unit_id:'QA-1806',buyerName:'Synthetic QA Buyer',projectName:'QA Project',status:'Sold / Active',canUsePayments:true,hasClientProfile:true,payment_count:payments.filter(p=>p.status==='Verified').length,soaFirstDueDate:'2026-11-16',soaStartingDate:'2026-11-16',soaDownpaymentPercentage:20,soaDownpaymentTerms:3,soaMonthlyTerms:24,soaDpDiscountPercentage:0,annualInterestRate:0,soaPenaltyRatePercent:0.05,soaPenaltyGraceDays:0,tcpNumeric:858000,balanceNumeric:808000};
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['currentUser'],{user:{id:1,role,permissions:Object.values(PERMISSIONS)}});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/projects/lot-projects/qa-project/listings/1']}><Routes><Route path='/projects/lot-projects/:projectSlug/listings/:listingId' element={<TabErrorBoundary><PaymentsSOA listing={listing} payments={payments} canCreate canEdit canDelete/></TabErrorBoundary>}/></Routes></MemoryRouter></QueryClientProvider>);
`);
const css=readdirSync(resolve(root,'CLIENT/SYSTEM/dist/assets')).find(file=>file.endsWith('.css'));
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/@fs/${path('CLIENT/SYSTEM/dist/assets/'+css)}"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${entry.replaceAll('\\','/')}"></script></body></html>`;
const server=await createServer({configFile:false,envDir:false,root:resolve(root,'CLIENT/SYSTEM'),resolve:{dedupe:['react','react-dom','react-router-dom','@tanstack/react-query']},css:{postcss:{plugins:[]}},define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api/v1')},plugins:[{name:'qa-payments-harness',configureServer(dev){dev.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(html)})}}],server:{host:'127.0.0.1',port:4187,strictPort:true,fs:{allow:[root]}}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),checks=[],errors=[],mutations=[];page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname.startsWith('/api/v1/')){mutations.push({method:route.request().method(),path:url.pathname});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})})}return route.continue()});
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png')}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function open(scenario='reservation',role='super_admin'){await page.goto(`http://127.0.0.1:4187/?scenario=${scenario}&role=${role}`);await page.getByRole('heading',{name:'Payments & SOA',exact:true}).waitFor()}
try{
  await check('Void opens owner authorization without crashing the Payments tab or submitting a mutation',async()=>{
    await open();await page.getByRole('button',{name:'Void',exact:true}).first().click();await page.getByRole('heading',{name:'Void Payment',exact:true}).waitFor();await page.getByText('Super Admin Password *',{exact:true}).waitFor();assert.equal(await page.getByText('This tab could not be displayed',{exact:true}).count(),0);assert.equal(mutations.filter(r=>r.method!=='GET').length,0);await page.screenshot({path:resolve(out,'void-owner.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check('System Admin and Accounting Head retain their correct authorization flows',async()=>{
    for(const role of ['system_admin','accounting_head']){await open('reservation',role);await page.getByRole('button',{name:'Void',exact:true}).first().click();await page.getByRole('heading',{name:'Void Payment',exact:true}).waitFor();if(role==='system_admin')await page.getByText('System Admin Password *',{exact:true}).waitFor();else{await page.getByRole('button',{name:'Check Correction Authority',exact:true}).waitFor();assert.equal(await page.locator('input[type=password]').count(),0)}await page.getByRole('button',{name:'Cancel',exact:true}).click()}
  });
  await check('Reservation keeps First Due Date editable while other recorded-payment terms stay locked',async()=>{
    await open();await page.getByRole('button',{name:'Edit SOA Terms',exact:true}).click();assert.equal(await page.getByLabel('Downpayment %',{exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Next: Schedule & Penalty',exact:true}).click();const date=page.getByLabel('First Due Date',{exact:true});assert.equal(await date.isDisabled(),false);await date.fill('2026-12-01');assert.equal(await date.inputValue(),'2026-12-01');await page.screenshot({path:resolve(out,'reservation-first-due-editable.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check('A recorded downpayment locks First Due Date; a cancelled downpayment does not',async()=>{
    for(const scenario of ['downpayment','cancelled-dp']){await open(scenario);await page.getByRole('button',{name:'Edit SOA Terms',exact:true}).click();await page.getByRole('button',{name:'Next: Schedule & Penalty',exact:true}).click();assert.equal(await page.getByLabel('First Due Date',{exact:true}).isDisabled(),scenario==='downpayment');await page.getByRole('button',{name:'Cancel',exact:true}).click()}
  });
  assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors,mutations},null,2));await browser.close();await server.close()}
if(checks.some(result=>result.status!=='PASS'))process.exitCode=1;
