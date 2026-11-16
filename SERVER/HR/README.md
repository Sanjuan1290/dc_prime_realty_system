# HR staging backend

Render root: `SERVER/HR`. Build: `npm install`. Start: `npm start`. Health check: `/api/v1/health`.

The service opens `0.0.0.0:$PORT` before checking the database. `/api/v1/live` identifies a running process; `/api/v1/health` stays at `503` until the initial database probe succeeds. A stalled probe exits with `DATABASE_STARTUP_TIMEOUT` and its stage instead of waiting indefinitely. Jobs start only after readiness and their existing enable flags.

Database variables are `HR_DB_HOST`, `HR_DB_PORT`, `HR_DB_USER`, `HR_DB_PASSWORD`, `HR_DB_NAME` and `HR_DB_TLS`. Use the authorized independent HR database and retain verified TLS for hosted TiDB. Optional deadlines default to `HR_DB_CONNECT_TIMEOUT_MS=10000` and `HR_DB_STARTUP_TIMEOUT_MS=30000`.

This source remains staging-only: `HR_STAGING_ONLY=true` is required, `NODE_ENV=production` is rejected, and `HR_JWT_SECRET` must have at least 32 characters. A Render environment inconsistent with the approved staging configuration can prevent startup. Check the startup log rather than changing production or payroll permissions to clear an error.

The existing write, job, payroll-release and salary-delivery flags remain separate controls. See [.env.example](.env.example) for their disabled defaults. Signed receipts remain unavailable.

Run `npm test` for unit checks or `npm run check` for runtime isolation checks. See the [HR/Finance recovery report](../../QA_REPORTS/2026-11-16-hr-finance-recovery.md) for deployment and live-check evidence.
