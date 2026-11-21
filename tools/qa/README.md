# Local verification

Run from the repository root using Node 22+ with dependencies installed in the individual application directories and `tools/qa`. Browser scripts use installed Chrome; the focused browser script also accepts `QA_CHROME_PATH`.

```powershell
node tools/qa/check-project.mjs
node tools/qa/check-project.mjs --build
```

The unit runner uses dummy credentials and a closed local database port. The build runner uses existing dependencies, produces combined local bundles in `CLIENT/dist`, and enables HR editing and kiosk mode for local QA. Neither command deploys anything.

API/browser checks require the disposable database from `setup-local-db.mjs` and the real service adapter from `serve-local.mjs`. On Windows, initialize a separate MySQL data directory under `QA_REPORTS/.runtime/mysql`, then run it on **loopback port 13307** using `--no-defaults`, `--bind-address=127.0.0.1` and `--mysqlx=OFF`. Do not point this harness at an existing database. Setup validates both the server port and exact data directory before creating the empty schemas and synthetic accounts. `--reset` recreates only those schemas on that verified disposable instance.

```powershell
node tools/qa/setup-local-db.mjs
node tools/qa/serve-local.mjs
```

Keep the adapter running in one terminal. From another terminal, run these in order on a fresh QA dataset:

```powershell
node --test tools/qa/api.e2e.test.mjs
node --test tools/qa/attendance.e2e.test.mjs
node tools/qa/browser-e2e.mjs
node tools/qa/finance-attendance-browser.mjs
```

The tests deliberately create transactions, attendance and payroll records in the disposable database. Repeat a complete run after stopping the adapter and resetting that disposable dataset; start the adapter again before testing. The adapter does not load application `.env` files and uses only synthetic local credentials. Its payroll jobs and import writes run only against that QA instance.

`node tools/qa/read-only-diagnostics.mjs` is separate: it reads the configured server `.env` files and checks the existing TiDB databases. It does not start services or jobs. Its Finance and attendance application queries are restricted to `SELECT`; it reports status and schema metadata without outputting business records or credentials.

Evidence goes to `QA_REPORTS/evidence`; database runtime files go to `QA_REPORTS/.runtime`. Both directories are ignored by Git. Stop the adapter and disposable MySQL process when finished.

## API startup recovery

After building the local bundles, run `node tools/qa/startup-recovery-browser.mjs`. It starts its own loopback server, runs the real Pages proxy with simulated provider failures, and verifies the production SYSTEM sign-in bundle. It needs no database or running application services. The cases cover startup status failures, failed login during startup, application login limits, HTML rate-limit responses, session outages and gateway errors. It checks retry countdowns, preserved form fields and absence of automatic password resubmission.

`node tools/qa/live-api-diagnostics.mjs` makes three unauthenticated GET requests to the deployed health, public status and current-user endpoints. It never signs in. `--wait-for-health` makes one health request with a longer timeout; `--include-direct` additionally checks the documented Render origin. Its output includes HTTP status and selected routing headers, without credentials. A `401` from `/user/me` is expected without a session.

## SYSTEM startup ordering

Run `node tools/qa/server-startup.mjs` to verify the real SYSTEM entrypoint with a stalled local MySQL handshake, a stalled query and a healthy synthetic connection. It checks early port binding, liveness/readiness status, rejection of login while initialization is pending, bounded startup failure and normal authentication after readiness. It uses only synthetic credentials and does not need an existing database. All temporary processes are stopped when it finishes.

From `SERVER/SYSTEM`, `npm run check:db` is a separate read-only diagnostic using that environment's configured credentials. It runs only `SELECT 1` with the same startup deadline, reports a code/stage on failure and does not start jobs or HTTP routes.

## HR and Finance recovery

- `node tools/qa/hr-finance-startup.mjs` checks both real entrypoints with stalled sockets, healthy/stalled queries, production startup, additive schema initialization, and required production TLS. It uses synthetic connections and does not start business jobs.
- After building, `node tools/qa/hr-finance-recovery-browser.mjs` checks both real login bundles against the local Pages proxy and simulated provider failures. It verifies recovery after five consecutive health failures, cooldowns, retained fields, separate security-check messages and absence of automatic credential resubmission. `node --test SERVER/SYSTEM/tests/apiReadiness.test.mjs` also checks the startup deadline, shared polling and long Retry-After intervals.
- `node tools/qa/live-api-diagnostics.mjs --apps=hr,finance` performs unauthenticated GET checks on their deployed health/session endpoints. Add `--wait-for-health` for a longer single health-request timeout, or `--include-direct --direct-only` to check only the documented Render health origins. It never signs in or changes records. `cf-mitigated` is captured when provided by Cloudflare.

## PDF features and live-operation verification

After creating the guarded disposable database, building and starting the adapter:

1. Run `node --test tools/qa/api.e2e.test.mjs` and `node --test tools/qa/attendance.e2e.test.mjs` to create synthetic employee, attendance, finalized/released payroll and cash fixtures.
2. Run `node --test tools/qa/pdf-features.e2e.test.mjs` for invitations, temporary-password restrictions/expiry, redacted audits, HR and Company Finances signed CSV imports, and old external salary deduplication and automatic categories. Email is captured in memory; nothing is sent to a real inbox.
3. Run `node tools/qa/pdf-features-browser.mjs` for real invitation setup, audit access, salary downloads and Finance layouts. The preceding test creates its single-use synthetic invitation.
4. Run `node tools/qa/finance-attendance-browser.mjs` for financial mutations/reconciliation, viewer permissions, live attendance controls, the kiosk and Excel downloads.

Run **node --test tools/qa/import-undo.e2e.test.mjs** for no-mapping imports, category creation/reactivation, undo/restoration, overlapping files, concurrent commits/undos, stale reviews and reconciliation. Run **node tools/qa/import-undo-browser.mjs** for the actual import/undo UI, cancellation, exact balance changes, failure alerts, keyboard focus, mobile layouts and reduced motion. Both use the same guarded local fixtures; no real accounts or emails are used.

The local adapter intentionally omits the obsolete staging/write-approval flags, proving that the actual business workflows operate with the new live defaults. Private `.env` files remain excluded. Test evidence and the synthetic invitation file are ignored by Git.

## Payroll undo and connected PDF 4 checks

From fresh guarded fixtures, run `node tools/qa/run-pdf3-api-checks.mjs`, then `node --test tools/qa/pdf4-workflows.e2e.test.mjs`, then `node tools/qa/pdf4-browser.mjs`. The API suite creates synthetic salary/attendance records and checks verified undo, release, old receipts, stale/expired/replayed codes, closed periods, cash-event completeness, signed exports, reversal dependencies, exact balances, duplicate imports and undo/restoration. The browser suite runs real components and the production audit screens at desktop and mobile widths. Only email delivery is replaced by in-memory capture.

The new API suite expects a fresh dataset before a complete repeat. Existing CSV, import-undo, review/document and Finance/attendance browser scripts provide connected regressions. Normal login throttling remains enabled; restart only the local QA adapter between large sign-in batches when needed. See [the current verification report](../../QA_REPORTS/2026-11-18-payroll-undo-and-connected-fixes.md) for all results and deployment limits.
