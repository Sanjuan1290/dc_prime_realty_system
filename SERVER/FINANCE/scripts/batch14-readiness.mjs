import {readFileSync} from 'node:fs';
import {reviewLaunchEvidence,GATES} from '../src/launchGates.js';
if(process.argv.includes('--template')){
  console.log(JSON.stringify({finance_reconciliation:{reconciliation_passed:false,launch_approved:false},gates:Object.fromEntries(GATES.map(([key])=>[key,{status:'pending',reference:'',reviewer:'',verified_on:''}]))},null,2));
  process.exit(0);
}
const file=process.argv[2];
if(!file){console.error('Usage: node scripts/batch14-readiness.mjs --template | evidence.json');process.exit(2);}
try{
  const evidence=JSON.parse(readFileSync(file,'utf8'));
  const result=reviewLaunchEvidence(evidence);
  console.log(JSON.stringify(result,null,2));
  if(!result.pass_for_manual_review)process.exitCode=1;
}catch(e){console.error('Invalid or missing evidence file:',e.message);process.exitCode=2;}
