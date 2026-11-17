// Each suite changes the isolated ledger. Run sequentially so balance checks
// cannot interfere with one another. setup-local-db --reset must run first.
import {spawn} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
const allFiles=['api.e2e.test.mjs','csv-finance.e2e.test.mjs','pdf-features.e2e.test.mjs','import-undo.e2e.test.mjs','pdf3-live-operation.e2e.test.mjs','scheduled-hours.e2e.test.mjs'];
const selected=process.argv.slice(2),files=selected.length?allFiles.filter(file=>selected.includes(file)):allFiles;
if (!files.length) throw new Error('Select a known suite filename.');
const resultPath='QA_REPORTS/evidence/pdf3-api-results.json';
const previous=selected.length&&existsSync(resultPath)?JSON.parse(readFileSync(resultPath,'utf8')):[];
const results=[];
for(const file of files){
  const name=file.replace('.e2e.test.mjs',''),path=`QA_REPORTS/evidence/pdf3-${name}.log`,fd=openSync(path,'w');
  const code=await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,['--test','tools/qa/'+file],{windowsHide:true,stdio:['ignore',fd,fd]});
    child.on('error',reject);child.on('exit',resolve);
  });closeSync(fd);
  const output=readFileSync(path,'utf8');
  const count=Number(output.match(/^# tests (\d+)/m)?.[1]||0);
  results.push({file,passed:code===0,tests:count,log:path});
  console.log(JSON.stringify(results.at(-1)));
  if(code!==0){console.log(output.slice(-4000));process.exitCode=1;break}
}
writeFileSync(resultPath,JSON.stringify([...previous.filter(result=>!files.includes(result.file)),...results],null,2));
