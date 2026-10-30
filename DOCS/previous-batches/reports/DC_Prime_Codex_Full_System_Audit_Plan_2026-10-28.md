# D&C Prime Realty — Codex Full System Audit and Separation Verification Plan

**Version:** 1.0 | **Prepared:** 2026-10-28 | **Type:** Audit execution plan, not migration authorization  
**Default outcome:** NO-GO until actual staging and acceptance evidence clears the blockers.

## 0. Mandate and working rules

Act as a senior software architect, full-stack reviewer, database migration engineer, QA automation engineer, and application security reviewer. Audit the real D&C Prime Realty repository and all available Batch 1–16 artifacts together. Determine whether the three independent systems and public website are correctly implemented, integrated, tested, recoverable, and ready for production. **Do not infer successful deployment or database migration from source-only test results.**

### Hard rules

1. **Audit first.** Do not rewrite, refactor, delete, deploy, activate scheduled jobs, import financial records, or modify production configurations during this task. Do not generate executable destructive SQL as a ready-to-run artifact.
2. Work from a clean, pinned Git revision on a **new audit branch or disposable worktree**. Save the initial commit hash and `git status` output; preserve any pre-existing user changes. Never overwrite local work.
3. Treat the actual checked-out code and actual staging database metadata as evidence. Treat the October 27 code export and previous package reports as **historical baselines**, not proof that any package has been merged.
4. Inspect `AGENTS.md` and other repository instructions first. Respect existing conventions; do not overwrite them. Check manifests, lockfiles, env templates, deployment definitions, migrations, tests, and asset folders.
5. **Never connect writes, migrations, tests, or imports to production.** Use isolated staging databases, staging Cloudinary folders, mock payment endpoints, test accounts and explicitly authorized credentials. Stop and report blockers if those are unavailable. Avoid exposing personal financial or employee data in reports/logs.
6. Do not `DROP`, `TRUNCATE`, mass-update or mutate production tables or their permissions. Do not turn on HR/Finance production flags. Never turn off foreign-key enforcement to hide migration defects.
7. Classify every observation as `CONFIRMED`, `SUSPECTED`, `NOT TESTED`, or `PASSED WITH EVIDENCE`. A missing dependency, source media, staging credential or backend is a blocker, **not** a passing test and not automatically a product bug.
8. Record **file path + line numbers** and reproducible evidence for every finding. For database claims record table, column, constraint, SQL/check used and the environment. Redact all secrets and sensitive values.
9. Run read-only/static verification immediately. Install dependencies only inside a safe checkout and without silently changing locked package versions. If a lockfile is invalid/missing, document it; do not conceal the problem by changing versions.
10. Do not approve cutover, finance import activation, salary-event source switching, or old HR table removal merely because unit tests pass. A human owner must approve each high-impact policy and production change.
11. Preserve existing finance calculations and original SOA, reservation, commission, audit, payroll and buyer history semantics unless an independently approved correction is documented.
12. **First deliver an audit report and remediation plan.** Do not apply proposed business-code fixes as part of this audit; offer separately scoped fix batches with their required tests and rollback.

## 1. Required inputs and source-of-truth hierarchy

Use all materials that actually exist. Inventory them rather than assuming they are present:

- Current, complete Git checkout: source, binary assets, deployment configuration, Git history, complete package manifests and lockfiles.
- `AllCodes(20261027-060053).txt` (October 27 historical source snapshot).
- `dc_prime_realty_full_backup_2026_27(1).sql` (October 27 historical database dump; do not mistake it for current production).
- Batch 1 baseline report; Batch 2 table ownership, foreign-key, code dependency, and test inventories.
- Batch 3 architecture, integration contracts and decision log.
- Every staging package/overlay and implementation guide from Batches 4–16, including Batch 15/16 readiness and cleanup reports.
- Actual authorized staging DB schemas, migrations applied, app build logs, route listings, test logs, deployment hostnames, job ownership, permissions and rollback evidence (if available).

**Precedence:** currently checked-out committed code / actual staging evidence > reviewed migration and architecture decisions > package source overlays > historical text export > earlier narrative summaries. Identify any discrepancies explicitly; never quietly merge assumptions.

Expected project shape, subject to verification:

