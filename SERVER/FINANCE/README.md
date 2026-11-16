# Finance backend

Render root: `SERVER/FINANCE`. Build: `npm install`. Start: `npm start`. Health check: `/api/v1/health`.

The service opens `0.0.0.0:$PORT`, then checks its database with a bounded `SELECT 1`. `/api/v1/live` identifies a running process. `/api/v1/health` and business routes return `503` until database readiness. A failed or stalled startup check logs a code/stage and exits. Health requests do not accumulate unbounded database probes.

Database variables are `TIDB_HOST`, `TIDB_PORT`, `TIDB_USERNAME`, `TIDB_PASSWORD`, `TIDB_DATABASE=dc_prime_finance_db` and `TIDB_SSL`. Keep verified TLS enabled for hosted TiDB. Optional deadlines default to `TIDB_CONNECT_TIMEOUT_MS=10000` and `DATABASE_STARTUP_TIMEOUT_MS=30000`.

Startup still requires an explicitly approved mode: non-production uses `FINANCE_STAGING_ENABLED=true`; production requires `FINANCE_PRODUCTION_ENABLED=true`. The production flag remains disabled by default. Check that Render matches the intended approved configuration. Imports have their own `FINANCE_IMPORTS_ENABLED` gate and are not activated by startup changes.

Set `FINANCE_ALLOWED_ORIGINS` to the authorized frontend origin and keep the existing session-cookie settings. Authentication, CSRF, role checks and the eight-attempt login window remain enforced. Throttled login responses include the remaining `Retry-After` interval.

Run `npm test` for unit checks. See the [HR/Finance recovery report](../../QA_REPORTS/2026-11-16-hr-finance-recovery.md) for deployment and live-check evidence.
