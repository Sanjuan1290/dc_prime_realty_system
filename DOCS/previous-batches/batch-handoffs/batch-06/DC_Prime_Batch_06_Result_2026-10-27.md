# D&C Prime Realty — Batch 6 / Extract HR Backend

**Date:** 27 October 2026  
**Status:** **Staging code package prepared. End-to-end readiness pending.**  
**Source:** `AllCodes(20261027-060053).txt`; Batch 3 architecture; Batch 4 npm workspace; Batch 5 HR SQL schema.  
**Production effects:** None.

## Scope accomplished

- Created `apps/hr-server/` code overlay with HR-only Express entry point, MySQL/TiDB pool limited by an explicit `HR_DB_NAME` whitelist, independent HR JWT cookie and database-backed permission lookup.
- Extracted **9** original HR controller/helper modules, **20** original HR services, **3** legacy HR routers, the attendance kiosk router/middleware and attendance auto-timeout job (**35** inherited source files). Retained existing route names to reduce frontend conversion work in Batch 7.
- Replaced runtime DDL in employee, attendance and payroll helpers with **read-only schema checks** tied to Batch 5 migrations. Redirected `system_settings` access to HR-owned `hr_settings`.
- Redirected SQL historical actor joins from Realty `users` to `hr_users.display_name_snapshot`.
- Introduced an HR-owned audit adapter writing to `hr_audit_logs`. This adapter does not yet duplicate every former audit-report feature.
- Added staging-only seed SQL to initialize HR settings, payroll settings, permissions and roles; **no users or passwords created**.
- Independent HR scheduler extracted, **disabled by default**. The original Realty server remains authoritative and keeps running its existing jobs until cutover.
- **Payroll release intentionally blocked** (requires signed/atomic transfer policy in Batch 8). **Signed salary receipt routes intentionally blocked** (requires protected Cloudinary storage/webhook handling in Batch 9). Other domain writes disabled by default (only explicitly enabled in non-production isolated staging).
- Explicit **production startup refusal**, staging-only flag and a read-only default to prevent accidental cutover.

## Package layout

```text
apps/hr-server/
  server.js
  package.json
  .env.example
  db/connect.js
  middleware/auth.middleware.js
  middleware/attendanceKiosk.middleware.js
  controllers/System/Employees/*.js
  controllers/System/auditLogs.controller.js
  routers/hrAuth.router.js
  routers/System/{employees,attendance,employeePayroll}.routers.js
  routers/attendanceKiosk.router.js
  services/{employee*,payroll*,nightShiftTime*}.js
  jobs/attendanceAutoTimeout.job.js
  config/permissions.js
  migrations/20261027_batch6/01_staging_hr_access_seed.sql
  scripts/check-isolation.mjs
  tests/hrIsolation.test.mjs
```

## Key API paths

| Path | Current staging behavior |
|---|---|
| `GET /api/v1/health` | HR API health (after DB-connected startup) |
| `POST /api/v1/auth/login`, `POST /logout`, `GET /me` | Independent HR identity; requires separately provisioned HR accounts |
| `/api/v1/employees/*` | Extracted controllers; protected by HR permission lookup and staging write guard |
| `/api/v1/attendance/*` | Extracted controllers; settings read from HR database |
| `/api/v1/employee-payroll/*` | Extracted payroll operations; release blocked |
| `/api/v1/attendance-kiosk/*` | Original PIN/session logic; independent cookie name; scans are write-guarded |
| `/api/v1/employee-payroll/payrolls/:id/signed-receipts/*` | Returns 503 (storage not yet separated) |

## Validation performed

| Check | Result |
|---|---|
| `npm run check` — forbidden Realty-table/DDL scanner | **PASS** |
| `npm test` — HR unit/static regression tests | **10 passed / 0 failed** |
| `node --check` on all JavaScript files | **PASS** |
| All relative ES module import targets present | **PASS** |
| Source-only payroll example, ₱15k monthly, 1,830 minutes attendance deduction | **PASS**, net ₱4,860.53 |
| Actual HR database startup and route execution | **NOT RUN** — requires isolated staging TiDB, packages, credentials and HR users |
| Existing full original test suite on extracted system | **NOT RUN** |
| Receipt upload, malware scans, release transfers | **BLOCKED BY DESIGN** |
| Production deployment | **NOT PERFORMED / NOT AUTHORIZED** |

### Caveats and corrections needed before declaring Batch 6 finished

1. Complete outstanding Batch 1 recovery / restored-database test, and Stage Batch 5 migrations. Without this, schema compatibility remains unconfirmed.
2. Use a dedicated nonproduction HR database account. The seed SQL uses `USE dc_prime_hr_db` as in Batch 5. If staging is a schema with the suffix `_staging`, adjust the SQL after review **before running it**. Prefer an isolated database instance with the existing Batch 5 name.
3. Provision independent HR logins and grant HR roles in an approved staging workflow; no Realty password hashes should be copied.
4. Install project dependencies in a complete Git checkout, then rerun app startup, API authorization, employee CRUD, attendance, payroll draft/finalization, and schedule tests with representative data.
5. Staging login rate limiting is in memory; distributed production rate limiting, secure invite/password-reset and session lifecycle must be completed before HR production deployment.
6. Confirm all historical actor name joins, audit record fidelity, department/barcode behavior and protected document history against migrated records.
7. Confirm a single-owner deployment strategy for attendance auto-timeout. Jobs stay off in the extracted API until the old job is stopped during cutover.
8. Batch 8 implements transactional payroll salary events and Realty projections before enabling salary release. Batch 9 handles protected receipts and malware-webhook routing.
9. Batch 7 must update the new HR frontend to use HR login/session and the new isolated API hostname; no shared Realty authentication.

## Apply safely

Read `APPLY_BATCH6.md` in the overlay. Copy `apps/hr-server/` **into** the Batch 4 monorepo; do not replace or delete the original `server/`. Keep `HR_ENABLE_WRITES=false` and `HR_ENABLE_JOBS=false`. Only start against a restored isolated staging DB. Do not apply to production.

## Completion gate

- [x] Extract actual HR source and standalone server scaffolding
- [x] Replace the known Realty SQL/settings/audit access paths in extracted source
- [x] Independent HR permission/auth middleware prepared
- [x] Protect write/release/receipt/scheduler operations during migration
- [x] Offline syntax, isolation and calculation tests
- [ ] Staging DB connection and schema compatibility
- [ ] HR API integration and authorization tests with representative data
- [ ] Full old/new payroll and attendance regression comparison

**Batch 6 is partially complete: the extractable staging code is prepared and offline-tested, but integration and production readiness are not established.**
