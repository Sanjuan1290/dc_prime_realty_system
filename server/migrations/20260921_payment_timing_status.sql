-- 2026-09-21 — Separate payment timing from payment type / schedule state.
--
-- A fully paid SOA row is `Paid` even when the payment was received before
-- its due date. The UI derives `Paid Early` / `Paid Late` from Date Paid vs
-- Due Date. `Advance Payment` remains an explicit payment TYPE for money
-- intentionally applied toward future monthly obligations.
--
-- TiDB / MySQL compatible. No table rebuild is required.

UPDATE lot_project_payment_schedules
SET schedule_status = 'Paid',
    updated_at = CURRENT_TIMESTAMP
WHERE schedule_status = 'Advance';
