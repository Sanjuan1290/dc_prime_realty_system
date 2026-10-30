# D&C Prime Realty — Batch 5: Independent HR Database

**27 October 2026 | Staging-only migration package | Not executed against production**

## What is actually delivered

- `01_create_database.sql`: creates `dc_prime_hr_db` (fails if database already exists; no source modifications).
- `02_hr_identity_and_access.sql`: HR actors, separate login identities (no copied passwords), original-ID mapping, roles and permissions.
- `03_hr_business_schema.sql`: **all 17 original HR-related CREATE TABLE definitions**, preserving the October 27 column types, defaults, keys, unique indexes and existing HR→HR foreign keys; **20** original `REFERENCES users(id)` retargeted to `hr_users(id)`.
- `04_hr_support_schema.sql`: ten attendance/department settings in `hr_settings`, HR audit table, salary-event outbox, and optional verified Realty/employee external link table.
- `05_source_readonly_preflight.sql`: source counts, distinct referenced users, source HR settings (run using read-only credentials; results contain confidential HR details and stay private).
- `06_target_readonly_verification.sql`: target schema, foreign keys, count checks, and warnings for TiDB ineffective foreign keys.
- `scripts/batch5/check_batch5.py`: offline static verifier; no MySQL client or Python packages required.
- `table_schema_inventory.csv`: 17-table inventory.

**Total target tables: 28 (17 copied schema definitions + 11 HR-specific support tables).** No business rows are copied yet. Batch 9 owns historical data migration and reconciliation. No HR API or login is activated yet.

## Install paths (after Batch 4 scaffold is merged)

Copy this overlay to the repository root; it adds files under:

```text
apps/hr-server/migrations/20261027_batch5/
apps/hr-server/scripts/batch5/
docs/migrations/batch05/
```

No existing `client/`, `server/`, or database file should be overwritten.

## Dry verification locally

```bash
python apps/hr-server/scripts/batch5/check_batch5.py
python apps/hr-server/scripts/batch5/check_batch5.py 'dc_prime_realty_full_backup_2026_27(1).sql'
```

The second command optionally checks the audited dump checksum; use its **exact October 27 file**. Do not place personal salary data or production secrets into Git.

## Staging application order (requires separate isolated DBA authorization)

1. Resolve Batch 1 restored-backup and clean-checkout gates before any production change.
2. Use a staging DB **without** an existing `dc_prime_hr_db`. Verify the connected server/version; don't run the migration on the Realty production instance.
3. Review `01_create_database.sql`, then execute it **once** using a staging DBA account. Do not set `foreign_key_checks=0` or bypass referenced tables.
4. Execute `02_hr_identity_and_access.sql`, `03_hr_business_schema.sql`, `04_hr_support_schema.sql` **in this order** using an HR-only staging schema-authoring account.
5. Use a **read-only Realty account** for `05_source_readonly_preflight.sql`; source can be a restored isolated backup. Do not expose this account to the HR backend.
6. Run `06_target_readonly_verification.sql` in HR staging; inspect FKs with `SHOW CREATE TABLE` and check no `/* FOREIGN KEY INVALID */` markers. If engine/version cannot enforce intended constraints, block cutover until a validated alternate integrity guard exists.
7. Record source/target table inventories and empty-table counts; don't create HR logins, seed actors or run application background jobs in Batch 5.

**No cross-database SQL, join, FK, shared credentials, or runtime access is required.** You may administer two schemas independently during *offline* migration, but HR application connections must only access HR DB.

## High-priority design guard: user-ID and login migration

Existing source HR columns use Realty `users.id` (20 FK links + **4 additional unindexed/non-FK actor columns**). To retain identical payroll/history values without changing 17 business tables during Batch 5:

- In **Batch 9**, seed historical HR user rows with *explicit numeric IDs* from the source `users.id` for **all distinct IDs referenced by HR** (including non-FK columns). Seed `hr_legacy_user_map` at the same time, preserving names/roles for audit tracing.
- **Do not create HR user accounts or issue any HR user IDs before the historical ID seed.** This is necessary to avoid collisions. Batch 6 may implement authentication behavior, but actual accounts stay disabled pending Batch 9.
- After importing explicit IDs, verify max IDs and adjust TiDB `AUTO_INCREMENT` allocation appropriately on the **HR target only**, using DBA-reviewed, version-specific instructions. Numeric IDs may resemble Realty's but carry **no implicit identity or access rights across systems**.
- `hr_login_identities` starts empty. Never import source Realty password hashes or JWT secrets. New HR access requires invitations/reset, verified normalized emails, distinct credentials/sessions, and assigned HR roles.
- Source HR `_by_user_id` columns **without FK** include `employee_payrolls.finalized_by_user_id`, `employee_payrolls.released_by_user_id`, and signed-receipt `uploaded_by_user_id`, `archived_by_user_id`. Validate these explicitly during Batch 9, even though schema doesn't enforce them.
- The external seller/employee mapping is **optional and disabled until business decision approval**. Its `realty_user_id` is a reference value, never an FK to Realty DB.

## Settings and other data

- The ten `hr_settings` columns copy the source settings' **actual DDL, types and defaults**, but the **source values are not preseeded** here. Batch 9 must copy *actual effective values* and source row id before HR goes live. Empty `hr_settings` is deliberate until then.
- The 17 HR tables retain existing snapshot, payroll, file IDs, malware status and notes columns. Protected Cloudinary files themselves are *not* migrated by SQL schema creation. Asset access and webhook routing are Batches 6/9/10 work.
- `hr_outbox_events` is only the storage for Batch 8 salary release transfer. Batch 5 sends no salary events.
- Existing employee_cash_advance tables are created even when their backup contains no INSERT rows; do not retire them before business review.
- Run Payroll, Attendance, Seller Network and Finance integration tests after code extraction; this schema check cannot prove runtime behavior.

## Rollback

Batch 5 makes **additive changes only in an isolated new database** and does not change the source Realty DB or API. A failed attempt requires halting, saving error details, and restoring the target staging database from a verified baseline or reprovisioning an **isolated** staging environment with DBA approval. **No DROP scripts are shipped.** Once data moves in Batch 9, rollback requires a separate reconciliation plan; don't delete copied financial records to hide differences.

## Deployment gate

**Static package: ready.** Live staging execution, DB restore, FK enforcement check, source-data and user-ID reconciliation, independent HR credentials, and Batch 1 recovery gate are **not completed** from the provided text/SQL exports. Batch 6 extracts HR backend only after these prerequisites and architecture decisions are reviewed.