```text
dc-prime-realty/
  client/                         # existing combined frontend until cutover
  server/                         # existing combined backend until cutover
  apps/
    website/
    realty-client/
    realty-server/
    hr-client/
    hr-server/
    finance-client/
    finance-server/
  packages/shared-ui/
  packages/shared-utils/
  docs/
  package.json
```

Do not assert that `apps/realty-client`, `apps/realty-server` or `apps/website` are fully populated without seeing actual code. Several were scaffolds in prior packages.

### Required inventory output

Create `audit/00_INVENTORY.md`: repository commit, dirty files, exact sources found/missing, file counts, package versions, local runtime versions, enabled apps, executed migrations, environments available and missing assets. Include a table showing whether each Batch 1–16 artifact is `not found`, `present only as ZIP`, `partially applied`, `merged`, `superseded`, or `verified in staging`.

## 2. Audit order and workstreams

Do workstreams in this order. Continue with independent read-only checks when one is blocked. Never convert an untested item into a pass.

### Workstream A — Reconstruct and compare all 16 batches

1. Inspect the current Git tree and every ZIP manifest before extraction. Extract packages to temporary scratch folders, not over the source repository.
2. Compare each overlay with the current code, its prerequisite batch, and the later overlays. Detect missing files, overwritten files, stale file copies, import and path changes, API contract drift and out-of-order migrations.
3. Explicitly review the 24 overlapping overlay paths identified in Batch 15; verify actual semantics of each overwrite rather than counting overwrites as defects.
4. Check npm workspaces, workspace-name uniqueness, root and per-app scripts, module types (ESM/CJS), lockfile integrity, incompatible duplicate packages, Vite proxy origin/port, `VITE_*` variable usage, TypeScript/JavaScript compatibility and CI configuration.
5. Confirm Batch 15 checker repairs are merged: the workspace checker must not reject promoted apps; HR isolation checker must distinguish one-time migration scripts from HR runtime.
6. Check every app can build and start independently under staging environment flags; do not start production jobs by accident.
7. Produce `audit/01_BATCH_MATRIX.md`: for each batch list intended outcome, actual files/migrations, verified status, bugs, missing prerequisites, tests and blockers.

### Workstream B — Complete database ownership and migration audit

1. Parse and compare the historical SQL's 105 original tables with actual staging metadata. Baseline split: 17 conditional HR retirement candidates, 22 shared/mixed Realty structures for review, and 66 Realty tables to retain. **Zero deletion approvals** in Batch 15/16.
2. Compare all 276 source-declared foreign keys with the real server's foreign-key metadata and TiDB version/behavior. Include 16 internal HR foreign keys and 20 HR-to-original-`users` references. Check missing, invalid and orphan relationships, unique indexes, constraints, collations, defaults and precision.
3. Inspect every schema migration in order and actual migration-history records. Detect non-idempotent DDL, broken dependencies, runtime DDL, timezone inconsistencies, wrong target schema and differences between fresh-create and upgrade paths.
4. Check HR's 17 business tables plus 11 proposed support tables and the 10 attendance/department configuration fields copied from `system_settings` into HR settings.
5. Verify historical HR `users.id` mappings, HR account creation/activation, role and permission equivalence, approval actor snapshots, audit history and inactive/deleted user records. Never treat imported Realty password hashes as acceptable HR onboarding by default.
6. Check independent Finance tables, categories, ledger indexes, import tables, source constraints, decimal money columns, transaction/rollback boundaries and zero opening balance.
7. Validate staging restore end-to-end: a consistent source snapshot; record counts per table; exact monetary totals; hashes or deterministic row-level comparisons; FK/orphan checks; receipt metadata; and audit coverage.
8. Check the original database remains intact/readable and new backend DB credentials cannot access each other's databases. Check connection pools, SSL/TLS and minimum privileges.
9. Identify all legacy tables and columns still referenced by runtime code and future migrations. Cross-check Batch 16's 81 identified legacy runtime file/table reference pairs across 48 files; classify actual query execution, comments, tests and historical migrations separately.
10. No schema deletion, `DROP` script, or removal approval in this audit.

Deliver `audit/02_DATABASE_AUDIT.md` and `audit/02_TABLE_DECISIONS.csv` with per-table ownership, inbound/outbound constraints, runtime references, migration state, source/target counts, data risk, retention need and explicit `DELETE_APPROVED=NO` unless separately documented approval already exists.

### Workstream C — Realty functional and financial regression

Verify all affected routes, service calculations and UI transitions for:

