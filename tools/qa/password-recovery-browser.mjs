// Real production builds and local APIs. Tokens belong only to synthetic QA users.
import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4179',fixtures=JSON.parse(readFileSync('QA_REPORTS/.runtime/reset-browser-fixtures.json','utf8')),out=resolve('QA_REPORTS/evidence/password-recovery');mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),checks=[],errors=[];
async function check(name,action){try{await action();checks.push({name,status:'PASS'})}catch(error){checks.push({name,status:'FAIL',reason:error.message})}console.log(JSON.stringify(checks.at(-1)))}
try{for(const app of ['finance','hr']){
 const context=await browser.newContext({viewport:{width:1366,height:1000}});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push({app,message:e.message}));const path=app==='finance'?'/finance':'/hr/login',user=fixtures[app];
 await check(`${app}: password toggle and forgot-password email form work on desktop and mobile`,async()=>{
   await page.goto(base+path);const password=page.getByLabel('Password',{exact:true});await password.fill('Synthetic-hidden-password');await page.getByRole('button',{name:'Show password',exact:true}).click();assert.equal(await password.getAttribute('type'),'text');await page.getByRole('button',{name:'Hide password',exact:true}).click();assert.equal(await password.getAttribute('type'),'password');
   await page.getByRole('button',{name:'Forgot password?',exact:true}).click();await page.getByLabel(app==='finance'?'Finance email':'HR email',{exact:true}).fill('no-mail-synthetic@qa.invalid');
   await page.getByRole('button',{name:'Email reset link',exact:true}).click();await page.getByRole('alert').filter({hasText:'Password reset email is unavailable.'}).waitFor();
   assert.equal(await page.getByRole('heading',{name:'Forgot password?',exact:true}).count(),1);await page.screenshot({path:resolve(out,app+'-forgot-desktop.png')});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:resolve(out,app+'-forgot-mobile.png')});
 });
 await check(`${app}: private email link resets a password, clears URL token and signs in with the new password`,async()=>{
   await page.setViewportSize({width:1366,height:1000});await page.goto(base+path+'#reset-password='+user.token);await page.getByRole('heading',{name:'Choose a new password',exact:true}).waitFor();assert.equal(new URL(page.url()).hash,'');assert.equal(await page.getByRole('alert').count(),0);
   await page.getByLabel('New password',{exact:true}).fill(user.password);await page.getByLabel('Confirm new password',{exact:true}).fill(user.password);await page.screenshot({path:resolve(out,app+'-reset-desktop.png')});await page.getByRole('button',{name:'Save new password',exact:true}).click();await page.getByText('Password changed. Sign in with your new password.',{exact:true}).waitFor();await page.getByRole('button',{name:'Back to sign in',exact:true}).click();
   await page.getByLabel(app==='finance'?'Email':'HR email',{exact:true}).fill(user.email);await page.getByLabel('Password',{exact:true}).fill(user.password);await page.getByRole('button',{name:app==='finance'?'Sign in':'Sign in to HR',exact:true}).click();
   // A Finance viewer sees Dashboard; an HR identity without module grants sees its landing message.
   if(app==='finance')await page.getByRole('heading',{name:'Dashboard',exact:true}).waitFor();else await page.getByText('No HR modules are assigned to this account.',{exact:true}).waitFor();
 });await context.close();
}assert.deepEqual(errors,[]);}finally{writeFileSync(resolve(out,'browser-results.json'),JSON.stringify({checks,errors},null,2));await browser.close()}
if(checks.some(c=>c.status!=='PASS'))process.exitCode=1;
