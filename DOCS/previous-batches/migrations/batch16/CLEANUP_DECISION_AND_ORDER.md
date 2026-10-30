# Batch 16 — Cleanup decision and execution order (preparation only)

## Current decision: NO-GO

The October 27 source and SQL export, plus the Batch 15 integrated fixture, do not prove that HR or Finance has taken ownership in production. `client/` and `server/` remain authoritative; workspace overlays are staging proposals. **Nothing is eligible for production removal today.**

### Proposed code cleanup *after* approved cutovers

1. Replace active `server/services/companyFinances.service.js` payroll and cash-advance queries with reconciled salary transfer records. Maintain property collections, commissions, network releases, refunds, and manual transactions.
2. Replace `server/controllers/System/sellerGroup.controller.js` direct `employees` mutation in Seller Network import and undo with a controlled HR identity/link flow; preserve `network_member_import_items.linked_employee_ids_json` historical snapshots.
3. Remove original HR API mounts and the original attendance scheduler from `server/server.js` **only after** HR requests, kiosk flows, payroll finalization, release and receipt access pass the independent HR API checks.
4. Remove legacy Realty HR navigation/screens from `client/src/` only after the independent HR frontend works with its own login, role checks, barcode scanner and reports.
5. Retire old payroll services/controllers/routes/jobs/tests selectively, moving still-valid calculation regression tests into HR; retain data migration and audit evidence.
6. Extract the public site from `client/` to `apps/website/` with live buyer forms pointing to authorized Realty public APIs before deleting old public routes.
7. Prepare **column-level** review of 10 attendance fields in `system_settings`, but never apply column drops until a fresh source search and retention review passes.

### Database cleanup dependencies

The source backup declares 16 foreign keys among 17 HR candidate tables (including one self-reference) and 20 references from HR tables to `users`. No non-HR table declares an incoming foreign key into an HR table in the October 27 backup. **This is not proof** that live TiDB constraints and all SQL consumers have the same state. See `RETIREMENT_CANDIDATES.csv` and `REALTY_METADATA_READONLY.sql`.

Avoid deleting foreign-key constraints or setting `foreign_key_checks=0` to hide unresolved references. Exact retirement order must be generated from the *live* key metadata and reviewed per constraint. TiDB behavior depends on version and whether constraints from older clusters are effective.

### Backups and rollback

DDL removal can lose historical records and cannot be treated like an application-feature toggle. Preserve encrypted restoration points, protected historical records, table-specific owner signoffs, and a tested staging restore. If the new HR system has accepted writes, do **not** reactivate the old HR source without a reconciliation and authority-transfer plan.

### Hard stop conditions

- Any of 18 blockers still open or not merged and verified.
- Any of 22 Batch 15 evidence requirements absent.
- Any remaining active Realty reference to retired HR tables, including behind old feature toggles needed for rollback.
- Unreconciled payroll corrections, salary transfers, receipts, network links or audit records.
- Full builds, regression, browser/security tests or restore tests unresolved.
- No independently signed per-table retention and deletion authorization.

**This package intentionally excludes DROP/ALTER/DELETE scripts.** When all gates pass, author a new change-controlled, exact DDL migration from current metadata rather than promoting these October 27 assumptions to production.