- Property project/listing CRUD, buyer accounts, reservation, cancellation, sale history, listing bulk operations and network/seller hierarchy.
- Property payments, SOA schedule generation, installment allocation, LMF, waivers, discounts, penalties, payment reference IDs, archived records and refunds.
- Reservation/downpayment correctness. **Required case:** TCP ₱2,240,000; DP 15% = ₱336,000; reservation ₱50,000 counts toward DP; remaining DP to collect ₱286,000; balance after the *full* DP is paid must be **₱1,904,000**. Validate under partial payment, cancellation, edits and SOA export; the reservation must not reduce DP credit counted toward TCP.
- Broker/manager/agent commissions, historical commission releases, network company-profit releases, stage-based releases and retained amounts.
- Existing Company Finances: property collections, salary expense, commissions, archived commissions, refunds, manual transactions, date-range views, filters, CSV report and warnings.
- Review Center, audit logs, protected corrections, RBAC, reports, export and document access.

Use precise PHP money calculations with decimal or integer-centavo arithmetic, not floating-point totals. Compare before and after results against fixed fixtures and verified source data. Report unexpected change as P0/P1 depending on cash or data impact.

Deliver `audit/03_REALTY_REGRESSION.md` with a matrix of operations, expected/observed results, test links and monetary reconciliation.

### Workstream D — HR / Attendance / Payroll

Test `apps/hr-server/` and `apps/hr-client/` independently of Realty DB and legacy auth. Check:

- Employees; employment history; departments; work schedules; rest days; hire date and partial first payroll-period policy; role-based data access.
- Attendance barcode scans, kiosk, clock in/out, break times, auto-timeout, event attendance, attendance corrections, holidays, rest-day rules, late/missing/extra time and local Asia/Manila date boundaries.
- Payroll calculation formulas and approved rules, salary snapshots, 10-hour scheduled attendance vs 8-hour salary-rate divisor where applicable, schedule/paydays, overtime, holiday pay, allowances, attendance bonus, deductions, cash advances, finalization, audit corrections, receipt generation and release witnesses.
- Payroll status transitions (`draft`, `finalized`, `released`, `cancelled`) and restrictions on editing a released or historical snapshot.
- Payroll release must be blocked unless required transfer, idempotency, controls and staging tests pass. Inspect the earlier production startup guard in `apps/hr-server/server.js` and never disable it simply to make a test green.
- Signed payroll receipts: upload/download permission, protected Cloudinary references, webhooks, malware-scan metadata, file access and retention. Test with staging assets only; a row in the database is **not** proof that the actual file exists.
- Confirm HR-only user tables, audit logs, notification handlers and session cookies. Run isolation scans on **runtime** code, not on legitimate migration tooling.

Deliver `audit/04_HR_PAYROLL.md` and scenario-by-scenario reconciliation results.

### Workstream E — Cross-system boundaries and transfer correctness

**HR → Realty salary:**

- Follow the entire chain: payroll finalization → verified release → same-transaction outbox write → worker retry → authenticated receiver → inbox deduplication → Realty salary cash projection → Company Finances totals and backfill.
- Check transactional guarantees and failure windows: before commit, after HR commit, request timeout, receiver commit with lost response, duplicate delivery, out-of-order events, changed payload with same ID, crashes, reconciliation checkpoint errors and reprocessing.
- Require immutable source ID and event ID, version/fingerprint, financial amount/date, validation, replay safety, audit history and no double count.
- Verify old salary rows and old finance history are reconciled **before** switching `FINANCE_SALARY_SOURCE` away from `legacy`. The new pipeline must support approved cash corrections/reversals; version 1 does not fully cover them.
- Cash advance effects must follow an approved cash-flow policy; never infer expense from an advance request, and do not hide unresolved advance warnings.

**Realty ↔ HR Seller Network:**

- Inspect legacy employee modifications in `server/controllers/System/sellerGroup.controller.js` including seller import, undo, `network_member_import_items.linked_employee_ids_json`, account deactivation, missing employees and race/failure handling.
- Prove Realty can perform approved seller operations without direct `employees` queries or cross-service DB writes. Protect historical links and do not allow unsafe deletion of an HR-linked Realty account.

**Schedulers, files and webhooks:**

- Exactly one attendance auto-timeout scheduler in HR after cutover; exactly one property penalty scheduler in Realty. No job duplication, skipped runs, shared-user session leaks or Cloudinary callback ownership ambiguity.

