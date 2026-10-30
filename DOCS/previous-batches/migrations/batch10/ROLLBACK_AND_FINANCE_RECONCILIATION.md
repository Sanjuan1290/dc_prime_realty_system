# Rollback and salary finance reconciliation

## Before HR accepts new independent writes

- Retain the old Realty database and legacy code in a verified rollback snapshot.
- Keep HR writes/readiness disabled and salary finance source in `legacy` until gates pass.
- If the rehearsal fails before any new HR writes, stop routing, disable HR jobs and outbox delivery, and restore old authorized access **only after verifying the original remains authoritative and up to date**.

## After the first independent HR production write

A simple DNS or environment-variable reversal is **not safe**. It would strand newly created attendance, payroll, corrections, releases, receipts, or actor/audit records in HR.

1. Stop independent HR writes and jobs; stop HR-to-Realty event delivery and capture receipts/queue states.
2. Export all post-cutover changes with transaction IDs, timestamps and hashes from HR and Realty inboxes. Track missing acknowledgements and in-flight calls; retries can deliver the same event twice by design.
3. Reconcile changed employee profiles, attendance, payroll snapshots, salary cash events, signed receipts and audit history. Record who approved any manual correction.
4. Restore or repair **each** affected dataset under a separate approved procedure; don't delete source events or silently double count expenses.
5. Turn old HR writes back on only if a verified recovery destination holds every post-cutover authoritative write. Otherwise, pause affected operations and continue incident response.

## Finance parity sheet, record level

| Field | Required check |
|---|---|
| HR payroll ID | Unique source identifier; no missing/extra IDs |
| Release status & paid date | All released cash payments use the intended business date |
| Net released amount | Decimal PHP amounts match to 1 centavo |
| Transfer event ID | Deterministic; duplicate deliveries have exactly one cash projection |
| Realty salary materialization | Same event reference/date/amount; no manual duplicate entry |
| Correction/reversal | Explicitly reviewed (not covered by event contract v1) |
| HR/Realty totals | Equal per date and whole history, not just aggregate count |
| Cash advances | Independently reviewed, do not treat as payroll expense automatically |
| Pending/failed outbox | Zero unresolved events at approved checkpoint |

Don't switch `FINANCE_SALARY_SOURCE=external` when a checkpoint is missing, stale, or financial discrepancies exist. Signed payroll receipts and audit trails must still be readable after cutover.
