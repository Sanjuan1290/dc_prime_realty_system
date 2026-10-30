# Apply Batch 14 — Finance Reconciliation (STAGING ONLY)

**Prerequisites:** Apply Batch 4 workspace, Batch 12 Finance application and Batch 13 import overlay in that order. Batch 11 Realty export contract must be used for source files. All prior live acceptance gates remain pending.

## Files

- `apps/finance-server/src/reconciliationPolicy.js` — exact peso reconciliation policy with error codes.
- `apps/finance-server/src/reconciliation.js` — SELECT-only Finance snapshot queries.
- `apps/finance-server/src/launchGates.js` — evidence checks, never deploys.
- `apps/finance-server/src/server.js` — Batch 13 server plus a **read-only, admin-only** reconciliation endpoint.
- `apps/finance-server/scripts/batch14-readiness.mjs` — create/validate manual sign-off evidence.
- `apps/finance-server/tests/batch14Reconciliation.test.mjs` — offline Finance verification regression cases.
- `apps/finance-client/src/FinanceReconciliation.jsx` — admin read-only reconciliation panel.
- `apps/finance-client/src/App.jsx` — Batch 13 UI plus new admin tab.
- `docs/migrations/batch14/RECONCILIATION_AND_LAUNCH_RUNBOOK.md` — end-to-end source/target finance validation procedure.

**These two files are full-file overlays** based on Batch 13: `apps/finance-server/src/server.js` and `apps/finance-client/src/App.jsx`. Before applying them, inspect Git changes and merge by hand if your repository has additional work. Do not simply replace files changed after the October 27 export.

## Commands

1. Work on a new branch of a **full checked-out repository**. Back up and verify the Finance staging database.
2. Apply the overlay to matching paths, preserving any local code changes. This patch has no SQL migrations and does not touch Realty/HR DB tables.
3. In a full workspace install dependencies and run `npm test --workspace @dcprime/finance-server` and `npm run build --workspace @dcprime/finance-client`. Run relevant Realty finance and HR regression suites too.
4. Keep `FINANCE_IMPORTS_ENABLED=false` until earlier approval gates permit staging testing. The reconciliation endpoint can run with imports disabled.
5. Start staging Finance API and sign in as an admin; verify `GET /api/v1/finance/reconciliation?from=2026-10-01&to=2026-10-27` returns a read-only report. Verify viewer/accountant receive HTTP 403 and unauthenticated requests receive HTTP 401. Verify no cross-database grants exist.
6. Generate the evidence template using `node apps/finance-server/scripts/batch14-readiness.mjs --template`, gather named test artifacts, and review findings with the business owner.
7. Follow `docs/migrations/batch14/RECONCILIATION_AND_LAUNCH_RUNBOOK.md` and record unresolved exceptions. Do not launch Finance if any exception or previous Batch 1–13 gate remains unresolved.

## Tested offline

- New standalone reconciliation policy and evidence-gate tests.
- Integration with existing Batch 12/13 dependency-free test fixtures.
- Backend JavaScript syntax and static route isolation checks.

Not tested: real TiDB SELECTs, installed HTTP server, browser rendering and deployed infrastructure. The read-only endpoint is internal consistency verification **only**, not authoritative source reconciliation.
