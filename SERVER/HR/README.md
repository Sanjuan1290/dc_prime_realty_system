# HR & Payroll API

Render root: SERVER/HR. Build: npm install. Start: npm start. Readiness: /api/v1/health. Liveness: /api/v1/live.

Production is supported. Set NODE_ENV=production, HR_DB_HOST, HR_DB_PORT, HR_DB_USER, HR_DB_PASSWORD, HR_DB_NAME=dc_prime_hr_db, HR_DB_TLS=true, HR_JWT_SECRET (32+ random characters), HR_COOKIE_SECURE=true, and HR_CORS_ORIGIN=https://dc-prime-realty.pages.dev. See [.env.example](.env.example).

The service binds its port before checking the database. The connection, initial query and additive access grants share a bounded startup deadline (HR_DB_STARTUP_TIMEOUT_MS, default 30000). Hosted database connections require verified TLS. Startup idempotently registers the new audit and finalized receipt permissions for existing HR administrator/payroll manager roles. The equivalent SQL is [20261116_live_reports.sql](migrations/20261116_live_reports.sql).

HR writes are enabled by default. HR_READ_ONLY=true pauses business mutations. Old HR_STAGING_ONLY, HR_ENABLE_WRITES and HR_ALLOW_PAYROLL_RELEASE flags no longer gate live work. All employee, attendance and payroll actions retain authentication, permissions, immutable finalization, audit records and release validation.

Attendance background jobs run after readiness unless HR_ENABLE_JOBS=false or HR_READ_ONLY=true. Configure ATTENDANCE_PINCODE and ATTENDANCE_KIOSK_SECRET to use the authenticated kiosk. Never expose these in the frontend.

Every positive payroll release atomically creates a salary event. Optional automatic delivery requires REALTY_FINANCE_SALARY_ENDPOINT and HR_TO_REALTY_INTEGRATION_TOKEN (32+ characters), with the matching token on Realty. HR_ENABLE_SALARY_DELIVERY=false explicitly pauses delivery. Manual Finance exports remain available even without automatic delivery. Released payments lacking a matching event require record review before export.

GET /api/v1/employee-payroll/finance-export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=zip (or xlsx) exports at most 500 released payments using the Finance v1 contract. GET /api/v1/audit-logs supports page, from/to, module and action filters. Access is permissioned; audit metadata is redacted at write time. Signed receipt uploads remain a separate secured-storage feature.

Run npm test and npm run check. [Release evidence](../../QA_REPORTS/2026-11-16-pdf-features-live-operation.md).
