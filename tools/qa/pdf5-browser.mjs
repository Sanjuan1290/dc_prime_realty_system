// Actual Finance build/API on the guarded disposable DB. No email is sent.
import {chromium} from 'playwright-core';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {financeMoney} from '../../CLIENT/FINANCE/src/financeFormat.js';
Object.assign(process.env,{NODE_ENV:'test',TIDB_HOST:'127.0.0.1',TIDB_PORT:'13307',TIDB_USERNAME:'qa_finance',TIDB_PASSWORD:'qa-isolated-only-password',TIDB_DATABASE:'dc_prime_finance_db',TIDB_SSL:'false'});
const {getPool}=await import('../../SERVER/FINANCE/src/db.js');
const {createUser}=await import('../../SERVER/FINANCE/src/users.js');
const {login,changePassword,sessionHash}=await import('../../SERVER/FINANCE/src/auth.js');
const db=getPool(),[[server]]=await db.query('SELECT @@port AS port,@@datadir AS datadir');
assert.equal(server.port,13307);assert.equal(server.datadir.toLowerCase().replaceAll('\\','/').replace(/\/$/,''),resolve('QA_REPORTS/.runtime/mysql').toLowerCase().replaceAll('\\','/'));
const base='http://127.0.0.1:4179',headers={origin:base,'x-requested-with':'dcprime-finance'},out=resolve('QA_REPORTS/evidence/pdf5');mkdirSync(out,{recursive:true});
const userFixtureTag='PDF5 '+randomUUID().slice(0,8);
async function invite(name){let password;const user=await createUser({email:'qa-'+randomUUID()+'@qa.invalid',display_name:userFixtureTag+' '+name,role:'viewer'},{id:1},{checkSettings:()=>({}),mailer:async data=>{password=data.password}});return {...user,password}}
async function accept(user){const session=await login(user.email,user.password);await changePassword({financeUser:{id:user.id},financeSessionHash:sessionHash(session.token),body:{current_password:user.password,new_password:'Accepted-QA-only-password-2026!',confirm_password:'Accepted-QA-only-password-2026!'}})}
const pending=await invite('Pending Invitation QA'),expired=await invite('Expired Invitation QA'),accepted=await invite('Accepted Account QA'),stale=await invite('Accepted During Review QA');
await accept(accepted);await db.query('UPDATE finance_users SET temporary_password_expires_at=DATE_SUB(UTC_TIMESTAMP(),INTERVAL 1 DAY) WHERE id=?',[expired.id]);
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
const signedIn=await context.request.post(base+'/finance-api/api/v1/auth/login',{headers,data:{email:'admin@qa.invalid',password:'Synthetic-QA-only-2026!'}});assert.equal(signedIn.status(),200,await signedIn.text());
const page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(12000);page.on('pageerror',error=>errors.push(error.message));
const nav=name=>page.getByRole('navigation',{name:'Finance navigation'}).getByRole('button',{name,exact:true});
const userRow=user=>page.getByRole('row').filter({hasText:user.email});
async function api(path){const response=await context.request.get(base+'/finance-api/api/v1'+path,{headers});assert.equal(response.status(),200,await response.text());return response.json()}
async function fits(){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))}
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.stack});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png'),fullPage:true}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
const reportBefore=await api('/finance/reports?from=2026-11-01&to=2026-11-30');
try {
 await page.goto(base+'/finance');await nav('Reports').click();
 await check('Reports show actual totals in place of Closing balance and fit mobile/tablet/desktop',async()=>{
  const summary=page.locator('.finance-report-summary');await summary.waitFor();
  assert.equal(await summary.locator('.finance-metric').count(),4);assert.equal(await summary.getByText('Opening balance',{exact:true}).count(),0);
  assert.equal(await summary.getByText('Closing balance',{exact:true}).count(),0);
  await summary.getByRole('region',{name:'Actual money in and out',exact:true}).getByText(financeMoney(reportBefore.actual_money_out),{exact:true}).waitFor();
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:1000});await fits();await page.screenshot({path:resolve(out,'reports-'+width+'.png'),fullPage:true,animations:'disabled'})}
 });
 await check('The exported PDF uses the same gross summary and actual totals',async()=>{
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();const file=await download,path=resolve(out,'finance-report.pdf');await file.saveAs(path);
  const {getDocument}=await import('../../CLIENT/SYSTEM/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  const pdf=await getDocument({data:new Uint8Array(readFileSync(path)),isEvalSupported:false}).promise;
  let text='';for(let number=1;number<=pdf.numPages;number++)text+=(await(await pdf.getPage(number)).getTextContent()).items.map(item=>item.str).join(' ');
  assert.doesNotMatch(text,/Opening balance|Closing balance/);for(const label of ['Money in','Money out','Net cash change','Actual totals'])assert.ok(text.includes(label));
  assert.ok(text.includes(financeMoney(reportBefore.actual_money_out)));await pdf.destroy();
 });
 await check('Transaction details hide the original-import timestamp and retain its receipt metadata',async()=>{
  const entries=await api('/finance/transactions?from=2026-11-01&to=2026-11-30&page_size=100');
  const entry=entries.transactions.find(row=>row.source_system!=='manual');assert.ok(entry);
  const record=await api('/finance/transactions/'+entry.id);assert.ok(record.original_import?.committed_at);
  await nav('Transactions').click();await page.getByRole('button',{name:entry.description,exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Finance record #'+entry.id,exact:true});await dialog.waitFor();
  await dialog.getByText('Import file',{exact:true}).waitFor();await dialog.getByText(record.original_import.file_name,{exact:true}).waitFor();
  assert.equal(await dialog.getByText('Original import',{exact:true}).count(),0);
  assert.deepEqual((await api('/finance/transactions/'+entry.id)).original_import,record.original_import);
  await page.screenshot({path:resolve(out,'transaction-details.png'),animations:'disabled'});await dialog.getByRole('button',{name:'Close',exact:true}).click();
 });
 await nav('Users').click();await page.getByLabel('Search accounts').fill(userFixtureTag);await userRow(pending).waitFor();
 await check('Only unaccepted invitations offer Delete; cancellation preserves the account',async()=>{
  await userRow(pending).getByRole('button',{name:'Delete invitation',exact:true}).waitFor();await userRow(expired).getByRole('button',{name:'Delete invitation',exact:true}).waitFor();
  assert.equal(await userRow(accepted).getByRole('button',{name:'Delete invitation',exact:true}).count(),0);
  await userRow(pending).getByRole('button',{name:'Delete invitation',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Delete Finance invitation?',exact:true});await dialog.waitFor();
  await page.setViewportSize({width:320,height:844});await fits();await page.screenshot({path:resolve(out,'delete-invitation-mobile.png'),animations:'disabled'});
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await userRow(pending).waitFor();
  assert.ok((await api('/finance/users')).users.some(user=>String(user.id)===pending.id));await page.setViewportSize({width:1440,height:1000});
 });
 await check('Confirmed deletion removes pending and expired invitations through the actual API',async()=>{
  for(const user of [pending,expired]){
   await userRow(user).getByRole('button',{name:'Delete invitation',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Delete Finance invitation?',exact:true});
   const response=page.waitForResponse(r=>r.request().method()==='DELETE'&&new URL(r.url()).pathname.endsWith('/users/'+user.id));
   await dialog.getByRole('button',{name:'Delete invitation',exact:true}).click();assert.equal((await response).status(),200);await userRow(user).waitFor({state:'hidden'});
  }
  await page.getByText('Invitation deleted.',{exact:true}).waitFor();await page.screenshot({path:resolve(out,'users-after-delete.png'),animations:'disabled'});
 });
 await check('Acceptance after the page loads blocks deletion and refresh removes the stale action',async()=>{
  await accept(stale);await userRow(stale).getByRole('button',{name:'Delete invitation',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Delete Finance invitation?',exact:true});
  await dialog.getByRole('button',{name:'Delete invitation',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'Only invitations that have not been accepted'}).waitFor();
  const [[stored]]=await db.query('SELECT must_change_password FROM finance_users WHERE id=?',[stale.id]);assert.equal(stored.must_change_password,0);
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await nav('Dashboard').click();await nav('Users').click();await page.getByLabel('Search accounts').fill(userFixtureTag);
  await userRow(stale).getByText('Active',{exact:true}).waitFor();assert.equal(await userRow(stale).getByRole('button',{name:'Delete invitation',exact:true}).count(),0);
  const reportAfter=await api('/finance/reports?from=2026-11-01&to=2026-11-30');
  for(const key of ['opening_balance','money_in','money_out','closing_balance','net_change'])assert.equal(reportAfter[key],reportBefore[key]);
 });
 await check('Deletion audit retains the administrator and deleted invitation details',async()=>{
  await nav('Audit Logs').click();await page.locator('select[name="action"]').selectOption('user.invitation.deleted');
  const response=page.waitForResponse(r=>new URL(r.url()).pathname.endsWith('/finance/audit')&&new URL(r.url()).searchParams.get('action')==='user.invitation.deleted');
  await page.getByRole('button',{name:'Apply filters',exact:true}).click();assert.equal((await response).status(),200);
  const row=page.getByRole('row').filter({has:page.getByRole('cell',{name:'user #'+expired.id,exact:true})}).filter({has:page.getByRole('cell',{name:'Invitation deleted',exact:true})});
  await row.getByRole('button',{name:'View details',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Audit event details',exact:true});
  await dialog.getByText('QA admin',{exact:true}).waitFor();await dialog.getByText(expired.email,{exact:true}).waitFor();assert.equal(await dialog.locator('pre').count(),0);
  await page.screenshot({path:resolve(out,'deletion-audit.png'),animations:'disabled'});await dialog.getByRole('button',{name:'Close',exact:true}).click();
 });
 assert.deepEqual(errors,[]);
} finally {writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,errors},null,2));await browser.close();await db.end()}
if(checks.some(result=>result.status!=='PASS'))process.exitCode=1;
