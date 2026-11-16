# Finance API

Render root: SERVER/FINANCE. Build: npm install. Start: npm start. Readiness: /api/v1/health. Liveness: /api/v1/live.

Set NODE_ENV=production, TIDB_HOST, TIDB_PORT, TIDB_USERNAME, TIDB_PASSWORD, TIDB_DATABASE=dc_prime_finance_db, TIDB_SSL=true, FINANCE_COOKIE_SECURE=true, and FINANCE_ALLOWED_ORIGINS=https://dc-prime-realty.pages.dev. See [.env.example](.env.example). Previous FINANCE_STAGING_ENABLED, FINANCE_PRODUCTION_ENABLED and FINANCE_IMPORTS_ENABLED flags no longer gate production operation.

The API binds its port before checking the database. Its probe and invitation schema upgrade share DATABASE_STARTUP_TIMEOUT_MS (default 30000). The upgrade adds three columns if missing; it never resets existing accounts or passwords. If the database user cannot ALTER, apply [07_user_invitations.sql](migrations/07_user_invitations.sql) once before deployment, then the upgrade is a read-only schema check.

FINANCE_READ_ONLY=true explicitly pauses business mutations. FINANCE_IMPORTS_READ_ONLY=true pauses only import preview/commit. Role checks, CSRF origin/header checks, login throttling and immutable imported transactions remain enforced.

## Account invitations

Configure **RESEND_API_KEY**, **EMAIL_FROM** (verified sender), and **FINANCE_PUBLIC_URL=https://dc-prime-realty.pages.dev/finance** on this service. Server environment variables are isolated; email settings on the Realty service are not automatically available here.

Admins supply the name, email and role. An account receives a cryptographically random temporary password by email, valid for 24 hours. Only its salted scrypt hash is stored. Admins never receive it in an API response or audit record. New users must replace it before any Finance endpoint is available. A resend generates a new password and revokes previous sessions. Delivery failure keeps a visible pending invitation with a retry action. Existing users keep their current password.

## Imports and reports

HR released salary exports and Company Finances transfers support ZIP and Excel. Both contain the same checksum-verified, exact-centavo v1 rows. HR payroll has its own source namespace; repeated salary payments exported by either application are recognized. Older external HR salaries labelled Realty are recognized only through a committed import receipt proving their origin. Historical Realty payroll remains distinct.

An administrator maps each source category to an active Finance category of the same income/expense type, then previews and confirms the file. Preview does not change balances. Commit checks the source fingerprint and category mapping again in one transaction. Reconciliation compares the ledger with saved receipts for both sources. It does not substitute for bank reconciliation or source data review.

Run npm test. [Release evidence](../../QA_REPORTS/2026-11-16-pdf-features-live-operation.md).
