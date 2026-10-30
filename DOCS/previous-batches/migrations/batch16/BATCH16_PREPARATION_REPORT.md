# D&C Prime Realty — Batch 16 Final Cleanup Preparation Report

**As of:** October 28, 2026  
**Decision:** NO-GO for deletion of production code, tables or columns  
**Scope:** Read-only preparatory checks against the October 27 source/SQL backup and reconstructed Batch 15 workspace, not the active server.

## What was built

- 17-table retirement candidate manifest, complete 276-FK baseline and classified 105-table ownership split (17 HR, 22 shared, 66 Realty).
- Read-only repository reference scanner and original TiDB schema metadata SQL; both make **no** changes to a database.
- Conservative cleanup gate using 18 Batch 15 blockers and 22 evidence requirements; it always reports NO_GO rather than granting database modification authority.
- 17-table per-table review inventory, 81 remaining legacy runtime file/table references, follow-up code cleanup order, and independent remediation plan.
- 13 tests covering baseline metadata, scanner classification, positive and negative controls, no unexpected tables, immutable NO_GO, and non-mutating SQL.

## Actual inspection results

| Check | Result | Limit |
|---|---:|---|
| Original source tables | 105 | October 27 SQL export |
| Conditional HR retirement candidates | 17 | **0 approved** |
| Shared Realty tables requiring column/content review | 22 | **0 approved** |
| Other Realty tables to retain | 66 | Retain |
| Source-declared foreign keys | 276 | Live TiDB version still unknown |
| Source-declared internal HR FKs | 16 | Includes one self-reference; no incoming declared non-HR FKs |
| Runtime Realty file/table reference pairs | 81 | 48 distinct source files; text matches are leads, not live-query confirmation |
| New HR runtime reference pairs | 136 | Expected owner references |
| Historical migration reference pairs | 104 | Must retain migration history; not active consumers |
| Legacy operational-script reference pairs | 5 | Separate from runtime references |
| Legacy test reference pairs | 42 | Tests need ownership migration, not automatic deletion |
| New Batch 16 offline tests | 13 passed / 0 failed | No TiDB or installed npm dependencies needed |
| Pending evidence requirements | 22 / 22 | Batch 15 snapshot |
| Unresolved blockers | 18 / 18 | Includes 2 checker fixes prepared but not merged |

A source reference count is **not** the number of SQL queries or active runtime endpoints. Review `LEGACY_SOURCE_REFERENCES.csv` individually, beginning with `server/services/companyFinances.service.js`, `server/controllers/System/sellerGroup.controller.js`, and protected payroll receipt/webhook paths.

## Required no-go reasons

1. No production cutover was executed, and the original Realty database is still authoritative in the provided deployment history.
2. The independent HR production server is deliberately blocked, HR migration has not run on a verified live staging TiDB database, and pay releases/receipts require further work.
3. Realty Finance and Seller Network still have direct HR data references. Releasing the original `employee_payrolls`, `employee_cash_advances`, or `employees` tables could break reporting or imports.
4. Source revisions/reversals and historical salary cash movements require agreement and end-to-end reconciliation.
5. The public website remains a scaffold; complete assets, real builds, rollback and full regression are not verified.
6. There is no approved data retention schedule, measured observation window, per-table owner authorization or DBA signoff.

## Safety and portability

- No destructive SQL or automated code deletions are included.
- `REALTY_METADATA_READONLY.sql` uses INFORMATION_SCHEMA; approximate `TABLE_ROWS` values cannot replace payroll row-count and money-parity checks.
- `cleanup-gate.mjs` intentionally exits 2/NO_GO even if a user manually edits evidence fields; separate human change control is required.
- `scan-cleanup.mjs` reads the workspace; it never modifies source. Rerun against a pinned full Git checkout to replace this provisional snapshot.

## Recommended next action

Pause destructive cleanup and execute the R1–R10 remediation workstreams. Re-run Batch 15 integration, security and restoration checks with working TiDB staging databases and complete frontend assets. Only then draft exact DDL in a separate reviewed change request.

## References for operational checks

- TiDB foreign key behavior, including ineffective older-version constraints: https://docs.pingcap.com/tidb/stable/foreign-key/
- TiDB DROP TABLE semantics: https://docs.pingcap.com/tidb/stable/sql-statement-drop-table/
- AWS cutover/rollback considerations: https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-migration-cutover/cutover-stage.html
