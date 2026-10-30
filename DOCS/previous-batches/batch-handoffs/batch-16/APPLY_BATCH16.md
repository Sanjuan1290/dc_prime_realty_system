# D&C Prime Realty — Batch 16: NON-DESTRUCTIVE CLEANUP PREPARATION

**Decision: NO-GO for any deletion or production cutover.** This package is a read-only inventory and cleanup approval handoff, not a migration to execute.

## Where to place the files

Merge the contents into the existing monorepo root on a new Git branch:

- `scripts/batch16/` — source reference and cleanup-gate scanners with Node built-in tests
- `docs/migrations/batch16/` — original DB inventory, source evidence snapshot, conditional table decisions, SQL metadata inspection and follow-up plan

Do **not** replace current applications or delete any of `client/`, `server/`, `apps/`, or databases using this package.

## Safe read-only commands

```bash
# At your real monorepo root after extracting the package
node --test scripts/batch16/tests/*.test.mjs
node scripts/batch16/scan-cleanup.mjs . > batch16-reference-scan.json
node scripts/batch16/cleanup-gate.mjs
```

`cleanup-gate.mjs` is expected to report NO_GO and exit with code 2 until a separate human-approved cleanup migration is authorized; it **never** authorizes DDL. `scan-cleanup.mjs` performs a text search and can produce false positives from unused paths; use its results as leads for manual code inspection.

For DBA read-only inspection, review `docs/migrations/batch16/REALTY_METADATA_READONLY.sql`, run only on an isolated production-aligned clone, and compare its metadata to the actual production TiDB version. The listed `TABLE_ROWS` values are estimates; do not use them for data parity.

## Do not remove

- The original 17 HR tables before an approved HR cutover, data and Cloudinary verification, financial parity and retention approval.
- The 22 mixed Realty tables or 66 Realty-owned tables.
- `system_settings` attendance fields before HR settings and all callers reconcile.
- `company_finance_settings.opening_balance` merely because independent Finance starts at ₱0.
- Audit logs, snapshots, receipts, or reference columns solely because a UI no longer displays them.

## Follow-up work before any destructive Batch 16

1. Resolve the 18 open or prepared-not-merged blockers inherited from Batch 15.
2. Complete the 22 evidence gates using real restores, complete checkout, TiDB and integrated deployments.
3. Replace Realty direct HR SQL in Company Finances and Seller Network import/undo; test with original HR tables inaccessible.
4. Complete salary correction/reversal policy, receipt file permissions, isolated auth, and web/public-buyer-form extraction.
5. Obtain a measured post-cutover observation period, retention decisions, and signed **per-table** approval.
6. **In a future separately authorized change only**, author and independently review exact versioned DDL against fresh `information_schema` results; run on staging first, test restoration and rollback, then schedule production execution.

Neither the ZIP nor its metadata SQL contains executable data deletion or DROP/ALTER operations.