Deliver `audit/05_CROSS_SYSTEM_CONTRACTS.md` with a sequence diagram or textual transaction trace, fault-injection matrix and unresolved business decisions.

### Workstream F — Independent Finance, exports, imports and reconciliation

- Verify independent Finance login, roles (admin/accountant/viewer as actually implemented), categories, manual ledger, ₱0 opening balance, void/replacement correction workflow, immutable audit, history and dashboard arithmetic.
- Inspect Batch 11 old seven-column CSV compatibility and new filtered CSV/Excel reports; test date ranges, pagination (>100 entries), page-independent exports, 0/1/many rows, 50,000-row boundary, timezone, category/source filters and export permission.
- Test genuine ExcelJS and JSZip output, not mocked writers: open XLSX, extract ZIP, verify `transactions.csv`, `manifest.json`, header/schema version, checksum, count and exact centavo totals.
- Test formula injection defenses for CSV/XLSX; escaping/round-trip preservation; malicious filenames, duplicate ZIP paths, oversized/corrupt ZIP/XLSX, invalid UTF-8, XML/external links/macros and parser resource limits.
- Trace Batch 13 upload → scan/parse → preview → mapping → authorization → fresh recheck → atomic commit → receipt → audit. Prevent double imports across overlapping files and races. Check rollback if partial commit fails and replay after a lost HTTP response.
- Test existing source ID with changed revision: quarantine; do not silently overwrite or duplicate. Absence from a subsequent file is **not** a void, refund or reversal. Demand a deliberate correction/reversal policy.
- Reconcile Finance ledger and import receipts independently against **fresh approved Realty source totals**, while keeping manual Finance entries separately labelled. Check HR salary amounts are not imported twice via separate feeds.
- Imports and transfer exports stay disabled by default until approved staging parity and cutoff evidence exist.

Deliver `audit/06_FINANCE_IMPORT_EXPORT.md` with file round-trip results, duplicate/revision scenarios and per-period cash totals.

### Workstream G — API, authentication, authorization and security

Verify for Realty, HR and Finance **separately**:

- Correct cookie host/path, `HttpOnly`, `Secure`, `SameSite`, session logout/revocation, JWT verification, password reset/onboarding, account status, role changes and default-deny authorization.
- No cross-app login or privilege escalation: Realty session cannot call HR/Finance protected endpoints; employee/agent cannot view higher-role sales/commissions/payroll; viewer cannot create/void/import; actor identity stays correct.
- No SQL injection (parameterized queries), cross-site scripting, request forgery, server-side request abuse, path traversal, unsafe upload/download, verbose error leaks, formula injection, insecure redirects, missing body-size limits or leaked credentials.
- Internal transfer API: authenticated service identity, secret rotation procedure, TLS transport, least privilege, replay/idempotency controls, request size and schema validation; distinguish app user auth from service auth.
- Migrations, staging scripts, sample config and logs must contain no real keys, connection strings, personal information or sensitive payload dumps.
- Check CORS, allowed origins, rate limits, HTTP security headers, public health endpoints and protected audit/export routes.
- Dependency vulnerability and license findings: distinguish exploitable paths from informational scanner alerts; never auto-upgrade without review.

Deliver `audit/07_SECURITY.md` with reproducible, redacted findings, abuse case, affected role, evidence and priority.

### Workstream H — Frontend, backend, website and deployability

- All seven declared `apps/` folders: classify as complete, scaffold, missing, or not built. Do not treat a placeholder package as an implemented application.
- All React routes, navigation links, disabled features, loading/error/empty states, protected routes, form validation, auth redirect, API base URL, Vite aliases, React imports, styles, binary assets, responsiveness and browser console/network errors.
- New HR frontend vs Batch 6 backend path/response/permission contract; no silent 404/403. Review dev proxy port 5102 only if the actual code confirms it.
- Separate public website content and images/video, publicly accessible pages, contact and buyer forms, API routing, SEO basics and no internal authorization leakage.
- Deployment runtime manifests, environment variables, hostnames, health checks, container/Node versions, DB SSL, CORS and worker start conditions. No concurrent duplicate scheduler in a second deployment.
- Independent failure test: HR server down should not expose HR records through Realty; Finance import failure must not block property collections or payroll; Realty outage behavior should be bounded/documented.

