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
import UnitStatus from ${JSON.stringify(path('CLIENT/SYSTEM/src/components/Lot_Projects/ListingProfileComponents/UnitStatus/UnitStatus.jsx'))};
import TabErrorBoundary from ${JSON.stringify(path('CLIENT/SYSTEM/src/components/Shared/TabErrorBoundary.jsx'))};
import {PERMISSIONS} from ${JSON.stringify(path('CLIENT/SYSTEM/src/config/permissions.js'))};

const params=new URLSearchParams(location.search),role=params.get('role')||'super_admin',scenario=params.get('scenario')||'reservation';
const reservation={id:1,paymentId:1,type:'Reservation',amount:50000,paymentDate:'2026-11-16',referenceId:'SYNTHETIC-QA-RESERVATION',status:'Verified',method:'Cash'};
const other={id:2,paymentId:2,type:'Downpayment',amount:10000,paymentDate:'2026-11-16',referenceId:'SYNTHETIC-QA-DP',status:scenario==='cancelled-dp'?'Cancelled':'Verified',method:'Cash'};
const payments=scenario==='none'?[]:scenario==='reservation'?[reservation]:[reservation,other];
const listing={id:1,unit_id:'QA-1806',buyerName:'Synthetic QA Buyer',projectName:'QA Project',status:'Sold / Active',listing_status:'Sold / Active',rawStatus:'sold',canUsePayments:true,hasClientProfile:true,payment_count:payments.filter(p=>p.status==='Verified').length,soaFirstDueDate:'2026-11-16',soaStartingDate:'2026-11-16',soaDownpaymentPercentage:20,soaDownpaymentTerms:3,soaMonthlyTerms:24,soaDpDiscountPercentage:0,annualInterestRate:0,soaAnnualInterestRate:11.5,soaInterestRateOverridden:true,soaPenaltyRatePercent:0.05,soaPenaltyGraceDays:0,tcpNumeric:858000,balanceNumeric:808000};
Object.assign(listing,{baseSellingPrice:780000,lmfAmount:78000,tcpAmount:858000,lot_project_listing_net_selling_price:999999,lot_project_listing_lmf_amount:99999,lot_project_listing_tcp:1099998});
Object.assign(listing,{lotAreaSqm:120,pricePerSqm:6500,soaModeOfPayment:'installment',soaLegalMiscFeeMode:'include_in_monthly',installmentPricePerSqm:9999,cashPricePerSqm:999});
if(['cash','cash-later'].includes(scenario))Object.assign(listing,{soaModeOfPayment:'cash',baseSellingPrice:740000,lmfAmount:74000,tcpAmount:814000,lotAreaSqm:100,pricePerSqm:7400});
if(['pay-later','cash-later'].includes(scenario))listing.soaLegalMiscFeeMode='separate_soa_row';
if(scenario==='waived')Object.assign(listing,{lmfAmount:0,tcpAmount:780000,soa_selected_lmf_amount:78000});
const soaRows=['pricing','historical'].includes(scenario)?[
  {id:101,description:'1st Monthly',scheduleType:'monthly',interest:1234.56,dueAmount:10000,totalDue:10000,amountPaid:10000,paidInterestAmount:1234.56,status:'Paid'},
  {id:102,description:'2nd Monthly',scheduleType:'monthly',interestAmount:2345.67,dueAmount:10000,totalDue:10000,amountPaid:1000,paidInterestAmount:1000,status:'Partial'},
  {id:103,description:'3rd Monthly',scheduleType:'monthly',interest_amount:3456.78,dueAmount:10000,totalDue:10000,amountPaid:0,status:'Unpaid'},
  {id:104,description:'Cancelled Monthly',scheduleType:'monthly',interest:99999.99,dueAmount:100000,totalDue:100000,status:'Cancelled'},
]:[];
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});client.setQueryData(['currentUser'],{user:{id:1,role,permissions:Object.values(PERMISSIONS)}});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/projects/lot-projects/qa-project/listings/1']}><Routes><Route path='/projects/lot-projects/:projectSlug/listings/:listingId' element={<TabErrorBoundary>{params.get('view')==='unit'?<UnitStatus listing={listing} canEditListing/>:<PaymentsSOA listing={listing} payments={payments} soaRows={soaRows} readOnly={scenario==='historical'} canCreate canEdit canDelete/>}</TabErrorBoundary>}/></Routes></MemoryRouter></QueryClientProvider>);
`);
const css=readdirSync(resolve(root,'CLIENT/SYSTEM/dist/assets')).find(file=>file.startsWith('index-')&&file.endsWith('.css'));
const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/@fs/${path('CLIENT/SYSTEM/dist/assets/'+css)}"></head><body><div id="root"></div><script type="module" src="/@vite/client"></script><script type="module" src="/@fs/${entry.replaceAll('\\','/')}"></script></body></html>`;
const server=await createServer({configFile:false,envDir:false,root:resolve(root,'CLIENT/SYSTEM'),resolve:{dedupe:['react','react-dom','react-router-dom','@tanstack/react-query']},css:{postcss:{plugins:[]}},define:{'import.meta.env.VITE_API_URL':JSON.stringify('/api/v1')},plugins:[{name:'qa-payments-harness',configureServer(dev){dev.middlewares.use((req,res,next)=>{if(req.url?.split('?')[0]!=='/')return next();res.setHeader('Content-Type','text/html');res.end(html)})}}],server:{host:'127.0.0.1',port:4187,strictPort:true,fs:{allow:[root]}}});
await server.listen();
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),checks=[],errors=[],mutations=[];page.setDefaultTimeout(15000);
page.on('pageerror',error=>errors.push(error.message));
await context.route('**/*',async route=>{const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();if(url.pathname.startsWith('/api/v1/')){mutations.push({method:route.request().method(),path:url.pathname});
if(url.pathname.endsWith('/payments/preview')){
 const input=route.request().postDataJSON(),due=new URL(page.url()).searchParams.get('scenario')==='settlement-due',review=input.settlementReview||{},hasReason=Boolean(review.reason?.trim());
 const reviewRequired=due&&(!hasReason||!['collectible','not_collectible'].includes(review.interest)||!['collectible','not_collectible'].includes(review.penalties));
 const interest=due?100:0,penalty=due?25:0,total=1000+(review.interest==='collectible'?interest:0)+(review.penalties==='collectible'?penalty:0);
 return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,paymentDate:input.paymentDate,fullPaymentAmount:total,fullSummary:{version:1,principalOutstanding:1000,interestOutstanding:interest,penaltyOutstanding:penalty,excludedFutureInterest:248.22,separateLmfOutstanding:0,lmfIncludedInPrincipal:true,collectibleInterest:review.interest==='collectible'?interest:0,collectiblePenalties:review.penalties==='collectible'?penalty:0,totalPayable:total,review:{interest:review.interest||'review',penalties:review.penalties||'review',reason:review.reason?.trim()||''},reviewRequired,reviewReasons:reviewRequired?['Review charge collectibility and record the applicable rule.']:[]}})});
}
return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({success:true,data:[]})})}return route.continue()});
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png')}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function open(scenario='reservation',role='super_admin'){await page.goto(`http://127.0.0.1:4187/?scenario=${scenario}&role=${role}`);await page.getByRole('heading',{name:'Payments & SOA',exact:true}).waitFor()}
try{
  await check('Contract summary uses account prices and totals paid, partial and unpaid interest without cancelled rows',async()=>{
    await open('pricing');const summary=page.getByRole('group',{name:'Contract price breakdown',exact:true});
    for(const [label,amount] of [['Base Selling Price',780000],['LMF Amount',78000],['Total Interest Amount',7037.01],['TCP',858000]]){
      const formatted=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(amount);
      await summary.getByText(label,{exact:true}).locator('..').getByText(formatted,{exact:true}).waitFor();
    }
    await page.locator('select').filter({has:page.locator('option[value="Downpayment"]')}).selectOption('Downpayment');
    await summary.getByText('₱7,037.01',{exact:true}).waitFor();assert.equal(mutations.filter(request=>request.method!=='GET').length,0);
    await page.screenshot({path:resolve(out,'contract-summary-desktop.png')});
    for(const width of [320,390,768,1440]){
      await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
      for(const value of await summary.locator('p.text-2xl').all())assert.ok(await value.evaluate(node=>node.scrollWidth<=node.clientWidth+1));
      if(width===390)await page.screenshot({path:resolve(out,'contract-summary-mobile.png')});
    }
  });
  await check('Cash pricing, zero LMF and historical accounts retain their correct contract amounts',async()=>{
    const currency=amount=>new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(amount);
    for(const [scenario,base,lmf,tcp,interest] of [['cash',740000,74000,814000,0],['waived',780000,0,780000,0],['historical',780000,78000,858000,7037.01]]){
      await open(scenario);const summary=page.getByRole('group',{name:'Contract price breakdown',exact:true});
      for(const [label,amount] of [['Base Selling Price',base],['LMF Amount',lmf],['TCP',tcp],['Total Interest Amount',interest]])await summary.getByText(label,{exact:true}).locator('..').getByText(currency(amount),{exact:true}).waitFor();
      if(scenario==='historical')assert.equal(await page.getByRole('button',{name:'Add Payment',exact:true}).count(),0);
    }
  });
  await check('Base price shows saved area, selected price and payment mode; LMF shows its saved payment arrangement',async()=>{
    for(const [scenario,calculation,mode,lmf] of [
      ['pricing','120 sqm × ₱6,500.00/sqm','Installment','Included in monthly'],
      ['cash','100 sqm × ₱7,400.00/sqm','Cash','Included in cash balance'],
      ['pay-later','120 sqm × ₱6,500.00/sqm','Installment','Pay later'],
      ['cash-later','100 sqm × ₱7,400.00/sqm','Cash','Pay later'],
      ['historical','120 sqm × ₱6,500.00/sqm','Installment','Included in monthly'],
    ]){
      await open(scenario);const summary=page.getByRole('group',{name:'Contract price breakdown',exact:true});
      const base=summary.getByText('Base Selling Price',{exact:true}).locator('..'),fee=summary.getByText('LMF Amount',{exact:true}).locator('..');
      await base.getByText(calculation,{exact:true}).waitFor();await base.getByText(mode,{exact:true}).waitFor();await fee.getByText(lmf,{exact:true}).waitFor();
    }
    await open('pricing');await page.screenshot({path:resolve(out,'contract-details-desktop.png')});
    await page.setViewportSize({width:390,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,'contract-details-mobile.png')});await page.setViewportSize({width:1440,height:1000});
    assert.equal(mutations.filter(request=>request.method!=='GET').length,0);
  });
  await check('Void opens owner authorization without crashing the Payments tab or submitting a mutation',async()=>{
    await open();await page.getByRole('button',{name:'Void',exact:true}).first().click();await page.getByRole('heading',{name:'Void Payment',exact:true}).waitFor();await page.getByText('Super Admin Password *',{exact:true}).waitFor();assert.equal(await page.getByText('This tab could not be displayed',{exact:true}).count(),0);assert.equal(mutations.filter(r=>r.method!=='GET').length,0);await page.screenshot({path:resolve(out,'void-owner.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check('System Admin and Accounting Head retain their correct authorization flows',async()=>{
    for(const role of ['system_admin','accounting_head']){await open('reservation',role);await page.getByRole('button',{name:'Void',exact:true}).first().click();await page.getByRole('heading',{name:'Void Payment',exact:true}).waitFor();if(role==='system_admin')await page.getByText('System Admin Password *',{exact:true}).waitFor();else{await page.getByRole('button',{name:'Check Correction Authority',exact:true}).waitFor();assert.equal(await page.locator('input[type=password]').count(),0)}await page.getByRole('button',{name:'Cancel',exact:true}).click()}
  });
  await check('Reservation keeps First Due Date editable while other recorded-payment terms stay locked',async()=>{
    await open();await page.getByRole('button',{name:'Edit SOA Terms',exact:true}).click();assert.equal(await page.getByLabel('Downpayment %',{exact:true}).isDisabled(),true);await page.getByRole('button',{name:'Next: Schedule & Penalty',exact:true}).click();const date=page.getByLabel(/^First Due Date/);assert.equal(await date.isDisabled(),false);await date.fill('2026-12-01');assert.equal(await date.inputValue(),'2026-12-01');await page.screenshot({path:resolve(out,'reservation-first-due-editable.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check('A recorded downpayment locks First Due Date; a cancelled downpayment does not',async()=>{
    for(const scenario of ['downpayment','cancelled-dp']){await open(scenario);await page.getByRole('button',{name:'Edit SOA Terms',exact:true}).click();await page.getByRole('button',{name:'Next: Schedule & Penalty',exact:true}).click();assert.equal(await page.getByLabel(/^First Due Date/).isDisabled(),scenario==='downpayment');await page.getByRole('button',{name:'Cancel',exact:true}).click()}
  });
  await check('SOA review shows the buyer’s saved 11.5% interest instead of the 0% listing default',async()=>{
    await open();await page.getByRole('button',{name:'Edit SOA Terms',exact:true}).click();await page.getByText('SOA Annual Interest Rate',{exact:true}).waitFor();await page.getByText('11.50%',{exact:true}).waitFor();await page.getByRole('button',{name:'Next: Schedule & Penalty',exact:true}).click();await page.getByText('Interest: 11.50%',{exact:true}).waitFor();await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check('Unit information shows the SOA rate and the protected listing form explains its separate default',async()=>{
    await page.goto('http://127.0.0.1:4187/?view=unit');await page.getByText('11.50%',{exact:true}).waitFor();await page.getByRole('button',{name:'Edit',exact:true}).click();await page.getByText("Listing default, locked after reservation/sale. This buyer's SOA rate is 11.50%.",{exact:true}).waitFor();await page.screenshot({path:resolve(out,'listing-default-and-soa-interest.png')});assert.equal(await page.getByLabel(/^Annual Interest Rate/).isDisabled(),true);
  });
  await check('Unpaid scheduled interest helper excludes paid interest and cancelled rows',async()=>{
    await open('pricing');const expected=new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP',minimumFractionDigits:2}).format(4802.45);
    await page.getByText('Includes '+expected+' in unpaid scheduled interest.',{exact:true}).waitFor();
  });
  await check('Full Payment shows the dated payoff and excluded interest without a gross-schedule fallback',async()=>{
    await open('pricing');await page.getByRole('button',{name:'Add Payment',exact:true}).click();await page.getByRole('button',{name:'Continue to Payment',exact:true}).click();await page.getByLabel(/^Payment Type/).selectOption('Full Payment');
    await page.getByText(/^Future scheduled interest excluded:/).waitFor();
    const amount=page.getByLabel(/^Amount/);await page.waitForFunction(()=>document.querySelector('input[type=number]')?.value==='1000.00');assert.equal(await amount.isDisabled(),true);assert.equal(await amount.inputValue(),'1000.00');
    await page.getByLabel(/^Payment Date/).fill('2026-11-17');await page.getByText('Settlement breakdown \u00b7 2026-11-17',{exact:true}).waitFor();
    await page.getByText(/LMF is included in remaining principal; no extra amount is added/).waitFor();
    await page.screenshot({path:resolve(out,'full-payment-breakdown.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  await check('Charge decisions keep posting blocked until collectibility and basis are reviewed',async()=>{
    await open('settlement-due');await page.getByRole('button',{name:'Add Payment',exact:true}).click();await page.getByRole('button',{name:'Continue to Payment',exact:true}).click();await page.getByLabel(/^Payment Type/).selectOption('Full Payment');
    await page.getByLabel(/^Already-due interest treatment/).waitFor();
    const submit=page.locator('form').getByRole('button',{name:'Add Payment',exact:true});assert.equal(await submit.isDisabled(),true);
    await page.getByLabel(/^Already-due interest treatment/).selectOption('collectible');await page.getByLabel(/^Outstanding penalties treatment/).selectOption('not_collectible');
    const basis=page.getByLabel(/^Applicable rule \/ approved basis/);await basis.pressSequentially('Approved synthetic account rules',{delay:10});assert.equal(await basis.inputValue(),'Approved synthetic account rules');assert.equal(await basis.evaluate(node=>node===document.activeElement),true);
    await page.waitForFunction(()=>document.querySelector('form button[type=submit]')?.disabled===false&&document.querySelector('input[type=number]')?.value==='1100.00');
    assert.equal(await page.getByLabel(/^Amount/).inputValue(),'1100.00');
    await page.screenshot({path:resolve(out,'full-payment-charge-review.png')});await page.getByRole('button',{name:'Cancel',exact:true}).click();
  });
  assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors,mutations},null,2));await browser.close();await server.close()}
if(checks.some(result=>result.status!=='PASS'))process.exitCode=1;
