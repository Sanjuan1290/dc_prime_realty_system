# Attendance, audit cases, documents and Finance transfers

Implemented locally on November 17, 2026. These changes have not been published from this session.

The PDF was reviewed as supporting context. The user's explicit six-item request governs this work. The later clarification keeps **verified CSV-only Finance transfers**; ZIP and Excel have not been restored.

## Attendance and payroll

- New payroll drafts record Scheduled Attendance Hours from scheduled Time In to Time Out, less the overlapping unpaid break. A 09:00–18:00 shift with a 60-minute break records eight hours per scheduled day.
- Attendance Settings shows the calculated shift while editing. A mismatch with the approved regular workday requires acknowledgment before saving. The field now explains its effect on absence deductions and the regular-attendance cap; salary rates continue to use the existing approved 260-day / eight-paid-hour basis.
- New receipts label the approved regular-workday total explicitly. This can still be 110 payroll-basis hours if an approved ten-hour workday remains configured, alongside 88 actual scheduled attendance hours. The warning allows that configuration to be reviewed deliberately.
- Existing unfinalized drafts with outdated scheduled hours require recalculation before finalization. Existing finalized/released receipts use their saved snapshots; no historical receipts are rewritten. Approved corrections capture their own new receipt metrics.

The isolated November 1–15 reproduction used PHP 15,000 monthly salary, Tuesday/Thursday rest days, 11 scheduled workdays, the supplied punch pattern, and 26 late minutes. Results: **88 scheduled attendance hours**, **86 hours 34 minutes worked**, **PHP 86.54 hourly rate**, **PHP 37.50 attendance deduction**, **PHP 7,462.50 net fund release**. Updating the scheduled-hours receipt metric does not change money under the existing approved basis. This reproduction is not a verification of Robert's production payroll, compensation or other adjustments.

## Audit flow and evidence

- Staff entries still pass through their Department Head and then the Auditor. An Auditor with no finding completes the review.
- An Auditor finding now opens a case directly in the appropriate correction queue. Explanation, responder reassignment, second Auditor decision and Auditor recheck are retired steps.
- Applying an authorized record correction preserves the original review evidence and appends a separate saved revision. The case stays in the admin queue until **Resolve with Notes**.
- Resolution requires the correction permission, the exact authorized administrator role, a recorded correction, and 5–5,000 characters of notes. It closes the case and notifies Auditors. Review details display the administrator, notes and timestamp. Duplicate resolution is rejected.
- The existing owner-only Super Admin correction rule is retained.
- On System API startup, legacy open explanation/decision/recheck cases move into the direct correction flow in a transaction. The operation is repeatable. Existing findings, responses, assignments, snapshots and events remain; closed cases are untouched. No new database columns or destructive schema migration are required.

## Current Record and historical review

- Payment View Record now shows the exact payment's buyer, unit, account reference, amount, method, date, reference, status and related SOA descriptions/due dates. It can retrieve voided payments without relying on the normal listing's verified-payment filter.
- Active proofs and the current signed receipt use authenticated content routes bound to the review's payment/project. File previews require an approved security scan. No Cloudinary asset identifiers or permanent URLs are sent in the preview response.
- Current Record and saved Before & After remain separate. Missing historical payment fields show **Not Recorded**. Existing review snapshots are not filled from current data.
- New payment operations capture the schedule description and due date with their review snapshot. An older saved number displays as **Schedule ID #60001**, without inferring an installment label from today's data.

## Documents

- Required/Optional, Responsible Party and Active/Deactivated are plain text. Summary counts are neutral. Colored row status labels are retained for Approved, Missing and Needs Resubmission.
- Each row has one primary action appropriate to its state: Upload File, Upload Corrected Copy, Review File or View File. Approve, Add Files, Request Resubmission and Clear Files are secondary actions when applicable.
- Missing files have no approval action. The backend also rejects approval when a retained record is marked Missing. Menus support Escape, outside click and viewport-aware placement outside the table's scrolling area.

## CSV transfer verification

Verified locally against independent disposable databases and the actual APIs/React components:

- HR exports released salary cash as signed CSV; Company Finances exports its filtered payments as signed CSV.
- Finance validates original files, previews them without changing balances and imports exact cents.
- Edited content, unsigned files, ZIP, Excel and renamed archives are rejected.
- Repeated uploads do not add duplicate payments. An HR salary imported from HR is counted once when the same salary appears in a Company Finances export.
- Undo and restoring an undone import preserve history and correct the ledger balance.

## Validation

- **1,870 unit tests passed** across System, HR, Finance, HR client and Website.
- **55 API/integration checks passed**, run sequentially where they change the isolated ledger.
- **23 browser checks passed**: five new workflow/document/settings checks, six payment/SOA regressions, three CSV export/import checks and nine import/undo checks.
- All four frontend builds passed. `git diff --check` passed.
- No production financial records, employee data, emails or deployment settings were changed by testing.

Evidence: `evidence/pdf3-api-results.json`, `evidence/scheduled-hours-period.json`, `evidence/pdf3-browser/browser-results.json`, `evidence/unit-results.json`, `evidence/build-results.json`, plus the CSV/import-undo/payment browser artifacts.

Reproduction: start the QA-owned MySQL instance on loopback port 13307, run `node tools/qa/setup-local-db.mjs --reset`, start `node tools/qa/serve-local.mjs`, then run `node tools/qa/run-pdf3-api-checks.mjs`. The setup script verifies the disposable database's port and data directory before any reset. The scripts must not be pointed at production.

## Deployed verification still pending

Read-only public health requests on **November 17, 2026 at 1:27 PM Asia/Manila** returned:

| Public API | Result |
| --- | --- |
| System `/api/v1/health` | 200, API healthy |
| HR `/hr-api/api/v1/health` | 503, SERVER_WAKING_UP; Retry-After 60 seconds |
| Finance `/finance-api/api/v1/health` | 503, SERVER_WAKING_UP; Retry-After 60 seconds |

System initially returned 503 and subsequently recovered. HR and Finance continued returning 503 across spaced checks. This does not establish the cause of their unavailability. See `evidence/pdf3-public-health.json`.

Authenticated deployed CSV previews, live totals, duplicate checks and undo checks remain unverified. Render access has been offered but is not connected in this session; no deployed test ledger/account has been identified. Those checks need healthy HR/Finance services and a designated test ledger. Local builds and tests are not evidence of deployment.

Deployment requires publishing the changed System and HR API code and rebuilding/publishing the four-app client bundle through the existing deployment process. System performs the data-only open-case transition at startup. Keep the existing database contents, payroll snapshots and shared Finance CSV signing secret. After publishing, check all three public health routes and run CSV preview/import/duplicate/undo checks in the designated deployed test ledger.
