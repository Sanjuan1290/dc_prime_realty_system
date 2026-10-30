# Batch 13 — Independent Finance Import v1.0

## Accepted exports

Only signed-in Finance **admins** may upload and confirm approved Realty Finance v1.0 exports:

- ZIP: exactly `transactions.csv` (UTF-8, BOM, quoted RFC4180, CRLF) + `manifest.json` from Batch 11.
- XLSX: `Transactions`, `Summary`, `Metadata` sheets with the Batch 11 15-column layout and matching metadata. Formula cells, embedded content and external workbook connections are rejected.
- Maximum uploaded file: 2 MiB. Maximum accepted transaction rows: 500 per file.
- Standalone human-facing CSV is **not** a valid import: it omits trusted manifest metadata.

The checksum is an integrity check **not an authenticity signature**. Admins must verify the file originated from an authorized Realty export. Import permission/CSRF protections are not proof of the file's origin.

## Preconditions

- `FINANCE_IMPORTS_ENABLED=true` is required for preview and commit; defaults to disabled.
- `manifest.reconciled===true`, `warnings=[]`, v1.0, `source_system=realty`, `currency=PHP`, `status_scope=posted_only`.
- SHA256 of CSV bytes or canonical re-generated XLSX text is identical to `manifest.transactions_sha256`.
- Every row's identity, revision fingerprint, date, currency, type and status match Batch 11.
- Exact selected-period source totals and row count must equal the manifest.
- Source category must be explicitly mapped by Finance admin to an active Finance category of the same kind.

## Preview / confirmation

1. Admin approves category mappings; this is audited separately.
2. Upload preview stores the hash, source export ID, the entire normalized source row, category mapping and each decision (`new`, `duplicate`, `conflict`, `unmapped`). No money enters the ledger during preview.
3. Conflicting revisions and unknown categories block the entire confirmation. They are displayed for a manual review. A second or third upload of the same source identity and SHA matches a duplicate rather than posting new cash.
4. Preview expires after 60 minutes. The confirming admin must be the previewing admin.
5. Commit locks the preview batch and target identity rows; re-checks identity, revision and category mapping, inserts all *new* movements in a single database transaction, links per-row receipts to the resulting `finance_transactions` IDs and writes an audit event. Failure rolls back the whole commit. Source UNIQUE key is an additional concurrency guard.
6. Repeating confirmation of a successful batch returns its saved result. Uploading the same file again results in zero new ledger rows (existing identities classify as duplicates).

## Out of scope / carry forward to Batch 14

- Source revisions are *not* automatically applied as adjustments. A changed source identity is quarantined for review.
- A transaction missing from a later snapshot is not a cancellation or refund. The transfer schema has no authoritative change-feed semantics.
- Imported transactions cannot be manually voided/corrected with Batch 12's manual-only APIs.
- A refund can be imported as an explicitly recorded Realty refund *if* Batch 11 exported that posted cash movement; it is not inferred from a removed sale.
- No independent HR-to-Finance transfer; payroll enters the independent ledger only through one reconciled Realty export source.
- File signature/provenance verification and correction/void contract v2 require a separate design decision.

## Access / safety

Only admins can preview, map categories and commit. Existing Finance session and CSRF protections remain active. No Realty or HR DB queries are introduced. ZIP metadata bounds and content-size checks limit archive expansion. Origin, ownership, rate limiting and upload malware controls still require environment-specific production testing.
