# HR & Payroll API

Render root: SERVER/HR. Build: npm install. Start: npm start. Readiness: /api/v1/health. Liveness: /api/v1/live.

Production is supported. Set NODE_ENV=production, HR_DB_HOST, HR_DB_PORT, HR_DB_USER, HR_DB_PASSWORD, HR_DB_NAME=dc_prime_hr_db, HR_DB_TLS=true, HR_JWT_SECRET (32+ random characters), HR_COOKIE_SECURE=true, and HR_CORS_ORIGIN=https://dc-prime-realty.pages.dev. See [.env.example](.env.example).

The service binds its port before checking the database. The connection, initial query and additive access grants share a bounded startup deadline (HR_DB_STARTUP_TIMEOUT_MS, default 30000). Hosted database connections require verified TLS. Startup idempotently registers the new audit and finalized receipt permissions for existing HR administrator/payroll manager roles. The equivalent SQL is [20261116_live_reports.sql](migrations/20261116_live_reports.sql).

HR writes are enabled by default. HR_READ_ONLY=true pauses business mutations. Old HR_STAGING_ONLY, HR_ENABLE_WRITES and HR_ALLOW_PAYROLL_RELEASE flags no longer gate live work. All employee, attendance and payroll actions retain authentication, permissions, immutable finalization, audit records and release validation.

Attendance background jobs run after readiness unless HR_ENABLE_JOBS=false or HR_READ_ONLY=true. Configure ATTENDANCE_PINCODE and ATTENDANCE_KIOSK_SECRET to use the authenticated kiosk. Never expose these in the frontend.

Every positive payroll release atomically creates a salary event. Optional automatic delivery requires REALTY_FINANCE_SALARY_ENDPOINT and HR_TO_REALTY_INTEGRATION_TOKEN (32+ characters), with the matching token on Realty. HR_ENABLE_SALARY_DELIVERY=false explicitly pauses delivery. Manual Finance exports remain available even without automatic delivery. Released payments lacking a matching event require record review before export.

GET /api/v1/employee-payroll/finance-export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv exports at most 500 immutable salary release/reversal events as a signed Finance CSV. Drafts and unpaid payroll are excluded. Export the original release period and reversal date when undo spans different dates. GET /api/v1/audit-logs supports page, from/to, module and action filters. Access is permissioned; audit metadata is redacted at write time. Signed receipt uploads remain a separate secured-storage feature.

HR administrators can undo finalized or released payroll using their current password and a single-use emailed code. Configure RESEND_API_KEY and EMAIL_FROM on HR, then restart the HR API. HR loads SERVER/HR/.env regardless of the launch directory; hosted environment variables take precedence. HR_PUBLIC_URL is required for password reset links, not payroll undo codes. With Resend's test sender, the administrator's current hr_login_identities.login_email must be the email registered with Resend; other recipients require a verified sender domain. Delivery failures report the applicable sender, key, limit or timeout problem without exposing provider details. Failed deliveries invalidate their code and leave payroll unchanged.

Run `node tools/qa/check-hr-email-config.mjs` from the repository root for an offline check of the saved local HR email settings. It does not send email, contact a database or display secrets. Restart the local HR API after changing its `.env`; the saved file does not change a running or deployed server's environment.

Codes expire in 10 minutes; request and failed-code attempts are limited. Startup applies the additive [undo migration](migrations/20261118_payroll_undo.sql), preserving original approval and receipt evidence. Undo creates a separate cash reversal, returns payroll to Draft and requires recalculation. It does not initiate a bank transfer. [Implementation and verification](../../QA_REPORTS/2026-11-18-payroll-undo-and-connected-fixes.md).

Run npm test and npm run check. [Release evidence](../../QA_REPORTS/2026-11-16-pdf-features-live-operation.md).
