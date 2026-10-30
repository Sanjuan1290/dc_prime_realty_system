# D&C Prime Realty — Batch 15 Verification Report

**Date:** October 28, 2026  
**Scope:** Original October 27 source/SQL backup, Batch 2–3 design materials, and staging overlays from Batches 4–14.  
**Decision:** **NO-GO for Batch 16 destructive cleanup or production cutover.**

## Work performed

1. Reconstructed **963 text-source files** from `AllCodes(20261027-060053).txt`. This export does **not** include the real binary website media and is not a clean Git checkout.
2. Verified the CRC of **11 available staging overlay archives** and overlaid their files in batch order, applying **247 package file placements**. **24 paths changed between overlays**; these are expected overwrite events requiring code review, not proof of a conflict. No original repo or production DB was modified.
3. Reran integrated Node test suites, inspected original Realty SQL dependencies and Batch 2 ownership records, ran source isolation and relative-import checks.
4. Updated two outdated offline checkers to support promoted apps and to distinguish approved one-time migration scripts from ongoing HR runtime access.
5. Prepared a table-by-table retention decision matrix, financial regression matrix, 18-item blocker register, and 22-evidence gate template. No DDL drop statements or prod activation logic was generated.

## Actual verification results

| Test | Result | Limit |
|---|---|---|
| HR backend selected suite | **13 passed / 0 failed** | Offline |
| Finance backend selected suite | **59 passed / 0 failed** | Offline |
| Realty Finance + Batch 10/11 selected suites | **68 passed / 0 failed** | Offline |
| HR frontend selected suite | **6 passed / 0 failed** | Offline |
| Full reconstructed Realty backend suite | **1,608 passed / 19 failed** out of 1,627 | Not a clean checkout; failures require recheck |
| Legacy import check | **Passed** | 201 source files per check script |
| New-app relative imports | **0 missing** across 290 reported relative import references | Static analysis only |
| New backend JS syntax | **73/73 parse checks passed** | Does not build or execute server |
| Updated workspace checker | **Passed** | Negative credential-injection test rejected |
| Updated HR runtime isolation | **Passed** across 43 runtime JS files | Negative forbidden SQL injection rejected |
| Batch 15 readiness evidence | **0/22 verified** (expected NO-GO) | CLI is fail-closed |

The **19 full-suite failures** consist of 14 test-file load failures due to unavailable npm modules and five tests requiring missing binary website images/video. These are environment/export limitations until repeated on a full checkout; do not call them passing or confirmed runtime bugs.

**Checker incompatibilities found and fixed in the proposed Batch 15 patch:** the Batch 4 checker required all apps to remain empty placeholders, despite Batches 6–14 promoting HR and Finance to runnable apps; it also required old env variable naming. The HR isolation check scanned one-time Batch 9 historical data migration scripts and flagged intentional read-only Realty source access. The replacement checks restrict ongoing HR runtime code and separately require migration review.

## Critical remaining issues, grounded in code

- `apps/hr-server/server.js` still throws when `NODE_ENV=production`; a production HR cutover is unavailable by design.
- `server/services/companyFinances.service.js` still retains `employee_payrolls` and `employee_cash_advances` queries in legacy mode. Do not retire their underlying tables until the new HR source is reconciled and enabled.
- `server/controllers/System/sellerGroup.controller.js` still references and modifies `employees` during Seller Network import/undo. A route freeze is only temporary; business logic needs replacement.
- The salary transfer v1 format covers release but not a complete versioned correction/reversal protocol; Finance transfer v1 also cannot safely apply changed external source entries automatically.
- HR signed receipts, Cloudinary callbacks, user permissions, audit history and old attendance jobs need end-to-end staging verification.
- The public `apps/website/` remains an empty scaffold, rather than a fully extracted and verified independent website.
- No real source-to-target HR, payroll, Realty finance, or independent Finance reconciliation has run against live staging TiDB instances.
- A current production-aligned checkout, DB grants, clean build, deployments, genuine file import, authentication testing, and restore rehearsal were not provided.

## Database cleanup assessment

- 105 baseline source tables total.
- 17 HR tables are conditional eventual retirement candidates, not current deletion targets.
- 22 mixed/shared Realty structures remain with targeted partition/column review.
- 66 further Realty-owned tables remain.
- **No existing table or column is approved for deletion.**

The source SQL declares foreign keys but effectiveness and referential consistency must be checked on the actual TiDB version/staging instance before any cleanup.

## Release gate and order

**Do not run Batch 16 DDL or remove legacy HR modules yet.** Finish DB restore, integrated builds, the outstanding payroll/Seller Network/receipt/reversal interfaces, source-to-target reconciliation, public site extraction, full regression/security testing, and approved HR/Finance cutovers. Then conduct an observation and retention review and obtain table-specific cleanup approval. Use `EVIDENCE_TEMPLATE.json`, the read-only `scripts/batch15/readiness.mjs`, and `BATCH16_CLEANUP_GATE.md` to collect evidence. An automated evidence pass is not a production cleanup authorization.

## External technical references

- TiDB foreign keys: https://docs.pingcap.com/tidb/stable/foreign-key/
- AWS cutover and rollback: https://docs.aws.amazon.com/prescriptive-guidance/latest/best-practices-migration-cutover/cutover-stage.html
