# D&C Prime Realty — EMPTY TiDB testing setup

Prepared 30 October 2026 from the merged development/staging source bundle.
**These are schema-only files, not full data backups, and they have not been applied to live TiDB.**

## Recommended setup

**Use isolated TiDB staging clusters/databases, not a database still serving users.** Even with a saved backup, verify that the backup can restore first. The scripts do not drop anything. All three have CREATE DATABASE statements: run them on a connection where the target names DO NOT exist. Do not create the databases separately first. If you want different names, change each CREATE DATABASE, USE, and app environment setting consistently.

For the simplest import, use **`00_ALL_THREE_EMPTY_SCHEMAS_144_TABLES.sql`**, which contains every schema and the three Batch 8 Realty tables in one file. **Do not** also run the four individual files after using it.

Alternatively, run the individual files in this order using a TiDB/MySQL-compatible SQL client:

1. `01_REALTY_SCHEMA_ONLY_105_TABLES.sql` — original Realty schema; **still contains 17 legacy HR tables**.
2. `02_REALTY_BATCH8_ADD_3_SALARY_TABLES.sql` — extra three Realty salary-transfer tables for the merged Batch 8 source.
3. `03_HR_SCHEMA_ONLY_28_TABLES.sql` — independent HR schema.
4. `04_FINANCE_SCHEMA_ONLY_8_TABLES.sql` — independent Finance schema.
5. Run all three `99_VERIFY_*_EMPTY.sql` checks. Expect Realty **108**, HR **28**, Finance **8**; each `total_rows_across_all_tables = 0`.

Example client command, using **your own host/port/user/TLS settings** and prompting for the password rather than putting it in shell history:

```bash
mysql --host=YOUR_TIDB_HOST --port=4000 --user=YOUR_ADMIN_USERNAME --ssl-mode=VERIFY_IDENTITY --ssl-ca=/path/to/ca.pem -p < 01_REALTY_SCHEMA_ONLY_105_TABLES.sql
```

TiDB Cloud TLS flags vary by environment. Do not skip TLS verification or paste passwords into scripts. Run the remaining imports in numerical order; each SQL file creates/selects its own database.

## What the schemas do **not** provide

- No test accounts or passwords. Realty login, HR login, and Finance login must be provisioned separately. Finance has `apps/finance-server/scripts/create-admin.mjs` in the codebase; it requires `FINANCE_ADMIN_EMAIL`, `FINANCE_ADMIN_PASSWORD` (12+ chars), and a correct Finance database connection. HR currently lacks an equivalent verified first-admin bootstrap workflow. Do not reuse old password hashes.
- No business setup records (projects, buyers, categories, employee payroll settings, role defaults, audit configuration, singleton financial settings). Some app screens may require minimal non-business configuration seeds before they work. Apply only reviewed seeds after verifying the empty schema. The original Realty migrations may have bootstrap setup logic; do not run all historical migrations blindly over a snapshot schema.
- No payroll releases or salary-transfer events. The Batch 8 finance sync singleton was deliberately not inserted; create it through an approved initialization migration before enabling salary transfer.
- No protected Cloudinary files or uploaded documents.
- No production readiness guarantee. The earlier Batch 15 issues and actual staging tests are outstanding.

## Expected tables

| Database | Base tables | Extra tables | Total | Rows expected initially |
| --- | ---: | ---: | ---: | ---: |
| `dc_prime_realty_system_db` | 105 | 3 Batch 8 | 108 | 0 |
| `dc_prime_hr_db` | 28 | 0 | 28 | 0 |
| `dc_prime_finance_db` | 8 | 0 | 8 | 0 |
| **Combined** | 141 | 3 | **144** | **0** |

The Realty database is a transitional schema, not the final HR-free Realty design. Its HR tables should only be retired after migration, cutover, and thorough tests.

## Startup order

1. Verify schema counts and zero rows.
2. Set distinct app credentials and secure session secrets in each deployment (no real `.env` in Git).
3. Verify roles, required default settings and app-specific first-admin bootstrap safely in staging.
4. Run the legacy Realty app with HR migrations/transfers **disabled** until verified; run HR and Finance with staging safeguards.
5. Validate full frontend/backend builds, API login, property transactions, attendance, payroll, Finance imports, and separation rules before enabling any production flag.

**Do not import `DC_Prime_REALTY_TiDB_105_Tables_Oct27.sql` or the HR Oct 27 staging data SQL** if the goal is zero records. Those are populated snapshots.
