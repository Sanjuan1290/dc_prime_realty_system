# PDF 4 fixes and connected workflow verification

Implemented and verified locally on November 18, 2026 (Asia/Manila). The user's instruction to implement and test follows the earlier six-page PDF review. No deployment or production data changes were performed.

## Delivered changes

| PDF page | Result |
| --- | --- |
| 1: Undo finalized/released salary | HR administrators can return a payroll to Draft with their current password and a single-use emailed code. Original approval, receipt, actor, reason and reversal evidence remain in immutable undo history. Recalculation is required before finalizing again. |
| 2: Move manual income/expenses to Finance | New manual entries are available in Finance. The main-system creation API refuses new entries and its page links to Finance. Existing manual entries retain their review, correction, void and signed export behavior. |
| 3: Readable HR/Finance audit details | Both applications show named actors, Manila timestamps, labelled fields, currency amounts and before/after tables when those values were recorded. Malformed historical details are handled safely; credentials are hidden. No raw JSON is displayed. |
| 4: Document status colors | Submitted, Approved, Missing and Needs Resubmission have distinct badges. Required/Optional and Active/Deactivated also have visible badges with text labels. Missing documents still cannot be approved. |
| 5: Protected-file export failure | The shared download error handler now defines its request method. HTTP errors retain their actual status and actionable message, while provider HTML remains hidden. Actual signed Company Finances CSV downloads passed Finance parsing. |
| 6: Salary release unavailable | The Batch 8 placeholder is replaced by the release form and real API call. Payroll and employee-history entry points honor release permissions. Release, acknowledgement receipt and printing were exercised in the browser. |

## Payroll and Finance consistency

Verification codes expire after 10 minutes, allow five failed confirmation attempts and cannot be reused. Database-backed request throttling includes wrong administrator passwords. A code is tied to the administrator identity, payroll state, reason and reversal date. Changed payroll/account state requires a new code; failed email delivery invalidates the challenge.

Released payroll can be undone only after explicitly confirming that the payment was recorded incorrectly or its funds were returned. Undo records an offset; it does not move money through a bank. A payroll with missing approval/cash evidence requires reconciliation rather than fabricated history.

Cash events keep their original identity and fingerprint. Reversals and subsequent releases receive separate ordered identities. HR and Company Finances produce matching signed CSV rows. Export both the original release period and the reversal date when they differ. Finance rejects a reversal without its preceding payment, prevents removing an earlier imported payment while later salary events remain, and supports ordered undo/restoration without duplicate cash. Salary Paid totals subtract reversals.

An individually verified undo can recalculate that employee's Draft inside a closed payroll period without reopening the shared period or other employees' payroll.

## Verification results

All tests used synthetic accounts and independent databases on the guarded QA-owned MySQL instance at loopback port 13307. Private production environment files were excluded. Email delivery was captured in memory. This verifies MySQL 8.0.41 behavior, not a hosted TiDB migration rehearsal.

| Verification | Passed |
| --- | ---: |
| Unit tests: System 1,751; HR 27; HR client 9; Finance 78; Website 9 | 1,874 |
| Existing API suites: baseline 25; CSV 6; invitations/reports 7; import undo 8; review/documents 6; scheduled hours 3 | 55 |
| New payroll undo/release/Finance/API checks | 19 |
| Connected attendance 15; payroll history/dates 6; password recovery 3 | 24 |
| New browser checks, including mobile and actual production audit screens | 9 |
| Connected browsers: CSV 3; review/documents 5; import undo 9; Finance/attendance 13 | 30 |
| HR/Finance startup, stalled connections, readiness and production TLS | 10 |
| Frontend production builds | All four |

New API checks include concurrent undo, replay/expiry/replacement/guessing of codes, password and role checks, failed email, mandatory recalculation, closed periods, missing cash events, stale previews, reversal dependencies, exact balance offsets, HR/Realty deduplication and correct Manila audit timestamps. Browser checks include cancellation/focus, wrong password/code feedback, original receipt watermarking, undo through re-release, status colors, safe download failures and readable audit screens.

Evidence is under ignored `QA_REPORTS/evidence`: `unit-results.json`, `build-results.json`, `pdf3-api-results.json`, `pdf4-api.log`, `pdf4-connected-api-results.json`, `pdf4-connected-browser-results.json`, `pdf4-attendance.log`, `pdf4-browser/browser-results.json`, related screenshots, and the existing CSV/import-undo/Finance-attendance browser result files. `git diff --check` passed.

Reproduce after the guarded database setup and QA adapter described in `tools/qa/README.md`: run `node tools/qa/run-pdf3-api-checks.mjs`, then `node --test tools/qa/pdf4-workflows.e2e.test.mjs`, then `node tools/qa/pdf4-browser.mjs`. The new API suite expects fresh fixtures; rerun the complete guarded setup before repeating it. Browser failure recovery uses the real recalculation/finalization/release APIs. Restart the QA adapter between large sign-in batches if its normal login throttle is exhausted.

## Deployment requirements and verification limits

Publish the changed System and Finance APIs before enabling HR reversals, then the HR API and rebuilt four-application client bundle. System accepts ordered reversal/re-release events; Finance must accept those signed rows before operators import them. Keep existing databases, signing secrets, integration tokens and payroll history.

HR startup idempotently applies `SERVER/HR/migrations/20261118_payroll_undo.sql`: two HR-owned tables and the administrator-only undo permission. The migration can also be applied separately by the database operator. It does not rewrite existing payroll, accounts or ledger entries.

Configure `RESEND_API_KEY`, verified `EMAIL_FROM` and `HR_PUBLIC_URL` on the HR service for verification email. Settings on another service are not inherited. Live email delivery and authenticated deployed workflows remain unverified. After deployment, verify the three API health routes and perform a controlled release/undo/export/import check using a designated test payroll and ledger.
