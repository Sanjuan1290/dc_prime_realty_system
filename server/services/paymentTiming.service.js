const dateOnly = (value) => {
  const text = String(value || '').trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

const numberOrZero = (value) => {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
};

/**
 * Classify each verified payment allocation by contractual timing.
 *
 * Rules for one payment transaction:
 * - rows due before the payment date => late
 * - rows due on the payment date => on_time
 * - the nearest future due date touched by that payment => early
 * - later future due dates touched by the same payment => advance
 *
 * A schedule row may be funded by more than one payment. In that case we must
 * not erase earlier advance-payment history just because a later top-up becomes
 * the only/nearest future row touched by that later payment. Therefore the
 * schedule-level result preserves `advance` once any verified allocation to that
 * row was classified as advance, unless the final/latest allocation is late.
 * This keeps a row from incorrectly flipping Partial Advance -> Paid Early.
 */
export const buildLatestScheduleAllocationTiming = (rows = []) => {
  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      paymentId: numberOrZero(row.paymentId ?? row.lot_project_payment_id),
      scheduleId: numberOrZero(row.scheduleId ?? row.lot_project_payment_schedule_id),
      allocationId: numberOrZero(row.allocationId ?? row.lot_project_payment_allocation_id),
      paymentDate: dateOnly(row.paymentDate ?? row.lot_project_payment_date),
      dueDate: dateOnly(row.dueDate ?? row.due_date),
    }))
    .filter((row) => row.paymentId > 0 && row.scheduleId > 0)
    .sort((left, right) => {
      const leftDate = left.paymentDate || '';
      const rightDate = right.paymentDate || '';
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      if (left.paymentId !== right.paymentId) return left.paymentId - right.paymentId;
      return left.allocationId - right.allocationId;
    });

  const byPayment = new Map();
  for (const row of normalized) {
    if (!byPayment.has(row.paymentId)) byPayment.set(row.paymentId, []);
    byPayment.get(row.paymentId).push(row);
  }

  const allocationHistoryBySchedule = new Map();

  for (const allocations of byPayment.values()) {
    const paymentDate = allocations.find((row) => row.paymentDate)?.paymentDate || null;
    const currentOrFutureDueDates = allocations
      .map((row) => row.dueDate)
      .filter((dueDate) => paymentDate && dueDate && dueDate >= paymentDate)
      .sort();
    const nearestCurrentOrFutureDueDate = currentOrFutureDueDates[0] || null;

    for (const row of allocations) {
      let timing = null;
      if (paymentDate && row.dueDate) {
        if (row.dueDate < paymentDate) timing = 'late';
        else if (row.dueDate === paymentDate) timing = 'on_time';
        else if (row.dueDate === nearestCurrentOrFutureDueDate) timing = 'early';
        else timing = 'advance';
      }

      if (!allocationHistoryBySchedule.has(row.scheduleId)) {
        allocationHistoryBySchedule.set(row.scheduleId, []);
      }
      allocationHistoryBySchedule.get(row.scheduleId).push({
        timing,
        paymentId: row.paymentId,
        allocationId: row.allocationId,
        paymentDate,
        dueDate: row.dueDate,
      });
    }
  }

  const latestBySchedule = new Map();
  for (const [scheduleId, history] of allocationHistoryBySchedule.entries()) {
    const latest = history[history.length - 1] || {};
    const hadAdvanceAllocation = history.some((entry) => entry.timing === 'advance');

    // Completion after the contractual due date must remain Paid Late. Otherwise,
    // preserve any earlier advance allocation so a later top-up cannot relabel an
    // advance-funded installment as merely Paid Early.
    const timing = latest.timing === 'late'
      ? 'late'
      : hadAdvanceAllocation
        ? 'advance'
        : latest.timing || null;

    latestBySchedule.set(scheduleId, {
      ...latest,
      timing,
      hadAdvanceAllocation,
      allocationCount: history.length,
    });
  }

  return latestBySchedule;
};

