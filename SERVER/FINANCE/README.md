# Finance API

Render root: SERVER/FINANCE. Build: npm install. Start: npm start. Readiness: /api/v1/health. Liveness: /api/v1/live.

Import history and audit history accept `page_size` from 1 to 100 (defaults remain 20 and 50). Counts match the filtered records, and requests beyond the last page return the last available page. The frontend uses 10/20/50-row controls. Deploy this API before publishing the updated pagination controls.

Set NODE_ENV=production, TIDB_HOST, TIDB_PORT, TIDB_USERNAME, TIDB_PASSWORD, TIDB_DATABASE=dc_prime_finance_db, TIDB_SSL=true, FINANCE_COOKIE_SECURE=true, and FINANCE_ALLOWED_ORIGINS=https://dc-prime-realty.pages.dev. See [.env.example](.env.example). Previous FINANCE_STAGING_ENABLED, FINANCE_PRODUCTION_ENABLED and FINANCE_IMPORTS_ENABLED flags no longer gate production operation.

The API binds its port before checking the database. Its probe and invitation schema upgrade share DATABASE_STARTUP_TIMEOUT_MS (default 30000). The upgrade adds missing invitation/undo fields, extends category names to 200 characters, and creates a single-row import mutex. Existing accounts, passwords and ledger records are preserved. If the database user cannot ALTER, apply [07_user_invitations.sql](migrations/07_user_invitations.sql) once before deployment, and apply [08_import_undo.sql](migrations/08_import_undo.sql) for import undo support. Startup upgrades are idempotent.

FINANCE_READ_ONLY=true explicitly pauses business mutations. FINANCE_IMPORTS_READ_ONLY=true pauses only import preview/commit. Role checks, CSRF origin/header checks, login throttling and immutable imported transactions remain enforced.

## Account invitations

Configure **RESEND_API_KEY**, **EMAIL_FROM** (verified sender), and **FINANCE_PUBLIC_URL=https://dc-prime-realty.pages.dev/finance** on this service. Server environment variables are isolated; email settings on the Realty service are not automatically available here.

The `resend.dev` testing sender can send only to the email address registered with Resend. To invite other recipients, verify a sending domain in Resend and use an address on that domain as `EMAIL_FROM`. Changing the invite recipient does not verify a sender domain. See [Resend's documented errors](https://resend.com/docs/api-reference/errors).

Failed invitation warnings distinguish test-sender restrictions, unverified domains, rejected email API keys, sending limits, and timeouts. The account remains pending and can be invited again after resolving the cause. Provider response bodies, keys, and temporary passwords are not returned in these warnings.

Admins supply the name, email and role. An account receives a cryptographically random temporary password by email, valid for 24 hours. Only its salted scrypt hash is stored. Admins never receive it in an API response or audit record. New users must replace it before any Finance endpoint is available. A resend generates a new password and revokes previous sessions. Delivery failure keeps a visible pending invitation with a retry action. Existing users keep their current password.

Admins can delete invitations that have not been accepted, including expired invitations. Deletion rechecks acceptance and administrator access under database locks, removes the invitation's sessions/reset tokens, and records who deleted it. Accepted accounts and accounts with Finance activity cannot be deleted. Disable their access instead. No schema migration is needed for invitation deletion.

## Imports and reports

Dashboard and Reports show gross Money in, gross Money out, Net cash change, and an Actual totals card with money in/out after payroll corrections. The Closing balance summary card is removed; closing balance remains available to the running balance chart and API. Closing balance equals opening balance plus net cash change, so it matches net change only when the opening balance is zero.

Actual totals exclude a posted HR reversal and its exact preceding posted release when their source identities, amounts and dates agree. Multiple undo/re-release cycles retain the latest unreversed release. Older Realty-labelled HR payments require import-receipt proof of external HR origin. Other payroll, genuine refunds and equal-value payments from different employees remain counted. Matching uses source identities rather than descriptions, categories or amount alone.

Corrections apply as of the selected end date. A reversal after that date does not change an earlier report. When a release and reversal fall on opposite sides of the selected start date, the UI explains that actual in minus actual out can differ from the period's gross net movement. Gross charts, category totals, cash flow tables and transaction history retain the original posting dates. The PDF includes the same actual totals and explanation.

Repeated import receipts do not multiply ledger amounts. The existing importer counts each source payment once, including a salary exported from both HR and Company Finances. Both report APIs share one calculation and a single SQL statement for a consistent view of gross and actual amounts. Deploy the Finance API and frontend together for the new actual-total fields; no schema migration is required. [Verification](../../QA_REPORTS/2026-11-18-finance-actual-totals.md).

HR salary events and Company Finances transfers use signed CSV only. ZIP, Excel, unsigned or edited files are rejected. Both producers preserve the same verified, exact-centavo source rows. HR payroll has its own source namespace; repeated salary events exported by either application are recognized. Older external HR salaries labelled Realty are recognized only through a committed import receipt proving their origin. Historical Realty payroll remains distinct.

### Required CSV signing configuration

Set `FINANCE_TRANSFER_SIGNING_SECRET` to the **same dedicated random value** on the SYSTEM, HR, and Finance backend services. It must be between 32 and 512 characters. This is separate from login keys and HR salary-delivery tokens. Keep the value out of frontend variables and source control.

Missing this variable causes `Finance CSV verification is not configured. Please contact your administrator.` A different value on Finance causes signature verification to reject otherwise valid exports. Signature checks remain mandatory.

For Render deployments, set this variable in each backend service's environment, then restart or redeploy those services. Local Git-ignored `.env` files are not deployed with the repository; rebuilding the Pages frontend does not configure the backend key. Reuse the existing shared key when one is already in use so previously exported files remain verifiable.

From a local checkout with all three backend `.env` files configured, run `node tools/qa/check-finance-csv-config.mjs` from the repository root. This read-only check verifies matching keys and passes synthetic exports through the real Finance CSV parser without exposing keys or accessing any database. It checks local settings, not the deployed services.

New manual income and expenses are recorded here. The main system retains historical manual entries but refuses new ones. Salary undo exports include a separate reversal, with new identities for later releases. Import the preceding event first or include the complete sequence in one CSV. Finance blocks removal of an earlier payment while a later salary event remains active; undo later imports first. [Verification and deployment notes](../../QA_REPORTS/2026-11-18-payroll-undo-and-connected-fixes.md).

Administrators upload a file, review it and confirm. No category mapping is required. Import keeps the category names and income/expense types from the file, reuses matching Finance categories and creates missing ones during commit. Inactive categories are reactivated with an audit event. Preview changes neither balances nor categories. Old mapping records remain as historical data; the mapping endpoints and controls are removed.

Completed imports can be undone after reviewing their exact balance impact. The API voids payments only when no other active import includes them, keeps source identities and audit history, and serializes commits/undo operations to avoid duplicate cash or stale decisions. A changed review requires a fresh confirmation. Repeated undo requests are idempotent. Uploading an undone file again restores its original payment records. Altered source fingerprints still require review.

Reconciliation compares only active payments and active import receipts. Completely undone imports reconcile to zero active payments. Manual entries and source files are preserved. This does not substitute for bank reconciliation or source data review.

Run npm test. [Release evidence](../../QA_REPORTS/2026-11-16-pdf-features-live-operation.md).
