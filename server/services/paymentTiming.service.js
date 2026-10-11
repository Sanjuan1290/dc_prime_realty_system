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
 * - the nearest upcoming contractual installment for the account => early
 * - later contractual installments => advance, even if each is paid through
 *   a separate transaction. Previously we only looked at the rows touched by
 *   one payment and incorrectly marked every future installment Paid Early.
 *
 * A schedule row may be funded by more than one payment. In that case we must
 * not erase earlier advance-payment history just because a later top-up becomes
 * the only/nearest future row touched by that later payment. Therefore the
 * schedule-level result preserves `advance` once any verified allocation to that
 * row was classified as advance, unless the final/latest allocation is late.
 * This keeps a row from incorrectly flipping Partial Advance -> Paid Early.
 */
/**
 * The second argument must include ALL current schedule rows (paid and unpaid)
 * in the buyer account. The nearest contractual due date must never be derived
 * from only the allocations of one payment.
 *
 * For legacy standalone calls with no full schedule, preserve the previous
 * per-payment fallback; production always supplies the complete schedule.
 */
export const buildLatestScheduleAllocationTiming = (rows = [], scheduleRows = []) => {
  const contractRows = Array.isArray(scheduleRows) && scheduleRows.length ? scheduleRows : [];
  const contractSchedule = contractRows.map((row) => {
    const description = String(row.description || row.payment_description || '').toLowerCase();
    const scheduleType = String(row.scheduleType || row.schedule_type || '').toLowerCase();
    const category = scheduleType || (description.includes('downpayment') || description.includes('down payment')
      ? 'downpayment'
      : description.includes('monthly') ? 'monthly'
        : description.includes('reservation') ? 'reservation'
          : description.includes('legal') || description.includes('misc') || description.includes('lmf') ? 'legal_misc'
            : 'other');
    return {
      dueDate: dateOnly(row.dueDate ?? row.due_date),
      category,
      cancelled: String(row.schedule_status || row.status || '').toLowerCase() === 'cancelled',
    };
  }).filter((row) => row.dueDate && !row.cancelled);
  const scheduleCategoryById = new Map(contractRows.map((row) => [
    numberOrZero(row.scheduleId ?? row.lot_project_payment_schedule_id ?? row.id),
    String(row.scheduleType || row.schedule_type || '').toLowerCase() ||
      ((String(row.description || '').toLowerCase().includes('downpayment') || String(row.description || '').toLowerCase().includes('down payment')) ? 'downpayment'
        : String(row.description || '').toLowerCase().includes('monthly') ? 'monthly'
          : String(row.description || '').toLowerCase().includes('reservation') ? 'reservation'
            : 'other'),
  ]));
  const regularDueDates = [...new Set(contractSchedule
    .filter((row) => ['downpayment', 'monthly'].includes(row.category))
    .map((row) => row.dueDate))].sort();

  const nearestContractDueDate = (paymentDate, category) => {
    // Reservation and miscellaneous charges have their own payment schedule.
    // They must not move the next regular installment out of Paid Early.
    const dates = ['downpayment', 'monthly'].includes(category)
      ? regularDueDates
      : contractSchedule.filter((row) => row.category === category).map((row) => row.dueDate).sort();
    return dates.find((date) => date >= paymentDate) || null;
  };

  const normalized = (Array.isArray(rows) ? rows : [])
    .map((row) => ({
      ...row,
      paymentId: numberOrZero(row.paymentId ?? row.lot_project_payment_id),
      scheduleId: numberOrZero(row.scheduleId ?? row.lot_project_payment_schedule_id),
      allocationId: numberOrZero(row.allocationId ?? row.lot_project_payment_allocation_id),
      scheduleType: scheduleCategoryById.get(numberOrZero(row.scheduleId ?? row.lot_project_payment_schedule_id)) ||
        String(row.scheduleType || row.schedule_type || '').toLowerCase(),
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
    const nearestTouchedDueDate = currentOrFutureDueDates[0] || null;

    for (const row of allocations) {
      let timing = null;
      if (paymentDate && row.dueDate) {
        const description = String(row.description || row.payment_description || '').toLowerCase();
        const explicitCategory = String(row.scheduleType || row.schedule_type || '').toLowerCase();
        const category = explicitCategory || (description.includes('downpayment') || description.includes('down payment')
          ? 'downpayment'
          : description.includes('monthly') ? 'monthly'
            : description.includes('reservation') ? 'reservation'
              : description.includes('legal') || description.includes('misc') || description.includes('lmf') ? 'legal_misc'
                : 'other');
        const contractDueDate = contractRows.length ? nearestContractDueDate(paymentDate, category) : null;
        // All installments for the account use the same next scheduled regular
        // due date, even if it was already paid by an earlier transaction.
        const nextDueDate = contractRows.length ? contractDueDate : nearestTouchedDueDate;
        if (row.dueDate < paymentDate) timing = 'late';
        else if (row.dueDate === paymentDate) timing = 'on_time';
        else if (row.dueDate === nextDueDate) timing = 'early';
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


