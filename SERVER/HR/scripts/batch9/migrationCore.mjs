import { createHash } from 'node:crypto';

export const digest = (v) => createHash('sha256').update(typeof v === 'string' ? v : canonical(v)).digest('hex');
export function canonical(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'bigint') return JSON.stringify(String(value));
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Buffer.isBuffer(value)) return JSON.stringify(value.toString('base64'));
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (typeof value === 'object') return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function rowHash(rows, pk) {
  const ordered = [...rows].sort((a,b)=>{
    for(const key of pk){
      const av=String(a[key]),bv=String(b[key]);
      if(av!==bv) {
        if(/^\d+$/.test(av)&&/^\d+$/.test(bv)) return BigInt(av)<BigInt(bv)?-1:1;
        return av<bv?-1:1;
      }
    } return 0;
  });
  return digest(ordered);
}
export function orderedHistory(rows, pk='employee_employment_history_id', previous='previous_history_id') {
  const byId=new Map(rows.map(r=>[String(r[pk]),r]));
  if(byId.size!==rows.length)throw Error('Duplicate history primary keys');
  const ordered=[],visiting=new Set(),done=new Set();
  function visit(id){
    if(done.has(id))return;
    if(visiting.has(id))throw Error('Cyclic employment history reference');
    const row=byId.get(id);if(!row)throw Error(`Unresolved employment history reference: ${id}`);
    visiting.add(id);
    if(row[previous]!==null&&row[previous]!==undefined)visit(String(row[previous]));
    visiting.delete(id);done.add(id);ordered.push(row);
  }
  for(const id of byId.keys())visit(id);
  return ordered;
}
export function validateUserReferences(rowsByTable, actorCols, userIds) {
  const invalid=[];
  for(const [table,cols] of Object.entries(actorCols)) for(const row of rowsByTable[table]||[]) for(const col of cols){
    const value=row[col];
    if(value===null||value===undefined)continue;
    if(!userIds.has(String(value)))invalid.push({table,column:col,legacy_id:String(value)});
  }
  return invalid;
}
export function hrScopedAudit(row) {
  const values=[row.module,row.entity_type].map(x=>String(x||'').toLowerCase());
  return values.some(v=>/employee|payroll|salary|attendance/.test(v));
}
export function salaryBackfillAssessment(rows, correctionCount=0, activeCashAdvanceCount=0, timezoneConfirmed=false) {
  const anomalies=[],eligible=[];
  for(const p of rows){
    const id=String(p.employee_payroll_id);
    if(p.payroll_status!=='released') {
      if(p.released_date||p.released_at)anomalies.push({payroll_id:id,issue:'nonreleased_has_release_metadata'});
      continue;
    }
    if(!p.released_date){anomalies.push({payroll_id:id,issue:'released_without_cash_date'});continue;}
    const amount=String(p.net_fund_release??'0');
    if(!/^\d+(?:\.\d{1,2})?$/.test(amount) || !Number.isFinite(Number(amount)) || Number(amount)<0){
      anomalies.push({payroll_id:id,issue:'invalid_net_release'});continue;
    }
    // Matching the existing Finance activity excludes zero cash flows.
    if(Number(amount)===0)continue;
    if(!p.released_at)anomalies.push({payroll_id:id,issue:'cash_timestamp_missing'});
    eligible.push({payroll_id:id,cash_date:String(p.released_date).slice(0,10),amount_cents:Math.round(Number(amount)*100)});
  }
  if(correctionCount>0)anomalies.push({issue:'historical_payroll_corrections_review_required',count:correctionCount});
  if(activeCashAdvanceCount>0)anomalies.push({issue:'cash_advances_separate_review_required',count:activeCashAdvanceCount});
  if(!timezoneConfirmed)anomalies.push({issue:'historical_release_datetime_timezone_not_confirmed'});
  return {eligible,anomalies,total_cents:eligible.reduce((n,r)=>n+r.amount_cents,0),safe_to_emit:anomalies.length===0};
}
export function formatTimeZoneAsUtc(mysqlDatetime,offsetMinutes=480){
  if(typeof mysqlDatetime!=='string' || !/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(mysqlDatetime))throw Error('Invalid source DATETIME');
  const utc=new Date(Date.parse(mysqlDatetime.replace(' ','T')+'Z')-offsetMinutes*60*1000);
  if(Number.isNaN(+utc))throw Error('Invalid date/time');
  return utc.toISOString();
}
