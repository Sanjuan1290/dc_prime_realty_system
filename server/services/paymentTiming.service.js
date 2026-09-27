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
 * The returned map keeps the latest payment allocation classification for each
 * schedule row, matching the schedule row's current date_paid/reference_id view.
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

  const latestBySchedule = new Map();

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

      latestBySchedule.set(row.scheduleId, {
        timing,
        paymentId: row.paymentId,
        allocationId: row.allocationId,
        paymentDate,
        dueDate: row.dueDate,
      });
    }
  }

  return latestBySchedule;
};
