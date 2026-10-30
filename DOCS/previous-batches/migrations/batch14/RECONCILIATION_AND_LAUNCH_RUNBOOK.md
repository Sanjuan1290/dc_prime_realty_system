# Batch 14 — Finance Reconciliation & Launch Readiness (staging-only)

## Scope and operating rule

Batch 14 adds **read-only Finance-side reconciliation** of committed Batch 13 import receipts, posted Finance ledger entries and aggregated cash sources, plus an evidence-checking CLI. **It does not launch Finance, authorize imports or reconcile the original Realty database by itself.** Production remains blocked by outstanding Batch 1/5–13 acceptance gates and HR cutover blockers.

## Source and target boundaries

- Source is the independent *Realty Company Finances* Batch 11 export from `dc_prime_realty_system_db`.
- Target is `dc_prime_finance_db`, managed by the Batch 12/13 Finance server.
- The Finance reconciliation endpoint opens a single Finance-db snapshot transaction, runs plain SELECT queries and rolls back before releasing the connection. It never writes a reconciliation approval, never queries Realty or HR, and reports `launch_approved:false`.
- Owner-only endpoint: `GET /api/v1/finance/reconciliation?from=YYYY-MM-DD&to=YYYY-MM-DD` (authenticated Finance admin). Date range is required, at most 367 days inclusive. An oversized result fails closed.
- This endpoint is **not** gated by FINANCE_IMPORTS_ENABLED because it is read-only and useful when imports are disabled.
- All amounts are checked as exact two-decimal strings using bigint centavos in application code. Manual Finance transactions are shown separately from imported Realty transactions. Posting a valid new manual expense is not an import discrepancy.

## Independent source-to-target reconciliation: staging runbook

1. **Hold write changes** in the source test environment or record a controlled cut-off. Confirm Payroll/HR salary snapshot parity, correction cases and refunds have independent sign-off. Do not set source `FINANCE_TRANSFER_RECONCILED_THROUGH_DATE` until this is complete.
2. Produce a fresh Batch 11 transfer ZIP/XLSX from *Realty staging* for an explicit date window, matching source filters. Record the approved generated timestamp, source-period totals (income/expense), salary mode, row count, source ID list, file checksum and operator. Verify origin through approved controlled transport: SHA256 is integrity, **not authenticity**.
3. Load the same transfer into *Finance staging* (after the import enable gate is explicitly approved), map categories, preview and confirm. Capture import batch ID, source export ID and counts. Re-upload to prove 0 new posted rows on retry. Run tests for changed source ID, duplicate, invalid total, malformed ZIP/XLSX, concurrent confirmation and transaction rollback.
4. Run `GET /api/v1/finance/reconciliation?from=...&to=...` as a Finance admin; retain a timestamped, access-controlled copy of the response. All `issues` must be empty and `reconciliation_passed=true`. This checks **Finance internal** consistency only.
5. Compare original source row identities, revisions, exact amounts, dates, types and **selected source totals** with Finance's verified receipts and posting set. Remember a committed import batch may contain duplicates already imported by an earlier batch: *sum unique posted source identities, not import-batch totals*. Record differences in a separate exception register.
6. Independently inspect the Finance dashboard. Balance = PHP 0 + total posted income - total posted expense across all history. A filtered export period's net change is **not** an all-history closing balance. Manual Finance entries may make the Finance balance different from Realty; reconcile those separately.
7. Test scenarios: no source rows; repeated export; partially overlapping date windows; 0.01 peso; salary source legacy vs external transfer; 500-row limit; voided manual cash entry; refunds; cancelled commissions; category remapping; changed transaction snapshot. Block launch on unresolved cases.
8. Re-run checks after the final import freeze window. Review access controls, logs, backups, restore test, HTTPS session cookie behavior, shared rate limit, credential isolation, disaster recovery and all unapproved source changes.

## Corrections and cash reversal limitation

The v1 export is a **snapshot of posted cash movements**, not an authoritative change-feed. Re-import cannot automatically determine that a disappeared item was voided, and cannot treat a changed amount as a new transaction. Batch 13 blocks conflicting revisions and does not permit manual void/correction of imported transactions. Thus **source edit, cancellation, payroll correction and reversal handling remains a launch blocker** until a separately reviewed v2 adjustment contract or tightly documented and approved operating restriction is in place. Do not fix conflicts by deleting imported rows or inventing balancing entries.

## Staging go/no-go evidence

Generate the form: `node apps/finance-server/scripts/batch14-readiness.mjs --template > batch14.evidence.json`

Fill each gate with: `{ "status": "verified", "reference": "location of concrete test evidence", "reviewer": "person/team", "verified_on": "YYYY-MM-DD" }` and paste the actual read-only Finance reconciliation response into `finance_reconciliation`. Then run `node apps/finance-server/scripts/batch14-readiness.mjs batch14.evidence.json`.

The CLI checks the *presence and formatting* of evidence; it does not independently attest that human-reported evidence is true. It returns nonzero for missing gates. A pass means `pass_for_manual_review:true`; it **never** changes feature flags, modifies the database or deploys the service.

## Production and rollback

- Do not set `FINANCE_PRODUCTION_ENABLED=true` or `FINANCE_IMPORTS_ENABLED=true` based on this package alone.
- Have production owner approve the deployment and enable flags via the normal deployment workflow after independent review, full staging test and verified restore.
- Before production writes, normal code/flag rollback is straightforward. After new Finance writes, an older DB restore would lose those writes; reconcile them or perform a controlled forward repair before reverting.
- If any ledger discrepancy appears after launch, disable new imports, preserve all receipts/audit, retain access to the read-only report and investigate. Do not rewrite posted history.

## Acceptance still pending

Full checkout and dependency install; actual TiDB schema migrations 01–04; endpoint authentication in running API; genuine XLSX/ZIP production-like roundtrips; concurrent importer commit testing; correction/reversal scope; HR salary history parity; source finance totals; business-owner signoff; deployment, backup and security rehearsal. Treat Batch 14 as **prepared**, not fully accepted.
