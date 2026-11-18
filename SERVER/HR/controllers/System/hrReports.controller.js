import {buildSignedFinanceCsv} from '../../services/financeTransferCsv.js';
import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { buildSalaryFinanceSnapshot } from '../../services/salaryFinanceExport.service.js';

const date = value => {
  const s=String(value??'');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)||Number.isNaN(Date.parse(s+'T00:00:00Z'))||new Date(s+'T00:00:00Z').toISOString().slice(0,10)!==s)throw Object.assign(new Error('Choose valid From and To dates.'),{statusCode:400});
  return s;
};
const range = query => {
  const from=date(query.from),to=date(query.to);
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  if(from>to||to>today||Date.parse(to)-Date.parse(from)>366*86400000)throw Object.assign(new Error('Choose a date range of at most one year ending today or earlier.'),{statusCode:400});
  return {from,to};
};
export async function exportSalaryFinance(req,res,next){
  let conn;
  try{
    const {from,to}=range(req.query),format=req.query.format||'csv';
    if(format!=='csv')throw Object.assign(new Error('Only Export to Finance CSV is available.'),{statusCode:400});
    conn=await db.getConnection();await conn.beginTransaction();
    const [[missing]]=await conn.query(`SELECT COUNT(*) AS n FROM employee_payrolls p
      WHERE p.payroll_status='released' AND p.net_fund_release>0 AND p.released_date BETWEEN ? AND ?
      AND NOT EXISTS(SELECT 1 FROM hr_outbox_events o WHERE o.aggregate_type='employee_payroll' AND o.aggregate_id=CAST(p.employee_payroll_id AS CHAR)
        AND o.event_type='salary.cash_released.v1'
        AND JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.cash_date'))=DATE_FORMAT(p.released_date,'%Y-%m-%d')
        AND CAST(JSON_UNQUOTE(JSON_EXTRACT(o.payload_json,'$.amount')) AS DECIMAL(14,2))=p.net_fund_release
        AND NOT EXISTS(SELECT 1 FROM hr_outbox_events later WHERE later.aggregate_type=o.aggregate_type AND later.aggregate_id=o.aggregate_id AND later.event_revision>o.event_revision AND later.event_type IN ('salary.cash_released.v1','salary.cash_reversed.v1')))`,[from,to]);
    if(Number(missing.n))throw Object.assign(new Error('A released payment has no matching immutable salary event. Reconcile its history before exporting.'),{code:'SALARY_EVENT_REQUIRED',statusCode:409});
    // The release event is immutable and shared with Realty. Re-exporting either
    // route therefore yields the same Finance source identity and fingerprint.
    const [rows]=await conn.query(`SELECT payload_json FROM hr_outbox_events
      WHERE aggregate_type='employee_payroll' AND event_type IN ('salary.cash_released.v1','salary.cash_reversed.v1')
      AND JSON_UNQUOTE(JSON_EXTRACT(payload_json,'$.cash_date')) BETWEEN ? AND ?
      ORDER BY aggregate_id,event_revision LIMIT 501`,[from,to]);
    const snapshot=buildSalaryFinanceSnapshot({events:rows,from,to});
    const content=buildSignedFinanceCsv(snapshot);
    await writeAuditLog(conn,req,{action:'payroll.finance_export',module:'Payroll',entityType:'finance_export',entityId:snapshot.manifest.export_id,title:'Salary export for Finance',metadata:{period:{from,to},...snapshot.manifest.snapshot}});
    await conn.commit();
    res.set('Cache-Control','no-store').set('Content-Disposition',`attachment; filename="hr-salary-finance-${from}-${to}.${format}"`);
    res.type('text/csv; charset=utf-8').set('X-Content-Type-Options','nosniff').send(content);
  }catch(e){if(conn)await conn.rollback().catch(()=>{});next(e);}finally{conn?.release();}
}

export async function listHrAudit(req,res,next){
  try{
    const page=Number(req.query.page||1),limit=50;
    if(!Number.isSafeInteger(page)||page<1||page>10000)throw Object.assign(new Error('Choose a valid page.'),{statusCode:400});
    const conditions=[],params=[];
    if(req.query.from||req.query.to){const {from,to}=range(req.query);conditions.push('recorded_at>=FROM_UNIXTIME(?) AND recorded_at<FROM_UNIXTIME(?)');params.push(Date.parse(from+'T00:00:00+08:00')/1000,Date.parse(to+'T00:00:00+08:00')/1000+86400);}
    for(const key of ['module','action'])if(req.query[key]){const value=String(req.query[key]);if(value.length>100)throw Object.assign(new Error('Filter is too long.'),{statusCode:400});conditions.push(`${key}=?`);params.push(value);}
    const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
    const [[count]]=await db.query('SELECT COUNT(*) AS total FROM hr_audit_logs'+where,params);
    const [rows]=await db.query(`SELECT id,actor_name_snapshot,action,module,entity_type,entity_id,details_json,UNIX_TIMESTAMP(recorded_at) AS recorded_epoch FROM hr_audit_logs${where} ORDER BY id DESC LIMIT ${limit} OFFSET ${(page-1)*limit}`,params);
    const formatter=new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
    const items=rows.map(({recorded_epoch,...row})=>({...row,recorded_at:formatter.format(new Date(Number(recorded_epoch)*1000))}));
    res.set('Cache-Control','no-store').json({items,total:Number(count.total),page,page_size:limit});
  }catch(e){next(e);}
}
