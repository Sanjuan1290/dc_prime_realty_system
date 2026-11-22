import {createHash,createHmac,randomUUID,timingSafeEqual} from 'node:crypto';
import {dateOnly,timeOnly,buildEmployeeNameSql} from '../controllers/System/Employees/employeeModule.shared.js';
import {getAttendanceRuntimeSettings,getManilaDateTime} from '../controllers/System/Employees/attendanceLite.shared.js';
import {writeAuditLog} from '../controllers/System/auditLogs.controller.js';
import {prepareAttendanceCorrection,applyAttendanceCorrection} from './attendanceCorrection.service.js';
import {calculateAttendancePayrollRow} from './payrollAttendance.service.js';
import {getEmployeeRestDaysAsOf} from './employeeRestDay.service.js';
import {getPayrollDraftById,recalculateDraftPayrollById} from './employeePayroll.service.js';

export const MAX_BULK_TIME_OUT_RECORDS=100;
const REVIEW_MS=10*60*1000;
const fail=(message,code='BULK_TIME_OUT_INVALID',statusCode=400)=>Object.assign(new Error(message),{code,statusCode});
const stale=()=>fail('Attendance or payroll changed after the preview. Review the adjustment again before saving.','BULK_TIME_OUT_STALE',409);
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function readBulkTimeOutInput(body={}){
  const date=typeof body.attendance_date==='string'?body.attendance_date:'';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!dateOnly(date))throw fail('Select one valid attendance date.');
  const ids=body.attendance_ids;
  if(!Array.isArray(ids)||!ids.length||ids.length>MAX_BULK_TIME_OUT_RECORDS)throw fail(`Select between 1 and ${MAX_BULK_TIME_OUT_RECORDS} attendance records.`);
  if(ids.some(id=>! /^[1-9]\d*$/.test(String(id))||!Number.isSafeInteger(Number(id))))throw fail('Select valid attendance records.');
  const attendanceIds=ids.map(Number).sort((a,b)=>a-b);
  if(new Set(attendanceIds).size!==attendanceIds.length)throw fail('Each attendance record can only be selected once.');
  const timeOut=typeof body.actual_time_out==='string'?timeOnly(body.actual_time_out):null;
  if(!timeOut)throw fail('Enter one valid new Time Out.');
  if(Object.hasOwn(body,'actual_time_in'))throw fail('Bulk Time Out Adjustment preserves the original Time In.');
  const reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!reason||reason.length>1000)throw fail('Enter an adjustment reason of up to 1,000 characters.');
  return {date,attendanceIds,timeOut,reason};
}

const reviewSecret=()=>{
  const secret=process.env.HR_JWT_SECRET;
  if(!secret||secret.length<32)throw fail('HR review signing is not configured.','BULK_REVIEW_NOT_CONFIGURED',503);
  return secret;
};
const signature=body=>createHmac('sha256',reviewSecret()).update('attendance-bulk-time-out-v1:'+body).digest('base64url');
export function signBulkTimeOutReview({actorId,input,fingerprint,now=Date.now()}){
  const body=Buffer.from(JSON.stringify({actorId,input,fingerprint,expiresAt:now+REVIEW_MS})).toString('base64url');
  return body+'.'+signature(body);
}
export function verifyBulkTimeOutReview(token,{actorId,input,now=Date.now()}){
  if(typeof token!=='string'||token.length>16000)throw fail('Preview this adjustment before saving.','BULK_TIME_OUT_PREVIEW_REQUIRED',409);
  const [body,provided,extra]=token.split('.');
  if(!body||!provided||extra)throw stale();
  const expected=Buffer.from(signature(body)),actual=Buffer.from(provided);
  if(expected.length!==actual.length||!timingSafeEqual(expected,actual))throw stale();
  let claim;try{claim=JSON.parse(Buffer.from(body,'base64url').toString())}catch{throw stale()}
  if(claim.actorId!==actorId||hash(claim.input)!==hash(input)||!Number.isFinite(claim.expiresAt)||claim.expiresAt<=now)throw stale();
  return claim;
}

const metrics=row=>({totalWorkedSeconds:row.totalWorkedSeconds,regularAttendedSeconds:row.regularAttendedSeconds,
  overtimeSeconds:row.overtimeSeconds,restDayOvertimeSeconds:row.restDayOvertimeSeconds,
  regularHolidaySeconds:row.regularHolidaySeconds,specialHolidaySeconds:row.specialHolidaySeconds,doublePaySeconds:row.doublePaySeconds,
  lateSeconds:row.lateSeconds,nightDifferentialSeconds:row.nightDifferentialSeconds,state:row.state});

