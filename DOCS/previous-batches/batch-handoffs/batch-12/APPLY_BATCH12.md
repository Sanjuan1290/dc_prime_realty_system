# D&C Prime Realty — Batch 12 Finance Management (staging-only overlay)

**Baseline:** Batch 4 monorepo scaffold and Batch 3 architecture. This overlay replaces the two Batch 4 **placeholder** folders `apps/finance-client` and `apps/finance-server` only. It does not edit the existing root `client/`, `server/`, Realty SQL schema or Batch 11 exports. Extract and review in a separate folder; do not overwrite unrelated application edits.

## Step-by-step staging setup

1. Back up and verify the complete Git checkout and working staging environment. Keep your original Realty and HR systems running normally. Use a dedicated Git branch. **Batch 1–11 live acceptance is still pending; do not deploy this to production.**
2. Review these Finance-only files and merge the two app folders into your Batch 4 workspace. Root npm workspaces already includes both paths; no need to modify the existing Realty/HR folders.
3. Create a dedicated TiDB **staging** database using `apps/finance-server/migrations/01_create_finance_db.sql`, then select **only** `dc_prime_finance_db` and apply `02_create_finance_schema.sql`. Perform an approved staging restore before any migration, and test with a least-privilege DB account limited to the Finance database.
4. Run read-only `03_verify_finance_schema_readonly.sql`. Confirm the database name and five expected Finance tables. Do not attempt to copy Realty or HR tables.
5. From `apps/finance-server`, install pinned dependencies in the **full repository checkout**, generate/review the correct workspace lockfile, and run `npm test`. Do not treat this source export as an installed production application.
6. Copy `.env.example` to a local `.env` **excluded from Git**. Set dedicated staging TiDB credentials, `FINANCE_ALLOWED_ORIGINS=http://localhost:5177`, and `FINANCE_STAGING_ENABLED=true`. `FINANCE_PRODUCTION_ENABLED=false` remains unchanged. Never reuse Realty/HR DB credentials.
7. Create the first Finance admin in staging with `FINANCE_ADMIN_EMAIL`, `FINANCE_ADMIN_NAME`, `FINANCE_ADMIN_PASSWORD` set only for the one-time CLI command: `node scripts/create-admin.mjs`. Use a fresh 12+ character password and promptly unset/delete the bootstrap password from environment variables. No default login is supplied. Bootstrap refuses a nonempty user table.
8. Start backend with `npm run dev` in `apps/finance-server` (port **5103**) and frontend with `npm run dev` in `apps/finance-client` (port **5177**). The client proxies `/api` to the Finance backend in development. Both apps are independent of the Realty/HR APIs.
9. Test login/logout, role authorization, income/expense categories, a PHP 0.01 entry, a posted transaction, void and correction audit, date filters, zero opening balance, and backend failure behavior. Verify duplicate simultaneous corrections cause at most one replacement.
10. Run final authenticated API integration tests and frontend `npm run build` and smoke tests from the installed checkout; compare financial results with known examples. Record screenshots and request logs **without** saving credentials.

## UI/API scope

- `GET /api/v1/health`
- `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/auth/me`
- `GET /api/v1/finance/dashboard`, `GET /api/v1/finance/transactions`, `POST /api/v1/finance/transactions`
- `POST /api/v1/finance/transactions/:id/void`, `POST /api/v1/finance/transactions/:id/correct`
- `GET /api/v1/finance/categories`, `POST /api/v1/finance/categories`, `PATCH /api/v1/finance/categories/:id`
- `GET /api/v1/finance/audit`, `GET /api/v1/finance/users`, `POST /api/v1/finance/users`

Admin manages categories, corrections, voids, Finance-only accounts, and reads audit. Accountant posts transactions and reads reports. Viewer reads only. API enforces permissions; the UI is not the permission boundary. All editing requests require an allowed Origin plus `X-Requested-With: dcprime-finance`. Finance sessions use random opaque tokens stored hashed in the Finance DB. Their cookies are HttpOnly and host-only, with Secure enabled in production. Admin account creation is available; public registration, password reset, account invitation, and account deactivation flows remain unavailable and require review before production acceptance.

## Financial safety

- New Finance ledger starts at **PHP 0.00**, independent from Realty and HR.
- Cash movements are positive `DECIMAL(16,2)` values; `kind` tells income vs expense.
- Dashboard reports opening, selected-period income/expenses, and closing through the end date. Voided entries are excluded but remain in history.
- Manual correction atomically voids an existing entry and creates a linked new entry; no silent overwrite or DELETE endpoint.
- Realty Batch 11 transfers are **not** imported yet. Batch 13 will implement manifest+checksum validation, spreadsheet safe text decoding, category mapping, source IDs, dedupe, corrections and audit. **Do not manually copy source cash movements and then import them again.**
- No application connects to `dc_prime_realty_system_db` or `dc_prime_hr_db`.

## Known limitations / required production gates

- This artifact is a **staging-only source overlay**, not a deployed app. Offline unit/static checks do not replace `npm ci`, Vite compilation, HTTP and TiDB testing.
- No signed import, source adjustment feed, scheduled backups, MFA, password reset, account invitation/management UI, distributed login throttling, automated session cleanup, or production monitoring in this batch. Provision these before production based on security requirements.
- The currently implemented login throttle is in-memory and applies only per application process. For production, use shared server-side/edge rate limiting and review `trust proxy` configuration.
- TiDB/SQL syntax, constraints and migration reruns need real staging verification. `CREATE TABLE IF NOT EXISTS` is **not** a schema drift detector; inspect preexisting tables before applying.
- Secret templates contain no credentials. Never commit local `.env`, passwords, SQL dumps, or exported financial records.
- No production approvals or migrations are implied by packaging this overlay.

## Rollback

Before any production Finance writes, reverting the two new app-folder commits and dropping the **isolated empty staging Finance database** is enough, subject to staging retention rules. If live data has been posted, export/reconcile and obtain approval before dropping anything; never silently discard ledger history.
