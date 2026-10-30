# D&C Prime Realty — Batch 9 Staging HR Data Migration

**Source:** October 27 2026 `dc_prime_realty_system_db` backup (restore to isolated staging first).  
**Destination:** Empty `dc_prime_hr_db` created by Batch 5 on staging.  
**Scope:** DATA migration and reconciliation only. Existing Realty tables remain unchanged.  
**Safety:** Source account must have `SELECT` privilege only. The target should be a newly created staging database. No production credentials. No password hashes or Realty login sessions are migrated.

## Prerequisites

1. Complete the outstanding Batch 1 restore/backup test, and verify Batches 5–8 together on the same real staging checkout. Do **not** apply these scripts straight to the live Realty server.
2. Restore the October 27 backup to an **isolated** Realty staging instance. Do not expose a copied production database on the internet.
3. Run Batch 5 DDL against an empty HR staging DB with foreign-key checks enabled; confirm all 28 tables exist and match the schema. Verify TiDB version and actual FK enforcement.
4. Use two **separate** database credentials: source must be SELECT-only, target write access must be limited to `dc_prime_hr_db`. Configure TLS certificates or a trusted CA. Do not send credentials in chat or commit `.env` files.
5. Apply earlier Batch 8 Realty inbox schema if you want to test salary event transfer after migration. Keep the ingestion and delivery toggles disabled during migration.

## What migrates

- All 17 HR business tables, with original PKs and business financial values preserved; import order follows declared foreign keys.
- Only the historical identities referenced by HR or HR audit records, preserving the original numeric actor IDs. No Realty password hashes, tokens or active HR logins.
- Ten effective HR configuration fields from the source `system_settings` row into HR `hr_settings`.
- Employee-to-Realty-user links as `pending`, not automatically `verified`.
- HR-scoped audit entries from live and archived Realty audit rows, without deleting the source. Audit records tagged under other modules need manual review.
- Payroll receipt **database metadata** (Cloudinary asset references and malware scan status), **not** the actual uploaded files.

## Run offline checks first

From a full repository with Batch 4–8 overlays applied, install your dependencies and run:

```bash
node --test apps/hr-server/scripts/batch9/tests.test.mjs
node --check apps/hr-server/scripts/batch9/migrate-staging.mjs
node --check apps/hr-server/scripts/batch9/prepare-salary-backfill.mjs
```

## Check + staging copy

Set the environment variables in `apps/hr-server/scripts/batch9/.env.batch9.example` using a **secure local secret manager**. Do not execute `.env.example` as a script with secrets checked into Git.

From the full repo:

```bash
node apps/hr-server/scripts/batch9/migrate-staging.mjs --check
# Review the output: source row counts, checksums, salary anomalies, settings and audit counts.
# Only after operator sign-off and setting BATCH9_ALLOW_STAGING_COPY=YES:
node apps/hr-server/scripts/batch9/migrate-staging.mjs --copy
```

The script copies bounded batches with FK checks on, with a consistent source snapshot, and compares source/target SHA-256 row digests. Each target table commits separately because this is a staging migration, **not** a single atomic cross-database transaction. An interruption leaves partially copied staging records. To retry: recreate ONLY the HR staging database, rerun Batch 5 schema, and restart. Never delete/reimport production HR data this way.

**Do not enable HR writes or payroll release** while this staging copy runs. Do not switch `FINANCE_SALARY_SOURCE` away from `legacy`.

## Salary history backfill after data reconciliation

A separate tool prepares events *only* in the HR staging outbox. It never contacts Realty and never turns on automatic delivery. It requires you to confirm that historical payroll `released_at` values represent Asia/Manila wall-clock times; if not, adjust the conversion contract before use.

```bash
# BATCH9_MANILA_TIMESTAMP_CONFIRMED=YES after checking source semantics:
node apps/hr-server/scripts/batch9/prepare-salary-backfill.mjs --preview
# Only after reviewing counts, dates, corrections, cash advances, and setting
# BATCH9_APPROVE_HISTORY_OUTBOX=YES with delivery disabled:
node apps/hr-server/scripts/batch9/prepare-salary-backfill.mjs --seed
```

- Events are deterministic by payroll ID, version 1, and use the Batch 8 transfer schema.
- Released payroll rows missing cash date/time, invalid amounts, any existing payroll corrections or active/paid advances block automatic seeding.
- Zero-cash releases create no outgoing cash expense.
- Seeded events stay in `pending` state, **without delivery** until a dedicated controlled staged test and authorization.
- Once staged delivery is approved, independently compare source payroll IDs, dates, and cent totals to HR outbox and Realty received salary entries. Enable external finance source **only after documented parity**.
- Existing contract v1 does **not** cover release reversals or corrections. Keep these actions disabled after cutover until a new approved contract handles them.

## Remaining blockers before production

- Restore test and actual full-repository test/build acceptance from earlier batches.
- Confirm stored receipt asset existence, protected access, scan outcomes and webhook ownership in Cloudinary; metadata parity alone is insufficient.
- Manual audit review for HR activity logged under generic modules; preserve original audit archive retention.
- Seller Network↔HR employee-link integration and role verification.
- Final source freeze and final sync in Batch 10; a historical October 27 backup cannot represent later payroll/attendance changes.
- Data validation on TiDB staging, actual cross-API salary delivery, finance account recheck and signed production cutover approval.

This overlay **does not** change production data, perform live backfill, upload files, or grant new HR logins.
