// Start the guarded local MySQL and serve-local adapter before running this.
import {spawn} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const evidence=resolve('QA_REPORTS/evidence');mkdirSync(evidence,{recursive:true});
const checks=[['pdf10-review-api','--test','tools/qa/pdf10-review.e2e.test.mjs'],['pdf10-security-api','--test','tools/qa/pdf10-security.e2e.test.mjs'],['pdf10-atomic-api','--test','tools/qa/pdf10-atomic.e2e.test.mjs'],['pdf10-browser','tools/qa/pdf10-browser.mjs']];
const results=[];
for(const [name,...args] of checks){
 const fd=openSync(resolve(evidence,name+'.log'),'w');
 const exitCode=await new Promise(done=>{const child=spawn(process.execPath,args,{env:process.env,windowsHide:true,stdio:['ignore',fd,fd]});child.on('error',()=>done(-1));child.on('exit',done)});closeSync(fd);
 const log=readFileSync(resolve(evidence,name+'.log'),'utf8'),passed=Number(log.match(/# pass (\d+)/)?.[1]||0),failed=Number(log.match(/# fail (\d+)/)?.[1]||0);
 results.push({name,exitCode,...(name==='pdf10-browser'?{}:{passed,failed})});console.log(JSON.stringify(results.at(-1)));
 if(exitCode!==0){console.error(log.slice(-5000));process.exitCode=1;break}
}
writeFileSync(resolve(evidence,'pdf10-api-results.json'),JSON.stringify(results,null,2));