Deliver `audit/08_APPLICATIONS_AND_DEPLOYMENT.md` with build results, route inventory, missing assets and deployment blockers.

### Workstream I — Run automated and live staging tests

1. Record commands and runtime versions. Use `npm ci` in packages with valid locks; report lockfile breakage instead of silently resolving it. For workspaces assess proper install strategy from actual manifests.
2. Run all existing backend tests, frontend tests, new Batch 4–16 tests, build/lint/type checks where defined; list suites that are not configured. Run targeted migration and finance regressions in addition to full suites.
3. Recheck October 28 Batch 15 baseline: 140 selected backend tests passed (13 HR, 59 Finance, 68 Realty finance/cutover), 6 HR frontend tests passed, and legacy comprehensive run showed 1,608 passing / 19 failing in the reconstructed export. Those numbers are *previous report snapshots*, not expected counts for the current commit. Investigate the 14 module-load and five missing media test failures on a full checkout.
4. For each failure, classify: `PRODUCT_DEFECT`, `TEST_DEFECT`, `ENVIRONMENT/DEPENDENCY`, `MISSING_ASSET`, `FLAKY`, or `NOT_REPRODUCED`; attach exact log/command/environment details. Do not skip failing tests to get green output.
5. In isolated staging, test real database migrations, HR and Realty API interactions, authentication boundaries, imports/exports with genuine files, transaction commits/rollbacks, network fault injection, scheduling and Cloudinary protected documents.
6. Perform property-based/edge-case tests for monetary precision, leap years/month-end, holiday/rest-day calculations, duplicate financial events and correction history; baseline existing legal/business rules rather than inventing new ones.
7. Verify staging backup/restore and data parity. A generated SQL file is not a tested restore.
8. Run smoke checks after enabling any approved staging-only flags, then disable them again. Production flags remain unchanged.

Deliver `audit/09_TEST_RESULTS.md` with actual commands, counts, failures, coverage limits and evidence locations; store redacted logs under `audit/evidence/` only if permission allows.

### Workstream J — Migration, rollback, go/no-go and cleanup restrictions

- Explicitly check outstanding Batch 1 restore gate, Batch 5–10 live HR gate, Batch 11–14 Finance live gate, Batch 15 18-blocker register and 22-evidence matrix, and Batch 16 read-only cleanup gate.
- Obtain authoritative source commit, source DB backup and tested restore, staging parity reports, approved business rules, HR and Finance ownership sign-off, isolated credentials, Cloudinary verification, rollback rehearsals and monitoring ownership.
- Distinguish pre-cutover rollback (leave old owner authoritative) from post-cutover rollback (reconcile new writes/events before switching back). Require documented write freeze, final delta sync, traffic changes, monitoring, escalation and abort conditions.
- Prove old Realty code and all operational jobs no longer depend on the 17 HR tables **before** considering their retirement. Preserve audit, receipt and financial evidence for an approved retention period.
- Make a per-table **NO-GO/conditional/ready-for-human-review** decision; no generic `DROP all 17` recommendation.
- Production go/no-go must be **NO-GO** if any P0/P1 data-integrity or authorization defect remains, if required full builds/tests are red, if staging DB restore/parity is absent, if HR/Finance production guards remain unresolved, if business correction rules are undefined, if any outgoing/incoming migration dependency is unverified, or if sign-off/rollback is missing.

Deliver `audit/10_RELEASE_GATE.md`: checklist with exact evidence and decision (default NO-GO), plus `audit/11_REMEDIATION_ROADMAP.md` with minimal ordered fixes.

## 3. Known high-risk leads Codex MUST verify

These are previously reported leads, not claims that they still exist in the current checkout:

