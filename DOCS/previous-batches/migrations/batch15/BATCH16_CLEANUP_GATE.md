# Batch 16 cleanup approval gate — NO DELETIONS APPROVED

**Status:** NO-GO as of October 28, 2026. Applies to the October 27 source export and the Batch 4–14 staging overlays, not a live production inventory.

## Table decisions

- **105 original tables** reviewed through the Batch 2 ownership matrix.
- **17 HR tables** are **conditional retirement candidates only**. They remain source-of-truth until authorized HR cutover; retain as protected read-only evidence afterward for a reviewed observation/retention period. No DROP statements supplied.
- **22 mixed-use/shared Realty tables** require per-column partition/retention review; do not delete the whole table.
- **66 other Realty-owned tables** remain in the existing database.
- **0 tables and 0 columns approved for production deletion in Batch 15.**

Check `TABLE_CLEANUP_DECISION_MATRIX.csv` for each named table and its required evidence.

## Exact cleanup sequence for a future Batch 16, only after approval

1. Confirm a full production-aligned source and database restore point plus the rollback owner and schedule.
2. Confirm HR is authoritative and every HR dataset, actor ID, audit event, receipt file and financial movement reconciles.
3. Confirm the replacement for Seller Network's HR employee-link import/undo works when the old `employees` table is unavailable.
4. Confirm Company Finances no longer selects from `employee_payrolls` or `employee_cash_advances`; finance totals and history reconcile under the new source.
5. Confirm both old HR API writes and attendance scheduler are deactivated and the database user lacks HR write privileges.
6. Confirm all consumer code, tests, reports, exports, imports, background jobs, and webhooks work with HR tables unavailable in a staging replica.
7. Run read-only table/column metadata reports, find incoming/outgoing foreign keys, choose a dependency-aware retirement order and attach a reviewed migration SQL file. Do not disable foreign-key enforcement to conceal unresolved dependencies.
8. Remove obsolete HR routes/components/code from Realty in a separate reviewed change; retain necessary audit and historical projection data.
9. Execute an approved controlled cleanup against staging, test restore, then repeat only under production change authorization.
10. Run post-cleanup payment/SOA/commission, Seller Network, payroll, public website and Finance regressions before closing the change.

**Correction to prior shorthand:** Batch 16 should not automatically delete all 17 tables. Deletion must be conditional on a full owner-approved cutoff and legally/operationally suitable retention; an archive may remain necessary.

## Columns requiring review but not currently removal candidates

The following attendance fields exist on original `system_settings` and in new HR `hr_settings`; do not delete original values until exact effective settings reconcile and no old route reads them:

`attendance_default_time_out`, `attendance_scheduled_time_in`, `attendance_scheduled_time_out`, `attendance_break_start`, `attendance_break_minutes`, `attendance_regular_work_minutes`, `attendance_late_after`, `attendance_red_highlight_after`, `employee_departments_json`, `employee_department_codes_json`.

Similarly, retain `company_finance_settings.opening_balance` until all existing historical statements and finance queries have been reviewed; a zero starting balance in the new Finance ledger does not by itself prove the old Realty column is redundant.

## Required live evidence

Actual TiDB schema/constraint metadata, HR and Finance row checksum reports, isolated service credential grants, verified Cloudinary files, corrected transfer contract, signed source/target cash reconciliation, rollback rehearsal, business-owner/DBA approval and measured observation/retention period.

Never reuse a staging-only package as a production migration solely because its static tests pass.
