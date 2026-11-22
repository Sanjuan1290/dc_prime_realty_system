import {writeAuditLog} from '../controllers/System/auditLogs.controller.js';
import {cleanText,dateOnly,timeOnly} from '../controllers/System/Employees/employeeModule.shared.js';
import {getAttendanceShift} from './nightShiftTime.service.js';

const invalid=(message,statusCode=400)=>Object.assign(new Error(message),{statusCode});
export const invalidProvidedClockTime=value=>value!==null&&value!==undefined&&String(value).trim()!==''&&!timeOnly(value);
export const invalidAttendanceClockRange=(timeIn,timeOut)=>Boolean(timeIn&&timeOut&&!getAttendanceShift(timeIn,timeOut));

export function prepareAttendanceCorrection(attendance,values,{allowUnchanged=false}={}){
  const actualTimeIn=timeOnly(values.actual_time_in),actualTimeOut=timeOnly(values.actual_time_out);
  const reason=cleanText(values.reason);
  if([values.actual_time_in,values.actual_time_out].some(invalidProvidedClockTime))throw invalid('Enter valid Time In and Time Out clock times.');
  if(!reason)throw invalid('A reason is required when correcting attendance.');
  if(!actualTimeIn&&actualTimeOut)throw invalid('Time Out cannot be saved without a Time In.');
  if(!attendance.attendance_event_id&&!actualTimeIn)throw invalid('Time In is required for non-event attendance records.');
  if(invalidAttendanceClockRange(actualTimeIn,actualTimeOut))throw invalid('Time In and Time Out must be within 16 hours. For an overnight shift, enter the next-day Time Out clock time.');
  const previousTimeIn=timeOnly(attendance.actual_time_in),previousTimeOut=timeOnly(attendance.actual_time_out);
  const timeInChanged=previousTimeIn!==actualTimeIn,timeOutChanged=previousTimeOut!==actualTimeOut;
  if(!timeInChanged&&!timeOutChanged&&!allowUnchanged)throw invalid('No attendance time changes were made.');
  return {actualTimeIn,actualTimeOut,previousTimeIn,previousTimeOut,timeInChanged,timeOutChanged,changed:timeInChanged||timeOutChanged,reason};
}

// The caller owns the transaction and the lock on this attendance record.
// Shared by the existing single correction and the bulk adjustment operation.
export async function applyAttendanceCorrection(connection,req,attendance,values,{calculation=null,operationId=null,beforeCalculation=null}={}){
  const change=prepareAttendanceCorrection(attendance,values);
  const {actualTimeIn,actualTimeOut,previousTimeIn,previousTimeOut,timeInChanged,timeOutChanged,reason}=change;
  const metrics=calculation?`, regular_work_seconds=?, late_seconds=?, overtime_seconds=?, night_differential_seconds=?`:'';
  await connection.query(`UPDATE employee_attendance_records SET
    actual_time_in=?,time_in_source=CASE WHEN ? THEN 'admin' ELSE time_in_source END,
    actual_time_out=?,time_out_source=CASE WHEN ? THEN 'admin' ELSE time_out_source END,
    notes=?,source='manual',updated_by_user_id=?${metrics}
    WHERE employee_attendance_id=?`,[
    actualTimeIn,timeInChanged?1:0,actualTimeOut,timeOutChanged?1:0,reason,req.authUser?.id||null,
    ...(calculation?[calculation.regularAttendedSeconds,calculation.lateSeconds,calculation.overtimeSeconds,calculation.nightDifferentialSeconds]:[]),
    attendance.employee_attendance_id,
  ]);
  await connection.query(`INSERT INTO employee_attendance_corrections
    (employee_attendance_id,previous_time_in,new_time_in,previous_time_out,new_time_out,reason,changed_by_user_id)
    VALUES (?,?,?,?,?,?,?)`,[attendance.employee_attendance_id,previousTimeIn,actualTimeIn,previousTimeOut,actualTimeOut,reason,req.authUser?.id||null]);
  await writeAuditLog(connection,req,{
    actor:req.authUser,action:'update',module:'Attendance',entityType:'employee_attendance',entityId:String(attendance.employee_attendance_id),
    entityLabel:`${attendance.employee_code} - ${dateOnly(attendance.attendance_date)}`,
    title:operationId?'Bulk Time Out Adjustment':'Corrected attendance time',
    description:`Attendance time was corrected for ${attendance.full_name}. Reason: ${reason}`,
    metadata:{employeeId:attendance.employee_id,employeeName:attendance.full_name,employeeCode:attendance.employee_code,
      attendanceDate:dateOnly(attendance.attendance_date),previousTimeIn,actualTimeIn,previousTimeOut,actualTimeOut,reason,
      ...(operationId?{bulkOperationId:operationId,beforeCalculation,afterCalculation:calculation}:{}),
    },
  });
  return change;
}
