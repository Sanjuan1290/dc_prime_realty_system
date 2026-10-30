# Batch 13 — Apply overlay to D&C Prime Realty monorepo

**STAGING ONLY until the Batch 1/5–12 acceptance gates are complete.** This patch is built against the independent Batch 12 Finance app and the Batch 11 export contract. No production database was accessed.

## Files changed

- `apps/finance-server/src/server.js`: new authenticated admin-only Finance import endpoints, opt-in enable flag and per-route upload size cap.
- `apps/finance-server/src/importContract.js`: exact v1 source validation, CSV parser, checksums, revision and totals validation.
- `apps/finance-server/src/importFile.js`: ZIP and XLSX reader, formula/metadata checks and file limits.
- `apps/finance-server/src/importService.js`: category approvals, preview staging, duplicate/conflict classification and atomic commit.
- `apps/finance-server/migrations/04_finance_import.sql`: three Finance-owned tables plus description column capacity.
- `apps/finance-server/package.json`: JSZip/ExcelJS dependency declarations.
- `apps/finance-server/tests/batch13Import.test.mjs`, `tests/isolation.test.mjs`: new and updated offline tests.
- `apps/finance-server/.env.batch13.example`: disabled-by-default gate.
- `apps/finance-client/src/App.jsx`: adds independent Finance Imports navigation.
- `apps/finance-client/src/FinanceImport.jsx`: preview/approval/history screen.
- `docs/migrations/batch13/FINANCE_IMPORT_CONTRACT_v1.md`: contracts and limitations.

## Apply

1. Restore a **full repository checkout**, then apply Batch 4, Batch 12 and Batch 11 changes as required; apply this overlay to the corresponding paths without deleting existing code. Review with Git diff.
2. Confirm the target database is **`dc_prime_finance_db`**, not Realty/HR. Back it up; restore independently in isolated staging. Review and execute `04_finance_import.sql` on *that* staging database after Batch 12 migrations.
3. Install dependencies from the workspace root: `npm install`; build Finance frontend `npm run build --workspace @dcprime/finance-client`; run tests `npm test --workspace @dcprime/finance-server`.
4. Start with `FINANCE_IMPORTS_ENABLED=false` and verify that posting previews returns `IMPORT_DISABLED`.
5. With staging owner approval, set `FINANCE_IMPORTS_ENABLED=true`, restart isolated Finance API and verify login, CSRF, viewer/accountant authorization, category mapping permissions, preview, confirmation, repeat upload, conflicting source, stale preview and rollback on DB failures.
6. Generate real matching Batch 11 ZIP/XLSX exports **only from reconciled Realty staging**. Confirm all reported totals, income/expense signs, historical salary source and source identities.
7. Verify Finance dashboard and transaction counts after imports; test database restore, audit receipts and file upload limits.
8. Return the enable flag to false if acceptance is not complete. Do not activate in production solely from offline test results.

## Recovery

- Roll back the code/flag first. New schema is additive except the VARCHAR(1500) widening.
- Do not delete committed Finance import batches/transaction rows manually; reconcile cash postings before any rollback. Restoring an older DB snapshot after new writes loses those writes and requires a deliberate merge.
- No original Realty `client/`, `server/`, or SQL backup records are changed by this patch.

## Pending before acceptance

Actual TiDB migration/constraint test, full npm install and frontend build, real XLSX/ZIP roundtrip using the pinned dependencies, authenticated API test, database concurrency test, provenance controls, staging rollback test, and salary history reconciliation from previous batches.
