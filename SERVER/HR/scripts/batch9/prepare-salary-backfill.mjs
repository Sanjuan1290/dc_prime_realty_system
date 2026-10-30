/**
 * Stage historical salary releases in HR outbox only. Does NOT send events.
 * Run ONLY on isolated HR STAGING after complete Batch 9 reconciliation.
 * `--preview` default; `--seed` requires separate explicit operator approval.
 */
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { salaryBackfillAssessment, formatTimeZoneAsUtc } from './migrationCore.mjs';
const require=createRequire(import.meta.url);const mysql=require('mysql2/promise');
const seed=process.argv.includes('--seed');
const fail=m=>{throw new Error(m);};
if(process.env.BATCH9_STAGING_ID!=='ISOLATED_NONPRODUCTION')fail('Staging guard missing');
if(process.env.BATCH9_MANILA_TIMESTAMP_CONFIRMED!=='YES')fail('Operator must verify legacy released_at DATETIME timezone before preview/seed');
if(seed&&process.env.BATCH9_APPROVE_HISTORY_OUTBOX!=='YES')fail('Historical outbox seed not approved');
if(seed&&process.env.HR_ENABLE_SALARY_DELIVERY==='true')fail('Disable delivery worker while preparing historical outbox');
function uuid(id){
  const hash=createHash('sha256').update('dc-prime-batch9-historical-salary-v1:'+id).digest('hex');
  const b=hash.slice(0,12)+'5'+hash.slice(13,16)+'a'+hash.slice(17,32);
  return `${b.slice(0,8)}-${b.slice(8,12)}-${b.slice(12,16)}-${b.slice(16,20)}-${b.slice(20,32)}`;
}
function amount(n){const value=String(n);if(!/^\d{1,12}\.\d{2}$/.test(value))fail('Invalid amount precision');return value;}
async function main(){
  const database=process.env.BATCH9_TARGET_DATABASE;
  if(database!=='dc_prime_hr_db')fail('Incorrect target database');
  const cn=await mysql.createConnection({host:process.env.BATCH9_TARGET_HOST,port:Number(process.env.BATCH9_TARGET_PORT||4000),user:process.env.BATCH9_TARGET_USER,password:process.env.BATCH9_TARGET_PASSWORD,database,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true,
    ssl:process.env.BATCH9_TARGET_SSL_CA_FILE?{ca:fs.readFileSync(process.env.BATCH9_TARGET_SSL_CA_FILE)}:(process.env.BATCH9_TARGET_TLS==='true'?{rejectUnauthorized:true}:undefined)});
  try{
    const [[db]]=await cn.query('SELECT DATABASE() AS name');if(db.name!=='dc_prime_hr_db')fail('Unexpected database');
    const [existing]=await cn.query('SELECT COUNT(*) AS n FROM hr_outbox_events');if(Number(existing[0].n)!==0)fail('Historical outbox is not empty: never double-seed.');
    const [payrolls]=await cn.query('SELECT employee_payroll_id,payroll_status,released_date,released_at,net_fund_release FROM employee_payrolls');
    const [corrections]=await cn.query('SELECT COUNT(*) AS n FROM employee_payroll_corrections');
    const [advances]=await cn.query("SELECT COUNT(*) AS n FROM employee_cash_advances WHERE cash_advance_status IN ('active','paid')");
    const assessment=salaryBackfillAssessment(payrolls,Number(corrections[0].n),Number(advances[0].n),true);
    const eligible=new Map(assessment.eligible.map(x=>[x.payroll_id,x]));
    // Preserve raw monetary precision from DB; never recalculate payroll.
    const events=[];
    for(const p of payrolls){const id=String(p.employee_payroll_id);if(!eligible.has(id))continue;
      if(!p.released_at)continue;
      const recorded=formatTimeZoneAsUtc(p.released_at);
      const cashDate=String(p.released_date).slice(0,10);
      const event={schema_version:'1.0',event_id:uuid(id),event_type:'salary.cash_released.v1',source_system:'hr',source_payroll_id:id,source_event_version:1,
        cash_date:cashDate,recorded_at:recorded,currency:'PHP',amount:amount(p.net_fund_release),direction:'out',reference:`HR-PAYROLL-${id}-RELEASE-1`,display_label:`Salary payment #${id}`};
      events.push(event);
    }
    if(events.length!==assessment.eligible.length)fail('Missing timestamp or mismatched eligible events');
    const result={eligible_events:events.length,amount_cents:assessment.total_cents,issues:assessment.anomalies,seeded:false,
      note:'No personal payroll records included in this output; delivery is never enabled here.'};
    if(!assessment.safe_to_emit){console.log(JSON.stringify(result,null,2));if(seed)fail('Backfill blocked by unresolved source anomalies');return;}
    if(seed){
      // Each source payroll is unique and the deterministic event key prevents a conflicting replay.
      await cn.beginTransaction();
      try{for(const e of events)await cn.query(`INSERT INTO hr_outbox_events (event_id,event_type,aggregate_type,aggregate_id,event_revision,payload_json,delivery_state) VALUES (?,'salary.cash_released.v1','employee_payroll',?,1,?,'pending')`,[e.event_id,e.source_payroll_id,JSON.stringify(e)]);await cn.commit();}catch(error){await cn.rollback();throw error;}
      result.seeded=true;
    }
    console.log(JSON.stringify(result,null,2));
  }finally{await cn.end();}
}
main().catch(e=>{console.error('BATCH9 HISTORY STOPPED: '+e.message);process.exitCode=1;});