| ID | Lead to confirm | Expected evidence / failure mode |
|---|---|---|
| K01 | HR server has a production-mode startup guard | Check `apps/hr-server/server.js`; documented transition needed, not arbitrary bypass |
| K02 | Realty Company Finances still contains legacy HR table queries | `server/services/companyFinances.service.js`; validate external mode and parity |
| K03 | Seller Network import/undo still writes `employees` | `server/controllers/System/sellerGroup.controller.js`; verify eventual replacement |
| K04 | Salary transfer v1 lacks complete correction/reversal semantics | Inspect event schema, outbox, inbox, historical backfill and finance effects |
| K05 | Cash advance cash-flow semantics unresolved | Review business policy, current HR/Finance code and warning behavior |
| K06 | Protected payroll receipts and Cloudinary webhook ownership incomplete | Real staging file fetch/auth and callback trace |
| K07 | Public `apps/website/` may be only a scaffold | Actual route/assets/forms checks |
| K08 | Batch 11 `exceljs`/`jszip` may lack matching lockfile/runtime validation | Full install, actual XLSX/ZIP round-trip |
| K09 | Batch 15 checker patches may not be merged | Check workspace and HR isolation tooling |
| K10 | Batch 16 found legacy HR references in Realty code | Re-run scanner on live repo, classify actual runtime calls |
| K11 | Old scheduler, HR routes or webhook may still be active | Route/job inventory and staging traces |
| K12 | Original `system_settings` holds 10 HR fields | Compare to `hr_settings`, and track cutover consumers |
| K13 | Source and target database parity not yet independently proven | Compare actual records, history and money in staging |
| K14 | SOA DP/reservation example may regress | Use fixed ₱2,240,000 / ₱336,000 / ₱50,000 invariant |
| K15 | Source SQL's TiDB foreign keys might not match running DB behavior | Versioned `information_schema` and FK enforcement checks |
| K16 | Current Git checkout may not contain full ZIP overlays/actual files | Inventory exact merge state; do not assume adoption |

## 4. Required testing scenarios (minimum)

| Scenario | Acceptance result |
|---|---|
| Replay same HR salary event 5+ times | Exactly one cash effect |
| Same source ID with conflicting payload | Reject/quarantine; do not overwrite cash |
| Receiver commits but HTTP response lost | Safe retry, no double count |
| HR payroll release with outbox failure | No released state without agreed durable event, or documented compensating recovery |
| Historical salary backfill overlap | No duplicated released salary expense |
| Correction/reversal after imported salary | Traceable adjustment; not silently rewritten |
| Missing receipt file but metadata exists | Failed verification, not pass |
| Seller import/undo with linked HR employee | No unsafe HR data deletion or Realty direct DB access |
| Attendance auto-timeout + rest-day/holiday event | Correct treatment; one active scheduler |
| Late hire within payroll period | Correct proration only when policy approved |
| DP reservation allocation | Correct TCP, DP, balance and receipts |
| Archived + active commission release overlap | No double count |
| Reimport same CSV/Excel file | Zero added duplicates |
| Changed row in a new export | Held for review; no automatic replacement |
| Missing row from later export | No automatic void/refund |
| Import confirm interrupted after commit | Repeat yields one committed transaction |
| Finance negative/invalid monetary input | Validated rejection |
| CSV/XLSX formula or external-link payload | Harmless literal or rejected by policy |
| Viewer/agent attempts protected actions | HTTP 403/401 as appropriate, no data leak |
| Realty cookie reused against HR/Finance | Denied |
| HR or Finance down during Realty activity | Realty core sales/payments remain unaffected where architecture requires |
| Full source DB staging restore | Exact count/amount parity or documented differences |
| Old Realty HR table unavailable after cutover in staging | No active Realty endpoint/job crashes |

## 5. Findings severity and reporting format

Use severity levels, independent of the batch number:

- **P0 — Critical / production stop:** lost/corrupted cash or employee data, unauthorized confidential access, irreversible destructive action, active duplicate money movements, unsafe migration/cutover.
- **P1 — High / release stop:** broken required business workflow, wrong SOA/payroll/commission totals, cross-database coupling that fails at cutover, incorrect permissions, missing data/receipt parity, rollback impossible.
- **P2 — Medium:** maintainability/contract/test defect, non-critical broken screen, incomplete logging, recoverable tooling failure.
- **P3 — Low:** cosmetic, documentation, naming or non-risky cleanup.

For **every** finding provide:

```text
Finding ID: AUD-001
Severity: P0 | P1 | P2 | P3
Status: CONFIRMED | SUSPECTED | NOT TESTED
Area / batch: ...
Affected files: exact/path.js:lineStart-lineEnd
Affected DB object/endpoint: ...
What is wrong: ...
User/business impact: ...
Steps to reproduce: ...
Expected vs actual: ...
Evidence: command, test, redacted log, query results
Root cause (when established): ...
Recommended minimal fix: ...
Regression tests required: ...
Rollback/migration concern: ...
Prerequisites / unresolved decisions: ...
```

Do not report guessed vulnerabilities as confirmed; reproduce or explain the missing evidence. Deduplicate findings by underlying cause while preserving all affected paths.

