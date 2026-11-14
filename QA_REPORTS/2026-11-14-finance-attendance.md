# Finance and attendance verification — 14 November 2026

The tested finance and attendance workflows pass after three attendance fixes. The application still has deliberate staging restrictions, so this is not confirmation that every feature is available for staff or ready for production.

| Check | Result |
| --- | --- |
| SYSTEM unit and regression tests | 1,722 passed |
| Finance unit tests | 65 passed |
| HR backend unit tests | 18 passed |
| HR frontend tests | 8 passed |
| Website frontend tests | 9 passed |
| API integration tests | 25 passed |
| Additional attendance integration tests | 15 passed |
| General browser checks | 55 passed |
| Finance and attendance browser workflows | 13 passed |
| Production builds | WEBSITE, SYSTEM, HR and FINANCE passed |
| Layout and source checks | All eight packages, 201 SYSTEM imports and 43 HR runtime files passed |
| Configured TiDB databases | Three connections passed; six Finance and four attendance read paths passed |

Total: **1,822 unit/regression tests, 40 API checks and 68 browser checks passed**.

## Fixes

1. Impossible attendance dates such as `2026-02-30` now return a validation error instead of a database/server error. Valid leap days and database timestamps remain supported.
2. Malformed clock times are rejected. An invalid time-out can no longer be silently stored as blank, including during a correction. Valid overnight shifts and intentionally blank optional times remain supported.
3. The attendance page's kiosk link now goes to `/hr/kiosk`, matching the independent HR router.

The Finance import test also used an invalid synthetic source ID. Its fixture now uses the contract's numeric `property:105` format; the application import rules were preserved.

## Workflows checked

- Finance: independent sign-in/session cookies, admin/accountant/viewer permissions, exact-cent calculations, negative opening balances, date filters, reload persistence, form entry, correction lineage, voiding, rollback, concurrent requests, audit history, ZIP import preview/mapping/commit, duplicate detection and reconciliation.
- Attendance: access control, manual entries, date/search filters, overnight shifts, before/after correction history, duplicate and concurrent submissions, holiday classification, calendar, schedule validation, export range validation, kiosk PIN/session/lock, barcode time-in/out and repeated scans. The downloaded Excel workbook was parsed and employee worksheets verified.
- Payroll: attendance-based draft generation, repeat-request safety, final review, frozen snapshots, one successful release under concurrent requests, receipt/history reads and exact-amount outbox delivery to SYSTEM.
- Browser: real local production bundles and APIs, desktop and 390px layouts, navigation/refresh, finance role restrictions and released-payroll visibility. Final checks found no uncaught exceptions or local server errors.

## Features still restricted

- The current HR frontend uses `VITE_HR_STAGING_WRITES=false`: attendance and employee editing are unavailable through that build.
- Kiosk UI is disabled. Its feature flag also requires a development build; setting the flag alone does not activate kiosk mode in a production build. The kiosk API was tested separately using synthetic records.
- The HR payroll UI disables fund release and receipt print/export actions. Signed-receipt backend routes return `503 HR_SIGNED_RECEIPTS_PENDING`.
- The configured Finance environment has imports disabled and production activation disabled. Import writes passed only in the disposable QA environment with its explicit test flags.
- The HR backend explicitly refuses `NODE_ENV=production`.

## Scope and evidence

All test writes used newly created synthetic records in three isolated schemas on a disposable **MySQL 8.0.41** instance bound to `127.0.0.1:13307`. Each service used its own database grants. No existing business records were changed.

The configured **TiDB v8.5.3** databases were checked using read-only queries. Attendance records, calendar, settings and Excel data queries passed, as did Finance dashboard, transactions, categories, audit, import history and reconciliation queries. These checks did not sign in as a real employee, run background jobs, release real payroll or import real transactions.

The local changes have not been deployed. Camera recognition, physical barcode scanners and production write behavior were not tested.

Generated evidence is retained locally and ignored by Git:

- [Unit suite results](evidence/unit-results.json)
- [Build results](evidence/build-results.json)
- [API results](evidence/api-e2e.log)
- [Attendance API results](evidence/attendance-e2e.log)
- [General browser results](evidence/browser-results.json)
- [Finance/attendance browser results](evidence/finance-attendance/results.json)
- [Downloaded attendance workbook](evidence/finance-attendance/attendance-export.xlsx)
- [Configured database read-only results](evidence/live-readonly.json)

Reusable commands and prerequisites are documented in [tools/qa/README.md](../tools/qa/README.md).
