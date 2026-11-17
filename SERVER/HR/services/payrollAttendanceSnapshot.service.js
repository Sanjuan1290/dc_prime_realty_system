// Receipt metrics are captured with each new draft or approved correction.
export const snapshotPayrollAttendance = (attendance) => attendance.rows.map((row) => ({
      date: row.date,
      state: row.state,
      day_type: row.dayType,
      time_in: row.timeIn,
      time_out: row.timeOut,
      scheduled_day: row.scheduledDay,
      absence: row.absence,
      // Preserve actual worked minutes alongside regular shift hours for the receipt.
      // Store these values at draft creation so the receipt never needs live attendance.
      total_worked_minutes: Math.round(Number(row.totalWorkedSeconds || 0) / 60),
      scheduled_attendance_minutes: row.scheduledDay ? Number(attendance.schedule.attendanceWorkingMinutes ?? attendance.schedule.regularWorkingMinutes) : 0,
      unclassified_extra_minutes: Math.round(Math.max(
        Number(row.totalWorkedSeconds || 0) - Number(row.regularAttendedSeconds || 0)
        - Number(row.overtimeSeconds || 0) - Number(row.restDayOvertimeSeconds || 0)
        - Number(row.regularHolidaySeconds || 0) - Number(row.specialHolidaySeconds || 0)
        - Number(row.doublePaySeconds || 0), 0
      ) / 60),
      regular_attended_minutes: Math.round(Number(row.regularAttendedSeconds || 0) / 60),
      late_minutes: Math.round(Number(row.lateSeconds || 0) / 60),
      overtime_minutes: Math.round(Number(row.overtimeSeconds || 0) / 60),
      rest_day_overtime_minutes: Math.round(Number(row.restDayOvertimeSeconds || 0) / 60),
      regular_holiday_minutes: Math.round(Number(row.regularHolidaySeconds || 0) / 60),
      special_holiday_minutes: Math.round(Number(row.specialHolidaySeconds || 0) / 60),
      night_differential_minutes: Math.round(Number(row.nightDifferentialSeconds || 0) / 60),
    }));
