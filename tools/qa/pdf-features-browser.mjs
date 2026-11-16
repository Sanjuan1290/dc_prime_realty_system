import {chromium} from 'playwright-core';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url)),out=resolve(root,'QA_REPORTS/evidence/pdf-features');mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:4179',checks=[],exceptions=[];
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>exceptions.push(e.message));page.on('dialog',dialog=>dialog.accept());
async function check(name,fn){try{await fn();checks.push({name,status:'PASS'})}catch(e){checks.push({name,status:'FAIL',reason:e.message})}console.log(JSON.stringify(checks.at(-1)))}
async function login(path,email,password='Synthetic-QA-only-2026!'){await page.goto(base+path);await page.locator('input[type=email]').fill(email);await page.locator('input[type=password]').fill(password);await page.getByRole('button',{name:/^Sign in/}).click()}
async function screenshot(name){assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:resolve(out,name+'.png'),fullPage:true})}
try{
  await check('Finance Users: invitation form has no administrator password field',async()=>{
    await login('/finance','admin@qa.invalid');await page.getByRole('button',{name:'Users',exact:true}).click();await page.getByRole('heading',{name:'Finance accounts'}).waitFor();assert.equal(await page.locator('input[type=password]').count(),0);await page.getByRole('button',{name:'Send account invitation',exact:true}).waitFor();await screenshot('finance-users');
  });
  await check('Finance Imports: automatic categories, no mapping controls and mobile layout',async()=>{
    await page.getByRole('button',{name:'Imports',exact:true}).click();await page.getByRole('heading',{name:'Import payments'}).waitFor();assert.equal(await page.getByRole('heading',{name:'Match source categories'}).count(),0);await page.getByText('Categories come directly from your file. Your balance changes only after you confirm.').waitFor();await screenshot('finance-imports');await page.setViewportSize({width:390,height:844});await screenshot('finance-imports-mobile');await page.setViewportSize({width:1440,height:1000});
  });
  await check('Invited Finance user must choose their own password in the browser',async()=>{
    await context.clearCookies();const invitation=JSON.parse(readFileSync(resolve(root,'QA_REPORTS/.runtime/browser-invitation.json'),'utf8'));await login('/finance',invitation.email,invitation.password);await page.getByRole('heading',{name:'Choose your password'}).waitFor();assert.equal(await page.getByRole('navigation',{name:'Finance navigation'}).count(),0);await screenshot('finance-password-setup');await page.getByLabel('Temporary password',{exact:true}).fill(invitation.password);await page.getByLabel('New password (12–128 characters)',{exact:true}).fill('Browser-owned-private-password-2026!');await page.getByLabel('Confirm new password',{exact:true}).fill('Browser-owned-private-password-2026!');await page.getByRole('button',{name:'Set password and open Finance'}).click();await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Users',exact:true}).count(),0);
  });
  await check('HR: live employee creation controls and audit detail access',async()=>{
    await login('/hr/login','hr@qa.invalid');await page.waitForURL('**/hr/employees');assert.equal(await page.getByText('HR staging: read-only.',{exact:true}).count(),0);await page.getByRole('button',{name:'Add Employee',exact:true}).waitFor();await page.getByRole('link',{name:'Audit log',exact:true}).click();await page.getByRole('heading',{name:'HR & Payroll audit log'}).waitFor();await page.getByRole('button',{name:'View details',exact:true}).first().click();await page.getByRole('dialog',{name:'Audit event details'}).waitFor();await screenshot('hr-audit');await page.getByRole('button',{name:'Close',exact:true}).click();
  });
  await check('HR: released payroll exports download as ZIP and Excel from the live form',async()=>{
    await page.getByRole('link',{name:'Payroll',exact:true}).click();await page.getByText('Export salary payments to Finance',{exact:true}).click();await page.getByLabel('Released from',{exact:true}).fill('2026-10-01');await page.getByLabel('Released to',{exact:true}).fill('2026-10-31');
    for(const format of ['zip','xlsx']){await page.getByLabel('Format',{exact:true}).selectOption(format);const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Finance export',exact:true}).click();const file=await download;await file.saveAs(resolve(out,'hr-salary.'+format));assert.equal(await file.failure(),null)}await screenshot('hr-finance-export');
  });
  assert.deepEqual(exceptions,[]);
}finally{writeFileSync(resolve(out,'results.json'),JSON.stringify({checks,exceptions},null,2));await browser.close()}
if(checks.some(c=>c.status!=='PASS'))process.exitCode=1;
