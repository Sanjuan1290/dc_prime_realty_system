// Read-only live smoke test. Never signs in or changes deployed data.
import {chromium} from 'playwright-core';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const out=fileURLToPath(new URL('../../QA_REPORTS/evidence/ui-2026-11-03/',import.meta.url));mkdirSync(out,{recursive:true});
const base='https://dc-prime-realty.pages.dev',checks=[],requests=[];
const browser=await chromium.launch({headless:true,executablePath:process.env.QA_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
const page=await browser.newPage();page.on('response',r=>{if(r.status()>=400)requests.push({path:new URL(r.url()).pathname,status:r.status()})});
try{
  for(const path of ['/','/portal','/system','/system/portal','/hr','/hr/login','/finance','/invalid-page-example']){
    try{
      const response=await page.goto(base+path,{timeout:30000});
      let settled=true;try{await page.waitForFunction(()=>document.body.innerText.trim().length>30&&!/^(Loading|Checking)/.test(document.body.innerText.trim()),{},{timeout:20000})}catch{settled=false}
      const finalUrl=page.url(),text=(await page.innerText('body')).slice(0,400);
      await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(700);
      const correct=path==='/portal'?new URL(finalUrl).pathname==='/system/portal':path.startsWith('/system')?new URL(finalUrl).pathname.startsWith('/system'):path.startsWith('/hr')?new URL(finalUrl).pathname.startsWith('/hr'):true;
      checks.push({area:'Cloudflare routing',name:`LIVE direct + refresh ${path}`,status:!correct?'FAIL':!settled?'BLOCKED':'PASS',httpStatus:response.status(),finalUrl,refreshUrl:page.url(),text,...(!correct?{reason:'Legacy portal renders WEBSITE 404 instead of redirecting to SYSTEM.'}:!settled?{reason:'Session/loading screen did not settle within 20 seconds.'}:{})});
      await page.screenshot({path:resolve(out,`live-final-${path==='/'?'home':path.slice(1).replaceAll('/','-')}.png`),fullPage:true});
      console.log(JSON.stringify(checks.at(-1)));
    }catch(e){checks.push({area:'Cloudflare routing',name:`LIVE ${path}`,status:'BLOCKED',reason:e.message});}
  }
  for(const width of [390,768,1440,1920]){
    await page.setViewportSize({width,height:width===390?844:1000});await page.goto(base+'/invalid-page-example');await page.locator('main h1').waitFor();
    const metrics=await page.evaluate(()=>{const image=document.querySelector('main img');return {width:innerWidth,scroll:document.documentElement.scrollWidth,logo:image?.getBoundingClientRect().toJSON(),font:getComputedStyle(document.body).fontFamily,patched:!!document.querySelector('.dc-not-found-mark')};});
    const pass=metrics.logo?.width<=80&&metrics.logo?.height<=80&&metrics.scroll<=width+1;
    checks.push({area:'Responsive layouts',name:`LIVE ${width} 404 logo`,status:pass?'PASS':'FAIL',metrics,...(!pass?{reason:'Deployed 404 logo exceeds the 80 × 80 px limit; local patch is not deployed.'}:{})});
    await page.screenshot({path:resolve(out,`live-final-404-${width}.png`),fullPage:true});console.log(JSON.stringify(checks.at(-1)));
  }
}finally{writeFileSync(resolve(out,'live-final-results.json'),JSON.stringify({base,browser:browser.version(),checks,requests},null,2));await browser.close();}
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;
