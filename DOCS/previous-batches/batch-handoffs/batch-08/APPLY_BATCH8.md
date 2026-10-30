# D&C Prime Realty — Batch 8 Salary Event Transfer (staging overlay)

**Source date:** 2026-10-27. **No production changes have been made.**
**Dependencies:** Batch 4 workspace; Batch 5 HR schema (`hr_outbox_events`); Batch 6 HR backend; Batch 7 frontend remains read-only for salary releases. **Do not apply to production.**

## Purpose

Let Realty Finance report salary expenses without joining the HR database when the approved financial transfer is switched on. Historical cash collection, commission, network payout, manual income/expense, and refund sources remain unchanged. The old HR salary query remains active by default until all source records reconcile.

## Files to overlay (preserve paths)

- `server/services/companyFinances.service.js`: selectable `legacy` / `external` salary branch; uses HR-sync checkpoint in external mode.
- `server/services/salaryEventContract.js`: strict payload validation, canonical hashing, token comparison.
- `server/services/externalSalaryEvents.service.js`: salary-event inbox and cash expense projection in one Realty transaction.
- `server/controllers/System/hrSalaryEvents.controller.js` + `server/routers/System/hrSalaryEvents.router.js`: protected service-to-service endpoint; staging only.
- `server/server.js`: mounts the internal salary integration router; existing routes remain.
- `server/migrations/20261027_batch8_realty_salary_inbox.sql`: **additive** Realty schema for event inbox, local projection and reconciliation checkpoint.
- `server/migrations/20261027_batch8_readonly_verification.sql`: read-only source-vs-projection comparison.
- `apps/hr-server/services/salaryOutbox.service.js`: writes an outbox event within the payroll-release transaction.
- `apps/hr-server/jobs/salaryOutbox.job.js`: disabled-by-default event sender with retry and stuck-delivery recovery.
- `apps/hr-server/controllers/System/Employees/EmployeePayroll.controller.js`: integrates release with event write before DB commit.
- `apps/hr-server/routers/System/employeePayroll.routers.js`: release allowed **only** when staging flags and HR permissions authorize it.
- `apps/hr-server/server.js`: outbox sender starts only under staging write gates.
- `.env.batch8.example` files, tests: configuration templates and test coverage.

## Staging application process

1. Complete outstanding Batch 1 restore and Batch 5/6/7 test gates first. Restore a full SQL copy of Realty into a **separate staging database instance**, not production.
2. Apply `server/migrations/20261027_batch8_realty_salary_inbox.sql` to Realty staging. Check the three new tables. Do not drop any HR table.
3. Apply the source overlay to a new Git branch containing the previous batch code. Retain the original `client/` and `server/` while extracting HR.
4. Set on **Realty staging backend only**:
   - `REALTY_HR_STAGING_ONLY=true`
   - `REALTY_HR_SALARY_INGEST=true` (only after a secured API is ready)
   - `REALTY_HR_INTEGRATION_TOKEN=<random 32+ character secret>`
   - `FINANCE_SALARY_SOURCE=legacy` **until reconciling historical payroll**
5. Set on **HR staging backend only** with the same private token:
   - `HR_STAGING_ONLY=true`, `HR_ENABLE_WRITES=true`
   - `HR_ALLOW_PAYROLL_RELEASE=true`, `HR_ENABLE_SALARY_DELIVERY=true` **only after connected staging verification**
   - `HR_TO_REALTY_INTEGRATION_TOKEN=<matching secret>`
   - `REALTY_FINANCE_SALARY_ENDPOINT=https://<private-Realty-staging-API>/api/v1/internal/finance/salary-events` (actual hostname must be configured by operator)
6. Confirm salary release updates `employee_payrolls` and inserts the same-transaction row in `hr_outbox_events`. Confirm sender delivers exactly once in effect, including lost-response replay. Verify HMAC is **not implemented**: receiver uses a server-only bearer token, TLS, and per-event idempotency. Limit backend endpoint ingress with firewall or private network.
7. **Historical release transfer is not implemented in Batch 8.** After Batch 9 HR data migration, use an approved **idempotent** backfill to produce corresponding historical events and reconcile each payroll ID, cash date, count and cent value. Never switch by looking only at `MAX(released_date)` or an event count.
8. Run read-only verification SQL and confirm total/count parity. Review cash advance status independently; do not assume advances are cash expenses. Record a checkpoint in `finance_hr_sync_state` **only** after signed reconciliation.
9. Enable `FINANCE_SALARY_SOURCE=external` in **isolated staging only** and rerun the finance overview, CSV, balance, source totals and historical-date regression cases. Verify a missing/stale checkpoint forces warnings and `balance_verified=false`.
10. **Leave production untouched.** Keep both salary-ingest and HR-release flags disabled on production. Batch 9 historical migration + Batch 10 cutover approval are prerequisites to production use.

## Missing functions / deliberate limits

- HR salary cash release and same-transaction event emission are implemented behind staging feature guards; not fully connected in a live TiDB instance.
- Correction/reversal/actual salary cash return policy is NOT implemented. Contract v1 only accepts the original `salary.cash_released.v1` event. Payroll corrections do not create fictional cash movement. Don't enable production payroll correction/reversal after cutover until follow-up design and reconciliation are approved.
- No routine historical release backfill yet (Batch 9).
- HR sender sends one queued event per tick by default, and after a failure retries no sooner than one minute. A timeout may cause duplicate send, which Realty must treat idempotently.
- The absence of an HR reconciliation checkpoint or unavailable cash-advance data makes an external-mode finance report unverified even if arithmetic balances.
- Token auth is adequate only behind HTTPS/private ingress on staging; consider mTLS or signed requests for a longer-term production contract.
- The Realty sender endpoint is disabled automatically under `NODE_ENV=production` in this staging overlay. Batch 10 must replace that explicit staging gate after full signoff.
- Cross-system Seller Network ↔ HR employee dependencies remain a Batch 9–10 cutover blocker.

## Regression and quality gates

Run from the combined source checkout, not a ZIP in isolation:

```bash
node --test server/tests/batch8*.test.mjs server/tests/companyFinances*.test.mjs
node --test apps/hr-server/tests/*.test.mjs
node apps/hr-server/scripts/check-isolation.mjs
# Also run npm install, application start/build tests, integration tests, and SQL migration checks in actual staging.
```

## Rollback

Before HR becomes authoritative, leave `FINANCE_SALARY_SOURCE=legacy`, disable the sender and ingest flags, and keep additive staging tables. No financial rows in the source are modified by Batch 8. After new HR production writes occur, reverting to old Realty salary source would miss those writes; first reconcile those events to the rollback destination. Never simply delete the inbox or salary projection.