## 6. Final deliverable files

Create the following **audit-only** files in a new `audit/` folder on the audit branch/worktree (or provide them in the session if writing is not authorized). Do not edit application source in this audit:

```text
audit/
  00_INVENTORY.md
  01_BATCH_MATRIX.md
  02_DATABASE_AUDIT.md
  02_TABLE_DECISIONS.csv
  03_REALTY_REGRESSION.md
  04_HR_PAYROLL.md
  05_CROSS_SYSTEM_CONTRACTS.md
  06_FINANCE_IMPORT_EXPORT.md
  07_SECURITY.md
  08_APPLICATIONS_AND_DEPLOYMENT.md
  09_TEST_RESULTS.md
  10_RELEASE_GATE.md
  11_REMEDIATION_ROADMAP.md
  12_EXECUTIVE_SUMMARY.md
  evidence/  # redacted, sanitized logs only, if safe
```

`12_EXECUTIVE_SUMMARY.md` must open with:

1. **Decision:** GO / CONDITIONAL NO-GO / NO-GO (default NO-GO when evidence incomplete).
2. Evidence coverage: % of required tests/builds/staging/restore checks actually executed, with numerator/denominator; do not imply whole-code coverage from selected tests.
3. Count of confirmed P0/P1/P2/P3 defects and count of unverified risks.
4. Top 10 release blockers with exact references and owner/action.
5. What is implemented, what exists only as a package, what is missing, and what is deployed (if independently verified).
6. Shortest safe **ordered remediation plan** with dependencies, acceptance test and estimated complexity (`S/M/L`, not invented duration).
7. Explicit list of tests not executed and reasons; unresolved policy decisions; artifacts required from the owner.
8. `Production cleanup permitted: NO` unless a separate owner/DBA-approved release change provides evidence.

## 7. Execution procedure for Codex

### Session 1 — Read-only inventory

- Confirm repo root and current Git commit; inspect `AGENTS.md` without replacing it.
- Locate ZIP packages, backup, and staging source; read Batch 15 and 16 NO-GO reports.
- Print the batch matrix and blocker list before proceeding.
- **Do not claim test completion in this session unless the commands actually ran.**

### Session 2 — Static and code review

- Audit app files, imports, lockfiles, schema, migration ordering, routes, auth and service boundaries.
- Gather precise references; run safe source scanners and syntax checks.
- Write interim reports with verified vs unknown states.

### Session 3 — Clean builds and unit tests

- Use complete Git checkout, proper lockfiles and safe deps. Execute full suites, selected regressions, builds and security checks.
- Investigate every failure; do not skip failed suites.

### Session 4 — Isolated staging integration (only when staging access is available)

- Verify target DB identifiers and read/write grants before any operation; keep production off-limits.
- Restore test backups, apply approved staging migrations, inspect parity, test APIs, jobs, permissions, receipt access and genuine Excel/ZIP transfers.
- Store sanitized evidence and rerun regressions.

### Session 5 — Final report and fix ordering

- Deliver the full report with P0/P1 first, safe fix batches and unresolved decisions.
- Stop. Ask for authorization before making business-code fixes or attempting cutover.

## 8. Kickoff instruction to send to Codex

> Read `DC_Prime_Codex_Full_System_Audit_Plan_2026-10-28.md` in full, then carry out its read-only audit against this repository and all provided Batch 1–16 artifacts. Start with repository inventory and batch-merge status. Work through the audit workstreams in order, run safe tests where possible, cite exact code/database evidence, and create the requested audit reports. Treat incomplete staging evidence as NO-GO. Do not modify business code, delete data, deploy, or enable production flags. End with a prioritized remediation roadmap, not unapproved fixes.

## 9. Relevant external verification references

- OpenAI Codex project guidance and `AGENTS.md`: https://learn.chatgpt.com/docs/agent-configuration/agents-md
- OpenAI Codex CLI and review: https://learn.chatgpt.com/docs/cli
- OpenAI Codex staged development workflow: https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex
- TiDB foreign keys: https://docs.pingcap.com/tidb/stable/foreign-key/
- OWASP Application Security Verification Standard: https://owasp.org/www-project-application-security-verification-standard/

**This document authorizes only review, safe local tests, report creation and explicitly approved isolated staging verification. It does not authorize production cutover or deletion.**
