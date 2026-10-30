# Apply Batch 15 — Verification and Cleanup Approval Preparation (NON-DESTRUCTIVE)

This package makes two **validation-only** checker updates and adds evidence/decision documents. It does not enable production, migrate data, alter business calculations, or contain DROP statements.

## Prerequisites

Use a full Git checkout on a new branch. Apply Batches 4–14 in order (and merge any full-file overlays carefully). Keep the original legacy client/server operational until independently approved cutover.

## Safe file changes

- `scripts/verify-workspace.mjs` — replaces outdated placeholder-only assumptions with promoted-app validation, checks expected app/env names and requires blank credential templates.
- `apps/hr-server/scripts/check-isolation.mjs` — scans only ongoing HR runtime modules, not intentional Batch 9 historical migration scripts. Historical migration code still requires separate DBA review.
- `scripts/batch15/readiness.mjs` — read-only evidence completeness check; never authorizes cleanup or deploys.
- `docs/migrations/batch15/*` — reports, table decisions, transfer regression list and evidence template.

## Verification commands (run from the workspace root)

```bash
npm run check:workspace
node apps/hr-server/scripts/check-isolation.mjs
node scripts/batch15/readiness.mjs
node --test apps/hr-server/tests/*.test.mjs
node --test apps/hr-client/tests/*.test.mjs
node --test apps/finance-server/tests/*.test.mjs
npm --prefix server test
```

The readiness script **should exit non-zero** while proof is missing. Do not override this exit code when deciding on rollout. The source export cannot prove readiness; use a restored database and real staging deployment.

No production database is connected. Do not run migration or DDL cleanup as part of this package.
