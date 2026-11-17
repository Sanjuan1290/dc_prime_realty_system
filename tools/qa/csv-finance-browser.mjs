// Actual builds, local APIs and synthetic QA accounts only.
import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
import {parseUpload} from '../../SERVER/FINANCE/src/importFile.js';
const base='http://127.0.0.1:4179',secret='qa-csv-signing-key-only-'.repeat(3),out=resolve('QA_REPORTS/evidence/csv-finance');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true}),page=await context.newPage(),checks=[],errors=[];page.setDefaultTimeout(12000);
await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());page.on('pageerror',error=>errors.push(error.message));
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message});await page.screenshot({path:resolve(out,'failure-'+checks.length+'.png')}).catch(()=>{})}console.log(JSON.stringify(checks.at(-1)))}
async function login(path,email){
 await page.goto(base+path);const input=page.locator('input[type=email]');await input.waitFor();await input.fill(email);await page.getByLabel('Password',{exact:true}).fill('Synthetic-QA-only-2026!');await page.getByRole('button',{name:/^Sign in/}).click();
 if(path.startsWith('/system'))await page.waitForURL('**/system/portal/super_admin**');
 else if(path.startsWith('/hr'))await page.waitForURL('**/hr/employees');else await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();
}
const fits=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
let hrFile;
try{
 await check('Company Finances has one Finance CSV export, which downloads an importable signed file',async()=>{
  await login('/system/portal','system@qa.invalid');await page.goto(base+'/system/portal/super_admin/company-finances');await page.getByRole('heading',{name:'Company Finances',level:1,exact:true}).waitFor();
  await page.getByLabel('Date range',{exact:true}).selectOption('custom');await page.getByLabel('From date',{exact:true}).fill('2026-10-01');await page.getByLabel('To date',{exact:true}).fill('2026-10-31');
  const button=page.getByRole('button',{name:'Export to Finance (CSV)',exact:true});await button.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Export to Finance (CSV)')&&!b.disabled));
  assert.equal(await page.getByRole('button',{name:/Excel report|Export CSV \(all pages\)|Export to Finance \((ZIP|Excel)\)/}).count(),0);assert.equal(await page.getByRole('button',{name:/Export/}).count(),1);
  const download=page.waitForEvent('download');await button.click();const file=await download;assert.match(file.suggestedFilename(),/\.csv$/);const filePath=resolve(out,'company-finances.csv');await file.saveAs(filePath);const parsed=await parseUpload({format:'csv',buffer:readFileSync(filePath)},{secret});assert.ok(parsed.rows.length);await fits();await page.screenshot({path:resolve(out,'company-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'company-mobile.png'),fullPage:true});await page.setViewportSize({width:1440,height:1000});
 });
 await check('Payroll header opens a responsive CSV-only export dialog; Escape restores focus',async()=>{
  await login('/hr/login','hr@qa.invalid');await page.getByRole('link',{name:'Payroll',exact:true}).click();const button=page.getByRole('button',{name:'Export to Finance (CSV)',exact:true});await button.waitFor();assert.equal(await page.getByRole('button',{name:'Export Summary',exact:true}).count(),0);await button.click();
  let dialog=page.getByRole('dialog',{name:'Export to Finance (CSV)',exact:true});await dialog.waitFor();assert.equal(await dialog.getByRole('combobox').count(),0);await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await button.evaluate(node=>node===document.activeElement),true);
  await button.click();dialog=page.getByRole('dialog',{name:'Export to Finance (CSV)',exact:true});await page.getByLabel('Released from',{exact:true}).fill('2026-10-01');await page.getByLabel('Released to',{exact:true}).fill('2026-10-31');await dialog.evaluate(node=>Promise.all(node.getAnimations().map(animation=>animation.finished)));await page.screenshot({path:resolve(out,'payroll-export-desktop.png')});await page.setViewportSize({width:390,height:844});await fits();await page.screenshot({path:resolve(out,'payroll-export-mobile.png')});await page.setViewportSize({width:1440,height:1000});
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download Finance CSV',exact:true}).click();const file=await download;assert.match(file.suggestedFilename(),/\.csv$/);hrFile=resolve(out,'hr-payroll.csv');await file.saveAs(hrFile);const parsed=await parseUpload({format:'csv',buffer:readFileSync(hrFile)},{secret});assert.ok(parsed.rows.every(row=>row.source_system==='hr'));await page.getByRole('status').filter({hasText:'Finance CSV downloaded.'}).waitFor();await dialog.getByRole('button',{name:'Close',exact:true}).click();
 });
 await check('Finance accepts CSV only, rejects altered downloads and previews the untouched original',async()=>{
  await login('/finance','admin@qa.invalid');await page.getByRole('button',{name:'Imports',exact:true}).click();const input=page.getByLabel('Finance export file',{exact:true});assert.equal(await input.getAttribute('accept'),'.csv');
  await input.setInputFiles({name:'not-allowed.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from('bad')});await page.getByRole('alert').filter({hasText:'Choose a supported file'}).waitFor();assert.equal(await page.getByRole('button',{name:'Review file',exact:true}).isDisabled(),true);
  const edited=Buffer.from(readFileSync(hrFile,'utf8').replace('Salary payment #','Modified salary #'));await input.setInputFiles({name:'edited.csv',mimeType:'text/csv',buffer:edited});await page.getByRole('button',{name:'Review file',exact:true}).click();await page.getByRole('alert').filter({hasText:'changed or could not be verified'}).waitFor();
  await input.setInputFiles(hrFile);await page.getByRole('button',{name:'Review file',exact:true}).click();await page.getByRole('region',{name:'Import preview'}).waitFor();await fits();await page.screenshot({path:resolve(out,'finance-csv-preview.png'),fullPage:true});assert.equal(await page.getByText('Match source categories',{exact:true}).count(),0);
 });
 assert.deepEqual(errors,[]);
}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close()}
if(checks.some(check=>check.status!=='PASS'))process.exitCode=1;
