# D&C Prime Realty — Batch 10 HR Cutover Preparation

**Status: PREPARED, PRODUCTION NO-GO.** This overlay is additive/reversible and does not perform production cutover.

## Apply to a *merged* staging checkout

1. Batches 4–9 must be present, including Batch 8 `server/server.js` and Batch 9 `apps/hr-server/scripts/batch9/manifest.json`.
2. Add `server/middleware/legacyHrFreeze.middleware.js` and tests. **Review** the included `server/server.js` diff against your actual current branch: it is based on Batch 8 server.js and preserves the salary event receiver mount. Do not blindly overwrite a later server version.
3. Copy `apps/hr-server/scripts/batch10`, `scripts/batch10`, `docs/migrations/batch10`.
4. Run the source tests on a merged checkout. Example: `node --test server/tests/batch10LegacyHrFreeze.test.mjs apps/hr-server/scripts/batch10/diffCore.test.mjs`.
5. Keep `HR_LEGACY_MODE=active` by default. Verify smoke tests against local/rehearsal Realty + HR APIs and original users before trying `frozen`.
6. Test `frozen`: legacy HR write routes and Seller Network HR-linked import changes reject; property payments, public buyer forms and Realty finance routes are unaffected. Verify the legacy attendance scheduler stops on ALL replicas. Secure DB-level write restrictions and other writing paths separately.
7. Read `HR_CUTOVER_RUNBOOK.md`, `ROLLBACK_AND_FINANCE_RECONCILIATION.md` and fill `evidence.template.json` **with real externally verified evidence**, never placeholder approvals.
8. Run `node scripts/batch10/readiness.mjs /path/to/filled-evidence.json`. This only checks evidence document completeness. It does NOT certify, deploy, flip finance mode or run migrations.
9. The comparator has no write mode. Use verified SELECT-only database principals and explicit staging flags. Any row difference is a hard NO-GO, and extra settings/audit/file/finance checks still apply.

## What this package does not do

- Does not enable Batch 6/8 production-blocked HR API, salary receiver, or event worker.
- Does not implement an incremental HR final-delta synchronizer.
- Does not apply SQL, provision credentials, enable production sessions, migrate Cloudinary assets or fix Seller Network employee-link writes.
- Does not auto-switch to `FINANCE_SALARY_SOURCE=external`.
- Does not delete the original HR tables or turn off source DB privileges.

**Remaining dependency:** Actually complete Batch 1 restore, Batches 5–9 staging, actual signed receipt access, seller links, finance correction policy, and production-safe service deployment before live cutover.
