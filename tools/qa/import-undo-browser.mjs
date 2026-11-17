import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {canonicalCsv,revision,sha256,summarize} from '../../SERVER/FINANCE/src/importContract.js';
import {buildSignedFinanceCsv} from '../../SERVER/HR/services/financeTransferCsv.js';
process.env.FINANCE_TRANSFER_SIGNING_SECRET='qa-csv-signing-key-only-'.repeat(3);
const root=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(root,'QA_REPORTS/evidence/import-undo');mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4179',run=Date.now(),filename=`browser-payments-${run}.csv`,filePath=resolve(out,filename),checks=[],exceptions=[],requests=[];
const rows=[['income','500.10','Browser income'],['expense','123.45','Browser payroll']].map(([kind,amount,category],index)=>{const row={schema_version:'1.0',source_system:'realty',source_transaction_id:`manual:${run}${index+1}`,source_version:'1',transaction_date:'2026-10-25',recorded_at:'2026-10-25 12:00:00',transaction_type:kind,category:category+' '+run,description:category+' payment '+run,amount,currency:'PHP',status:'posted',reference_id:'',source_type:'manual'};return {...row,source_revision_sha256:revision(row)}});
const csv=canonicalCsv(rows),manifest={schema_version:'1.0',source_system:'realty',export_id:randomUUID(),generated_at:'2026-10-31T00:00:00Z',currency:'PHP',period:{from:'2026-10-01',to:'2026-10-31'},filters:{kind:'all',source:'all',category:'all'},status_scope:'posted_only',salary_source:'legacy',warnings:[],reconciled:true,snapshot:summarize(rows),context:{},transactions_sha256:sha256(csv),checksum_algorithm:'sha256',data_file:'transactions.csv'};
writeFileSync(filePath,await buildSignedFinanceCsv({rows,csv,manifest}));
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();page.setDefaultTimeout(12000);
page.on('pageerror',error=>exceptions.push(error.message));page.on('request',request=>{if(request.url().startsWith(base))requests.push({path:new URL(request.url()).pathname,method:request.method()})});
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function screenshot(name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,name+'.png'),fullPage:await page.getByRole('dialog').count()===0})}
async function balance(){return page.evaluate(async()=>{const res=await fetch('/finance-api/api/v1/finance/dashboard?from=2026-10-01&to=2026-10-31');if(!res.ok)throw new Error('Dashboard failed');return (await res.json()).closing_balance})}
const cents=value=>Math.round(Number(value)*100);
let before;
const activeRow=()=>page.getByRole('row').filter({hasText:filename}).filter({has:page.getByRole('button',{name:/^Undo import/})});
const choose=()=>page.getByLabel('Finance export file').setInputFiles(filePath);
async function prepare(){await choose();await page.getByRole('button',{name:'Review file',exact:true}).click();await page.getByRole('region',{name:'Import preview'}).waitFor()}
async function importFile(){await page.getByRole('button',{name:'Import 2 payments',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Confirm import',exact:true});await dialog.getByRole('button',{name:'Confirm import',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Import complete',{exact:true}).waitFor()}
async function reviewUndo(){await activeRow().getByRole('button',{name:/^Undo import/}).click();const dialog=page.getByRole('dialog',{name:'Undo this import?',exact:true});await dialog.getByText('Balance change',{exact:true}).waitFor();return dialog}
try{
  await check('Imports open without category mapping controls; desktop and mobile layouts fit',async()=>{
    await page.goto(base+'/finance');await page.locator('input[type=email]').fill('admin@qa.invalid');await page.locator('input[type=password]').fill('Synthetic-QA-only-2026!');await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByRole('button',{name:'Imports',exact:true}).click();await page.getByRole('heading',{name:'Import payments',exact:true}).waitFor();
    assert.equal(await page.getByRole('heading',{name:'Match source categories'}).count(),0);assert.equal(await page.getByLabel('Source application').count(),0);before=await balance();await screenshot('imports-desktop');await page.setViewportSize({width:390,height:844});await screenshot('imports-mobile');await page.setViewportSize({width:1440,height:1000});
  });
  await check('Invalid files show an accessible alert and cannot be reviewed',async()=>{
    await page.getByLabel('Finance export file').setInputFiles({name:'wrong-file.txt',mimeType:'text/plain',buffer:Buffer.from('invalid')});await page.getByRole('alert').filter({hasText:'Choose a supported file'}).waitFor();assert.equal(await page.getByRole('button',{name:'Review file',exact:true}).isDisabled(),true);
  });
  await check('Preview handles source categories automatically without changing balances',async()=>{
    await prepare();await page.getByText('2 new',{exact:true}).waitFor();await page.getByText(/2 categories will be created from this file/).waitFor();assert.equal(await balance(),before);await screenshot('import-preview');
  });
  await check('Import confirmation traps keyboard focus, closes with Escape and preserves the preview',async()=>{
    await page.getByRole('button',{name:'Import 2 payments',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Confirm import',exact:true});await dialog.waitFor();assert.equal(await balance(),before);
    for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.ok(await dialog.evaluate(node=>node.contains(document.activeElement)))}
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('region',{name:'Import preview'}).count(),1);assert.equal(await balance(),before);
  });
  await check('Confirming imports exact cash once and adds an Undo action to history',async()=>{
    await importFile();assert.equal(cents(await balance())-cents(before),37665);await activeRow().waitFor();await screenshot('import-complete');
  });
  await check('Undo shows its balance impact; cancelling leaves the ledger unchanged',async()=>{
    const dialog=await reviewUndo();await dialog.getByText('-₱376.65',{exact:true}).waitFor();await screenshot('undo-review');await dialog.getByRole('button',{name:'Keep import',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(cents(await balance())-cents(before),37665);
  });
  await check('Undo removes the imported cash and keeps an Undone history record',async()=>{
    const dialog=await reviewUndo();await dialog.getByLabel('Reason',{exact:false}).fill('QA imported the wrong period');await dialog.getByRole('button',{name:'Undo import',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.getByText('Import undone',{exact:true}).waitFor();assert.equal(await balance(),before);await page.getByRole('row').filter({hasText:filename}).getByText('Undone',{exact:true}).waitFor();await screenshot('import-undone');
  });
  await check('Uploading the same file restores payments; mobile confirmation supports reduced motion',async()=>{
    await prepare();await page.getByText('2 to restore',{exact:true}).waitFor();await importFile();assert.equal(cents(await balance())-cents(before),37665);
    await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});const dialog=await reviewUndo();assert.equal(await dialog.evaluate(node=>getComputedStyle(node).animationName),'none');await screenshot('undo-mobile');await dialog.getByRole('button',{name:'Undo import',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(await balance(),before);await page.setViewportSize({width:1440,height:1000});
  });
  await check('Network failures show a recoverable alert; no manual mapping requests or uncaught errors',async()=>{
    await choose();await page.route('**/finance-api/api/v1/finance/imports/preview',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:{code:'IMPORT_DISABLED',message:'QA temporary import failure. Try again.'}})}));await page.getByRole('button',{name:'Review file',exact:true}).click();await page.getByRole('alert').filter({hasText:'QA temporary import failure'}).waitFor();assert.equal(await page.getByRole('button',{name:'Review file',exact:true}).isDisabled(),false);await page.unroute('**/finance-api/api/v1/finance/imports/preview');assert.equal(requests.filter(request=>request.path.includes('/imports/mappings')).length,0);assert.deepEqual(exceptions,[]);
  });
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,exceptions},null,2));await browser.close()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
