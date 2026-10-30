/** Local wall-clock intervals for an attendance date in Asia/Manila.
 * Attendance dates anchor Time In. Earlier Time Out denotes the following day,
 * but only for a verified shift of at most 16 hours. No timezone conversions.
 */
export const MAX_ATTENDANCE_SHIFT_SECONDS = 16 * 3600;
const DAY = 24 * 3600;
const NIGHT_START = 22 * 3600;
const NIGHT_END = 6 * 3600;

export const clockSeconds = (value) => {
  if (!value) return null;
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
};

export const getAttendanceShift = (timeIn, timeOut) => {
  const start = clockSeconds(timeIn);
  const finishClock = clockSeconds(timeOut);
  if (start === null || finishClock === null) return null;
  const overnight = finishClock < start;
  const finish = finishClock + (overnight ? DAY : 0);
  const lengthSeconds = finish - start;
  if (lengthSeconds <= 0 || lengthSeconds > MAX_ATTENDANCE_SHIFT_SECONDS) return null;
  return { start, finish, overnight, lengthSeconds };
};

export const isValidOvernightAttendance = (timeIn, timeOut) => Boolean(getAttendanceShift(timeIn, timeOut)?.overnight);

const overlap = (startA, finishA, startB, finishB) =>
  Math.max(0, Math.min(finishA, finishB) - Math.max(startA, startB));

/** Returns paid night seconds, excluding any overlapping scheduled unpaid break. */
export const getNightShiftSeconds = ({ timeIn, timeOut, breakStart, breakMinutes = 0 }) => {
  const shift = getAttendanceShift(timeIn, timeOut);
  if (!shift) return 0;
  const breakAt = clockSeconds(breakStart);
  const breakLength = Math.max(0, Math.min(24 * 60, Number(breakMinutes) || 0)) * 60;
  // A shift can overlap midnight once. Split 22:00-06:00 into concrete day windows.
  const windows = [
    [0, NIGHT_END], [NIGHT_START, DAY + NIGHT_END],
    [DAY + NIGHT_START, 2 * DAY + NIGHT_END],
  ];
  let nightSeconds = 0;
  for (const [nightFrom, nightTo] of windows) {
    let paid = overlap(shift.start, shift.finish, nightFrom, nightTo);
    if (paid && breakAt !== null && breakLength > 0) {
      for (const dayOffset of [0, DAY]) {
        const breakFrom = breakAt + dayOffset;
        paid -= overlap(Math.max(shift.start, nightFrom), Math.min(shift.finish, nightTo), breakFrom, breakFrom + breakLength);
      }
    }
    nightSeconds += Math.max(0, paid);
  }
  return Math.max(0, Math.min(nightSeconds, shift.lengthSeconds));
};

/** Keep the same unpaid break handling for overnight calculations. */
export const getShiftBreakSeconds = ({ shift, breakStart, breakMinutes = 0 }) => {
  const at = clockSeconds(breakStart);
  if (!shift || at === null || !(Number(breakMinutes) > 0)) return 0;
  const length = Math.min(24 * 60, Number(breakMinutes)) * 60;
  return [0, DAY].reduce((sum, offset) => sum + overlap(shift.start, shift.finish, at + offset, at + offset + length), 0);
};