async function loadAdjustment(connection,input,{lock=false}={}){
  const placeholders=input.attendanceIds.map(()=>'?').join(',');
  const [records]=await connection.query(`SELECT a.*,e.employee_code,${buildEmployeeNameSql('e')} AS full_name,
      COALESCE(ev.day_type,ds.day_type,'regular') AS day_type
    FROM employee_attendance_records a INNER JOIN employees e ON e.employee_id=a.employee_id
    LEFT JOIN attendance_events ev ON ev.attendance_event_id=a.attendance_event_id
    LEFT JOIN attendance_day_settings ds ON ds.attendance_date=a.attendance_date
    WHERE a.employee_attendance_id IN (${placeholders}) AND a.attendance_date=?
    ORDER BY a.employee_attendance_id${lock?' FOR UPDATE':''}`,[...input.attendanceIds,input.date]);
  if(records.length!==input.attendanceIds.length)throw fail('Selected records are missing or belong to a different attendance date. Reload the date and select them again.','BULK_TIME_OUT_RECORDS_CHANGED',409);
  const runtime=await getAttendanceRuntimeSettings(connection);
  const restDays=await getEmployeeRestDaysAsOf(connection,records.map(row=>Number(row.employee_id)),input.date);
  const entries=records.map(record=>{
    if(!timeOnly(record.actual_time_in))throw fail(`${record.full_name} has no Time In. Correct that record individually first.`);
    const correction=prepareAttendanceCorrection(record,{actual_time_in:record.actual_time_in,actual_time_out:input.timeOut,reason:input.reason},{allowUnchanged:true});
    const calculate=attendance=>metrics(calculateAttendancePayrollRow({date:input.date,attendance,restDays:restDays.get(Number(record.employee_id))||[],schedule:runtime}));
    const before=calculate(record),after=calculate({...record,actual_time_out:input.timeOut});
    return {record,correction,before,after};
  });
  const changed=entries.filter(entry=>entry.correction.changed);
  if(!changed.length)throw fail('All selected records already have this Time Out.');
  const employeeIds=[...new Set(changed.map(entry=>Number(entry.record.employee_id)))].sort((a,b)=>a-b);
  const marks=employeeIds.map(()=>'?').join(',');
  const [payrolls]=await connection.query(`SELECT p.employee_payroll_id,p.employee_id,p.payroll_status,p.updated_at,p.calculation_version,
      pp.employee_payroll_period_id,pp.payroll_status AS period_status,pp.period_start,pp.period_end
    FROM employee_payrolls p INNER JOIN employee_payroll_periods pp ON pp.employee_payroll_period_id=p.employee_payroll_period_id
    WHERE p.employee_id IN (${marks}) AND pp.period_start<=? AND pp.period_end>=?
    ORDER BY pp.employee_payroll_period_id,p.employee_payroll_id${lock?' FOR UPDATE':''}`,[...employeeIds,input.date,input.date]);
  const fingerprint=hash({input,records,schedule:runtime,restDays:[...restDays],payrolls});
  return {entries,changed,payrolls,fingerprint,runtime};
}

function publicPreview(context,input){
  return {attendance_date:input.date,actual_time_out:input.timeOut,reason:input.reason,
    automatic_time_out:context.runtime.defaultTimeOut,scheduled_time_out:context.runtime.scheduledTimeOut,
    changed_count:context.changed.length,unchanged_count:context.entries.length-context.changed.length,
    draft_payroll_count:context.payrolls.filter(row=>row.payroll_status==='draft').length,
    protected_payroll_count:context.payrolls.filter(row=>row.payroll_status!=='draft').length,
    employees:context.entries.map(({record,correction,before,after})=>({attendance_id:Number(record.employee_attendance_id),employee_id:Number(record.employee_id),
      employee_name:record.full_name,employee_code:record.employee_code,time_in:correction.previousTimeIn,
      original_time_out:correction.previousTimeOut,original_time_out_source:record.time_out_source,
      new_time_out:input.timeOut,changed:correction.changed,before,after,
      additional_work_seconds:after.totalWorkedSeconds-before.totalWorkedSeconds,
    })),
  };
}

export async function previewBulkTimeOut(connection,req,input){
  const context=await loadAdjustment(connection,input);
  return {...publicPreview(context,input),review_token:signBulkTimeOutReview({actorId:req.authUser.id,input,fingerprint:context.fingerprint})};
}

// Every attendance correction, history/audit row and dependent draft update uses
// this one caller-owned transaction. Any failure rolls the entire operation back.
export async function saveBulkTimeOut(connection,req,input,token){
  const review=verifyBulkTimeOutReview(token,{actorId:req.authUser.id,input});
  const context=await loadAdjustment(connection,input,{lock:true});
  if(review.fingerprint!==context.fingerprint)throw stale();
  const operationId=randomUUID();
  for(const {record,after,before} of context.changed){
    await applyAttendanceCorrection(connection,req,record,{actual_time_in:record.actual_time_in,actual_time_out:input.timeOut,reason:input.reason},
      {calculation:after,beforeCalculation:before,operationId});
  }
  let recalculated=0;
  for(const row of context.payrolls.filter(payroll=>payroll.payroll_status==='draft')){
    const before=await getPayrollDraftById(connection,row.employee_payroll_id);
    await recalculateDraftPayrollById(connection,row.employee_payroll_id,getManilaDateTime().date);
    const after=await getPayrollDraftById(connection,row.employee_payroll_id);
    await writeAuditLog(connection,req,{actor:req.authUser,action:'update',module:'Employee Salary',entityType:'employee_payroll',entityId:String(row.employee_payroll_id),
      entityLabel:`${after.employee_name_snapshot} - ${after.period_label}`,title:'Payroll Recalculated',
      description:`Draft payroll was recalculated after a Bulk Time Out Adjustment for ${after.employee_name_snapshot}.`,
      metadata:{bulkOperationId:operationId,employeeId:after.employee_id,attendanceDate:input.date,reason:input.reason,
        before:{overtimeMinutes:before.overtime_minutes,netFundRelease:before.net_fund_release},
        after:{overtimeMinutes:after.overtime_minutes,netFundRelease:after.net_fund_release}},
    });
    recalculated++;
  }
  return {...publicPreview(context,input),operation_id:operationId,recalculated_drafts:recalculated};
}
