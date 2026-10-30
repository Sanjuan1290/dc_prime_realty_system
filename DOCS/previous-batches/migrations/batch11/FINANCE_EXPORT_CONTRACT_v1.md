# Batch 11 — Realty Finance Export Contract v1.0

## Ownership and supported formats

- Existing GET `/api/v1/company-finances/transactions/export?from=YYYY-MM-DD&to=YYYY-MM-DD` remains available as **report CSV**. Its seven columns, currency signs and legacy behavior remain unchanged by default.
- `format=xlsx&profile=report` gives a report workbook with **Transactions**, **Summary**, and **Metadata** tabs. It uses the versioned schema even for report output; the human CSV stays untouched.
- `format=csv&profile=transfer` gives ZIP with **transactions.csv** and **manifest.json**, not a standalone CSV. Batch 13 must ingest both members in one verification operation.
- `format=xlsx&profile=transfer` gives a versioned XLSX workbook with **Transactions**, **Summary**, and **Metadata** tabs. Batch 13 must read and validate the workbook's metadata and columns.
- Query filters: `kind=all|income|expense`, `source=all|manual|property|salary|commission|commission_archive|network_payout|refund`, and `category=all|<exact category display name>`; `from` and `to` are inclusive. Filters do not change historical account balance. Files include **all selected rows across pages**; no implicit 100-row cut.

## Strict v1.0 row contract

`schema_version,source_system,source_transaction_id,source_version,transaction_date,recorded_at,transaction_type,category,description,amount,currency,status,reference_id,source_type,source_revision_sha256`

- `schema_version=1.0`, `source_system=realty`, `source_version=1`, `currency=PHP`, `status=posted` for all emitted rows. These are **posted cash movements** only. This version is not a complete adjustment/void feed.
- `source_transaction_id` is the existing Realty consolidated reference (`property:ID`, `salary:ID`, `manual:ID`, `commission:ID`, `network:ID`, `refund:ID`), **not** the receipt/reference number used at collection. Stable source identity must not be inferred from a ZIP export ID or row number.
- `reference_id` is left empty because the consolidated Finance query does not expose a validated domain payment reference. Never invent one. Add a dedicated source-specific join/column with tests in a later version if required.
- `transaction_date` is Manila business calendar date `YYYY-MM-DD`; `recorded_at` is a legacy string `YYYY-MM-DD HH:mm:ss` or empty when unknown. It is **not UTC** and should not be silently interpreted as UTC. `generated_at` metadata is UTC ISO 8601.
- `transaction_type` is `income` or `expense`; `amount` is a **positive**, un-signed decimal string with two digits after the decimal point. There are no negative reversal rows in v1.
- `source_revision_sha256` is a SHA-256 fingerprint of canonical source fields including amount, category, description and recording timestamp. This fingerprint is **not** an incrementing revision number. If a later export contains the same `source_transaction_id` with a changed fingerprint, Batch 13 must quarantine it for correction review, not add a second cash movement. The source currently edits some manual transactions in place, so full correction history cannot be re-created from a snapshot.
- Source type `commission_archive` maps to the same `commission:ID` identity as the corresponding live release and is excluded in the source SQL when the live released row already exists. The exporter checks for repeated source IDs and rejects a conflicting file.
- `Salary` rows originate from **either** legacy payroll or Batch 8 external salary transfer, according to the active Realty finance source; never import a second HR salary feed into independent Finance in parallel.

## ZIP manifest

`manifest.json` fields include `schema_version`, `source_system`, `export_id`, `generated_at`, `currency`, `period`, `filters`, `status_scope`, `salary_source`, `warnings`, `reconciled`, `snapshot`, `context`, `transactions_sha256`, `checksum_algorithm`, `data_file`, `import_policy`.

- `snapshot` has selected record count, PHP money-in, money-out and selected net change. `context` has unfiltered report period totals and the unfiltered *all-history* balance to the selected end date. Do not claim a filtered total equals the company account balance.
- `transactions_sha256` hashes the exact UTF-8 content of `transactions.csv` **including BOM and CRLF**. The hash detects accidental modification, but is **not an authenticity signature**. Authenticity depends on trusted export origin and transport; independent Finance must validate signed/authenticated sources if files can be forwarded by untrusted parties.
- All columns are present even for zero-row exports, with totals and count in the manifest.
- The CSV writer uses RFC4180 quoting and prefixes a single quote to potentially dangerous spreadsheet prefixes (`=`, `+`, `-`, `@`, apostrophe, tab, line break, and some fullwidth variants). **Batch 13 must implement the exact reversible decoder and validate allowed fields after decoding**. Do not `eval` formulas or accept workbooks containing formula-valued cells. The XLSX builder stores all transaction fields as text (no formulas).

## Transfer release gate

Transfers are intentionally disabled until all three are true:

1. The server has `FINANCE_TRANSFER_ENABLED=true`;
2. `FINANCE_TRANSFER_RECONCILED_THROUGH_DATE` is a valid approved `YYYY-MM-DD` not earlier than the selected `to` date;
3. The existing finance report has `balance_verified=true`, meaning it has **no known warning flags**. This third condition does *not itself* replace ledger reconciliation. Approvers must separately compare actual payroll, property and expense totals before setting the cutoff.

The standard reports remain downloadable regardless of the transfer gate. Do not enable the transfer gate in production until Batch 8/9 salary history is reconciled and the business owner accepts the cutoff. All endpoints require the existing `COMPANY_FINANCES_VIEW` permission.

## Importer expectations (Batch 13)

Reject unsupported version, missing manifest, hash mismatch, duplicate source IDs, modified source versions, mismatching counts/totals, malformed CSV, formula values in workbook, unknown currency/status, and category maps without approval. Preserve import batch ID, operator, time, original file hash, individual row decision and original source identity. A recurring export is a **snapshot**, not an append-only changelog; missing rows should not be treated as voids. A separate versioned adjustment contract is required to handle cancellations and corrections.
