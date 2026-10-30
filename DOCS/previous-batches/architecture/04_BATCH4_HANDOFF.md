# D&C Prime Realty — Batch 4 Handoff (Preparation Only)

**From:** Batch 3 — Architecture and contracts  
**To:** Batch 4 — Isolated workspace and staging environments  
**Status:** Not executed. Batch 1 restore/clean-checkout and Batch 2 live checks remain open.

## Batch 4 work sequence

1. Record the exact Git commit and compare it to the October 27 text export. Back up complete original repo and confirm `.gitignore` excludes secrets and temporary artifacts.
2. Restore SQL to isolated staging TiDB/MySQL, validate row counts, FKs and operational totals; confirm full media and Cloudinary metadata access without changing production.
3. Run `npm ci` (or matching lockfile installer), existing server tests, client prebuild and build in a clean checkout. Record failures without weakening tests.
4. Introduce root `package.json` workspace config and `apps/` directory without moving current active code yet. Start with a minimal workspace scaffold and isolated environment templates.
5. Plan separate staging hostnames/API URLs and strict CORS/cookie origin rules. Use a different set of secrets and DB accounts for each backend. Confirm host-provider runtime constraints and environment injection.
6. Move code by verified dependency group in later batches: website/public Realty pages, Realty business APIs, HR business APIs, then Finance. For every move, rewrite imports, route constants, test paths and deployment scripts. Do not blindly copy broad `server/` or `client/` trees into all apps.
7. Add per-app health endpoints/readiness checks, lint/test/build scripts and smoke tests for public buyer forms, payment/SOA, Seller Network, attendance kiosk and payroll.
8. Prepare explicit rollback to the unchanged legacy deployment while the original DB is still authoritative. Do not allow two active attendance schedulers.

## Required technical acceptance checks

- [ ] Original app still builds/runs and all existing routes remain functional after workspace initialization.
- [ ] Each staging API uses only its intended DB credential, restricted role and verified schema.
- [ ] Browser logins, protected cookie domains, CORS and CSRF rules are tested between origins.
- [ ] No new app imports another app's `db/connect.js`, auth middleware or business controller.
- [ ] No duplicate scheduled job; no unintended cross-database access grants.
- [ ] Source code, migrations, new contract tests and deploy files are version-controlled; secrets excluded.
- [ ] Batch 1 recovery gates, baseline tests, and restored-DB cross-check completed before any production cutover.

## Batch 4 expected files

```text
/package.json                  # root workspace scripts
/apps/website/package.json
/apps/realty-client/package.json
/apps/realty-server/package.json
/apps/hr-client/package.json
/apps/hr-server/package.json
/apps/finance-client/package.json
/apps/finance-server/package.json
/docs/architecture/...         # these Batch 3 documents
```

At first, placeholders are acceptable for HR/Finance apps. **They must not be represented as feature-complete applications.** Existing `client/` and `server/` may remain active until migration tests pass.

## Dependencies from Batch 2 that Batch 4 must retain in the plan

- Seller import/undo `employees` coupling, including `network_member_import_items.linked_employee_ids_json`.
- Realty finance salary release and cash advance reads.
- 10 HR-specific fields in shared `system_settings`.
- 20 HR-to-users FKs and historical actor mappings.
- Shared Cloudinary signed payroll receipt scan callback.
- Buyer form public API, attendance kiosk and two scheduled jobs.

## Batch 4 no-go conditions

- A database restore has not worked at least once.
- The real Git checkout and source export do not reconcile.
- Any production secret is being reused in public frontends or copied into a shared package.
- A new backend can query an unintended database.
- Critical payment/SOA/payroll baseline tests are failing without documented accepted remediation.
- A public buyer form or attendance kiosk loses its route during movement.

