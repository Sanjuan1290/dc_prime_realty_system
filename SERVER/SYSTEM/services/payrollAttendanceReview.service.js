/** Read-only list of attendance issues. Never assumes a missing scan proves absence. */
export const getPayrollAttendanceReviewDays = (rows = []) => (
  (Array.isArray(rows) ? rows : [])
    .filter((row) => row?.reviewIssue === 'missing' || row?.reviewIssue === 'incomplete')
    .map((row) => ({ date: String(row.date), issue: row.reviewIssue }))
    .sort((a, b) => a.date.localeCompare(b.date))
);

/** The server confirms the client reviewed this exact set of missing workdays. */
export const sameReviewedDates = (expectedDays, receivedDates) => {
  if (!Array.isArray(receivedDates)) return false;
  const expected = expectedDays.filter((day) => day.issue === 'missing').map((day) => day.date).sort();
  const received = receivedDates.map(String).sort();
  return expected.length === received.length && expected.every((date, index) => date === received[index]);
};

/** Server-side approval guard; the browser checkbox alone is never trusted. */
export const validateAttendanceFinalReview = ({ review, attendanceReviewConfirmed, reviewedMissingDates }) => {
  if (review.incomplete_punches_require_correction) {
    throw Object.assign(new Error('Incomplete Time In/Out must be corrected by Operations before finalizing salary.'), {
      code: 'PAYROLL_ATTENDANCE_INCOMPLETE', statusCode: 409, data: review,
    });
  }
  // Entirely missing Time In and Time Out on a scheduled workday are already
  // counted as absence in the payroll calculation. Do not ask for a second
  // approval. A single missing punch still blocks finalization above.
};


