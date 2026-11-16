import { db } from '../../db/connect.js';
import { writeAuditLog } from './auditLogs.controller.js';
import { buildSalaryFinanceSnapshot, buildFinanceTransferZip, buildFinanceExcel } from '../../services/salaryFinanceExport.service.js';

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
    const {from,to}=range(req.query),format=req.query.format||'zip';
    if(!['zip','xlsx'].includes(format))throw Object.assign(new Error('Choose ZIP or Excel.'),{statusCode:400});
    conn=await db.getConnection();await conn.beginTransaction();
    // The release event is immutable and shared with Realty. Re-exporting either
    // route therefore yields the same Finance source identity and fingerprint.
    const [rows]=await conn.query(`SELECT p.employee_payroll_id,p.net_fund_release,p.released_date,o.payload_json
      FROM employee_payrolls p LEFT JOIN hr_outbox_events o ON o.aggregate_id=CAST(p.employee_payroll_id AS CHAR)
      AND o.event_type='salary.cash_released.v1' AND o.aggregate_type='employee_payroll' AND o.event_revision=1
      WHERE p.payroll_status='released' AND p.net_fund_release>0 AND p.released_date BETWEEN ? AND ?
      ORDER BY p.employee_payroll_id LIMIT 501`,[from,to]);
    const snapshot=buildSalaryFinanceSnapshot({payrolls:rows,from,to});
    const content=format==='zip'?await buildFinanceTransferZip(snapshot):await buildFinanceExcel(snapshot);
    await writeAuditLog(conn,req,{action:'payroll.finance_export',module:'Payroll',entityType:'finance_export',entityId:snapshot.manifest.export_id,title:'Salary export for Finance',metadata:{period:{from,to},...snapshot.manifest.snapshot}});
    await conn.commit();
    res.set('Cache-Control','no-store').set('Content-Disposition',`attachment; filename="hr-salary-finance-${from}-${to}.${format}"`);
    res.type(format==='zip'?'application/zip':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(content);
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
