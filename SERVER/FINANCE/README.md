# Finance API

Render root: SERVER/FINANCE. Build: npm install. Start: npm start. Readiness: /api/v1/health. Liveness: /api/v1/live.

Set NODE_ENV=production, TIDB_HOST, TIDB_PORT, TIDB_USERNAME, TIDB_PASSWORD, TIDB_DATABASE=dc_prime_finance_db, TIDB_SSL=true, FINANCE_COOKIE_SECURE=true, and FINANCE_ALLOWED_ORIGINS=https://dc-prime-realty.pages.dev. See [.env.example](.env.example). Previous FINANCE_STAGING_ENABLED, FINANCE_PRODUCTION_ENABLED and FINANCE_IMPORTS_ENABLED flags no longer gate production operation.

The API binds its port before checking the database. Its probe and invitation schema upgrade share DATABASE_STARTUP_TIMEOUT_MS (default 30000). The upgrade adds missing invitation/undo fields, extends category names to 200 characters, and creates a single-row import mutex. Existing accounts, passwords and ledger records are preserved. If the database user cannot ALTER, apply [07_user_invitations.sql](migrations/07_user_invitations.sql) once before deployment, and apply [08_import_undo.sql](migrations/08_import_undo.sql) for import undo support. Startup upgrades are idempotent.

FINANCE_READ_ONLY=true explicitly pauses business mutations. FINANCE_IMPORTS_READ_ONLY=true pauses only import preview/commit. Role checks, CSRF origin/header checks, login throttling and immutable imported transactions remain enforced.

## Account invitations

Configure **RESEND_API_KEY**, **EMAIL_FROM** (verified sender), and **FINANCE_PUBLIC_URL=https://dc-prime-realty.pages.dev/finance** on this service. Server environment variables are isolated; email settings on the Realty service are not automatically available here.

Admins supply the name, email and role. An account receives a cryptographically random temporary password by email, valid for 24 hours. Only its salted scrypt hash is stored. Admins never receive it in an API response or audit record. New users must replace it before any Finance endpoint is available. A resend generates a new password and revokes previous sessions. Delivery failure keeps a visible pending invitation with a retry action. Existing users keep their current password.

## Imports and reports

HR salary events and Company Finances transfers use signed CSV only. ZIP, Excel, unsigned or edited files are rejected. Both producers preserve the same verified, exact-centavo source rows. HR payroll has its own source namespace; repeated salary events exported by either application are recognized. Older external HR salaries labelled Realty are recognized only through a committed import receipt proving their origin. Historical Realty payroll remains distinct.

New manual income and expenses are recorded here. The main system retains historical manual entries but refuses new ones. Salary undo exports include a separate reversal, with new identities for later releases. Import the preceding event first or include the complete sequence in one CSV. Finance blocks removal of an earlier payment while a later salary event remains active; undo later imports first. [Verification and deployment notes](../../QA_REPORTS/2026-11-18-payroll-undo-and-connected-fixes.md).

Administrators upload a file, review it and confirm. No category mapping is required. Import keeps the category names and income/expense types from the file, reuses matching Finance categories and creates missing ones during commit. Inactive categories are reactivated with an audit event. Preview changes neither balances nor categories. Old mapping records remain as historical data; the mapping endpoints and controls are removed.

Completed imports can be undone after reviewing their exact balance impact. The API voids payments only when no other active import includes them, keeps source identities and audit history, and serializes commits/undo operations to avoid duplicate cash or stale decisions. A changed review requires a fresh confirmation. Repeated undo requests are idempotent. Uploading an undone file again restores its original payment records. Altered source fingerprints still require review.

Reconciliation compares only active payments and active import receipts. Completely undone imports reconcile to zero active payments. Manual entries and source files are preserved. This does not substitute for bank reconciliation or source data review.

Run npm test. [Release evidence](../../QA_REPORTS/2026-11-16-pdf-features-live-operation.md).
