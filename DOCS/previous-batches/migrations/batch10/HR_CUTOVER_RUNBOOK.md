# Batch 10 — HR Production Cutover Runbook (PREPARATION ONLY)

**Current disposition: NO-GO.** Batches 1, 5–9 have outstanding TiDB staging and production gates. Batch 6/8 HR server, outbox sender and Realty salary receiver contain explicit `NODE_ENV=production` refusals. This overlay does **not** remove them or trigger deployment.

## Go/no-go prerequisites

1. Restore a verified *fresh* production backup into an isolated non-production TiDB instance; verify source SQL version, TiDB FK support and row parity. Do not rely on the October 27 static SQL snapshot for a later cutover.
2. Assemble combined Batch 4–9 overlays in one full Git checkout; install dependencies; pass full server/client/HR tests and builds. Run migration and API smoke tests on real staging DBs.
3. Verify HR-owned logins, identity mappings, permissions and actual protected Cloudinary receipt download/upload, scanning and callback ownership. No historical Realty login hash grants independent HR access.
4. Finish the Seller Network ↔ HR employee links design. Existing seller import `commit` and `undo` directly UPDATE Realty `employees`; a route freeze alone is insufficient, as legacy workers or other privileged processes may still write.
5. Define payroll correction/reversal and cash-advance accounting. Contract v1 supports **salary.cash_released.v1** only. Reject production salary corrections/reversals unless approved integration code handles their financial effect.
6. Resolve production startup gates safely: independent HR backend in Batch 6/8 refuses prod, Realty receiver in Batch 8 refuses prod, HR outbox worker also refuses prod. Requires independently reviewed production-grade implementations with deployed auth/network, monitoring, scheduler leader election and secrets management. Do not just delete a `production` condition.
7. Compare HR payroll cash release entries against Realty salary projections by **release ID, amount in cents, release date, correction state and aggregate totals**, including old and new records. `FINANCE_SALARY_SOURCE=legacy` until parity and checkpoint are approved.
8. Conduct timed cutover rehearsal and document named approvers, maintenance window, and downtime communication; proof stored outside the production app.

## Rehearsal sequence in isolated staging

1. Keep Realty authoritative; HR still read-only. Make and verify a new backup. Record HR table counts, digests, max IDs, salary cash totals, last modified timestamps, receipt metadata and pending outbox events.
2. Set `HR_LEGACY_MODE=frozen` on every **legacy Realty API replica**. Confirm POST/PATCH/PUT/DELETE under `/employees`, `/attendance`, `/employee-payroll`, `/attendance-kiosk` respond 423. Confirm Seller Group `/members/import/commit` and `/members/import/{batchId}/undo` also respond 423.
3. Disable the *legacy attendance auto-timeout scheduler* everywhere. Audit and suspend any cron/queue/manual script still modifying HR tables. Add DB-level write restrictions on legacy HR tables to prevent old background jobs or alternative DB clients from writing. Test denial under the actual application DB principal.
4. After checking active DB sessions for in-flight HR transactions, perform a **new final consistent snapshot**. Run `compare-readonly.mjs` against the frozen source and HR target. It reports per-table source-only/target-only/changed counts and digests without printing employee details.
5. **If mismatches exist, STOP.** Batch 9 `migrate-staging --copy` is an empty-target initial loader, *not* an incremental synchronization tool. Use an independently tested final-delta migration or rebuild an approved empty target and rerun initial load; avoid deleting existing HR user credentials/approved writes. Compare again; all 17 tables must match.
6. Reconcile `hr_settings`, linked identities, HR live/archive audits and Cloudinary receipts separately; table comparison covers only the 17 HR business tables.
7. Reconcile HR historical salary outbox -> Realty local salary expenses including duplicate replay, token denial, stale checkpoint and correction/reversal cases. Approve finance-source change only after every record matches, not just totals.
8. Deploy reviewed **production-capable** HR API, auth, web frontend, attendance kiosk and job ownership (not supplied here). Establish no simultaneous writes and no double scheduler. Verify HR read and write flows, salary release / receipt processes, login, role scope, health endpoints.
9. With owner sign-off, route HR users to the independent HR app. Set `HR_LEGACY_MODE=retired` only after old HR reads and writes are no longer needed. Keep old HR tables retained and read-only until Batch 16 cleanup.
10. Monitor payroll releases, event lag, attendance scans, role denial, customer public forms, Realty collections and Company Finances. Declare success only after agreed observation window and human approval.

## Verification commands on merged **staging** checkout

```bash
node --test server/tests/batch10LegacyHrFreeze.test.mjs
node --test apps/hr-server/scripts/batch10/diffCore.test.mjs
node scripts/batch10/readiness.mjs docs/migrations/batch10/evidence.template.json
# Expected exit code 2 = blocked while evidence remains pending.
# After verified SELECT-only staging connections and legacy write freeze:
node apps/hr-server/scripts/batch10/compare-readonly.mjs
```

## Safety boundary

The middleware protects selected HTTP routes. It cannot stop SQL writes from source DB service accounts, other routes, old server builds, or background processes. Do not call this a complete freeze without DB-level privileges, scheduler verification, and a Seller Network integration fix.

**No scheduled time or production cutover approval is provided by this package.**
