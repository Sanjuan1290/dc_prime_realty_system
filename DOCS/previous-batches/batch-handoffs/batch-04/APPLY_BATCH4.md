# D&C Prime Realty — Batch 4 Add-Only Workspace Patch

This ZIP contains **only newly introduced paths** for the seven-app monorepo layout. It deliberately excludes original `client/`, `server/`, SQL backups, media and all secrets.

## Apply to a complete, backed-up Git checkout

1. Make a new branch, such as `git checkout -b separation/batch-04-workspace`. Confirm `git status --short` is clean, and save the commit hash.
2. Extract this archive to a separate folder, **not directly over a live deployment**.
3. Check for path collisions. Copy `package.json`, `apps/`, `packages/`, `scripts/` and `docs/` into the original repository. If any destination already exists, review it first; **do not overwrite** existing content. The provided apply document itself can also be copied.
4. From the repository root, run `npm run check:workspace`. It requires the real legacy files to be present.
5. From `client/`, run `npm ci`, `npm run lint` and `npm run build` with the existing client lockfile. From `server/`, run `npm ci`, `npm run check:imports` and `npm test` with the existing server lockfile. Run backend build/HTTP checks only against an isolated staging DB.
6. **Do not run root `npm install` or root `npm ci` yet.** The original repository has two separate lockfiles; when ready, create and review a combined workspace root lockfile, test it on a clean branch and check that it does not unexpectedly change dependency versions.
7. Verify current routes, buyer forms, payments/SOA, seller network, kiosk, salary and scheduled jobs from the verified full checkout before approving further migration.
8. Commit only after review. Do not delete, rename or relocate `client/` or `server/` in Batch 4.

## Preservation details

- `client/vite.config.js` currently specifies port **5174**; `server/server.js` currently uses **5001** as fallback and starts BOTH the property penalty and attendance timeout schedulers.
- `server/db/connect.js` uses `TIDB_HOST`, `TIDB_PORT`, `TIDB_USERNAME`, `TIDB_PASSWORD`, `TIDB_DATABASE`, `TIDB_SSL`. Future service `.env.example` files follow this convention.
- `server/server.js` currently exposes `/api/v1/health`. Placeholder APIs do not implement it yet.
- `client` and `server` are workspace names in their existing package manifests, preserved as-is.

## Rollback

Before migrating live business records, revert the Batch 4 add-only commit. No DB rollback is involved because this patch performs no SQL operations and changes no existing source or deployment files.

After a production cutover in later batches, rollback becomes a data reconciliation operation and this simple approach will no longer suffice.

## Security

Never commit `.env` files, database dumps, credentials or payroll/buyer documents. Existing `.gitignore` rules ignore `.env` variants while allowing `.env.example`. The ZIP includes only blank secret fields.
