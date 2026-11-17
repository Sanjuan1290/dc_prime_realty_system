import { getAttendanceShift, getShiftBreakSeconds } from './nightShiftTime.service.js';

// Clock hours are separate from the approved payroll workday/rate basis.
export const scheduledAttendanceMinutes = (schedule) => {
  const shift = getAttendanceShift(schedule.scheduledTimeIn, schedule.scheduledTimeOut);
  if (!shift) throw Object.assign(new Error('Scheduled Time In and Time Out must define a shift of at most 16 hours.'), { statusCode: 400 });
  return Math.max(0, Math.round((shift.lengthSeconds - getShiftBreakSeconds({
    shift, breakStart: schedule.breakStart, breakMinutes: schedule.breakMinutes,
  })) / 60));
};
