# Independent Finance — Domain Contract v1 (Batch 12)

### Ownership and boundaries

Finance runs in `apps/finance-client`, `apps/finance-server`, `dc_prime_finance_db`. No direct read from Realty or HR. Existing Realty Company Finances remains unchanged. Batch 11 export files are not ingested until Batch 13.

### Money and date contract

- PHP money is a positive string in `0.00` format on writes and in JSON responses. Server validates using integer centavos, stores `DECIMAL(16,2)` and never rounds using JavaScript floating point.
- `transaction_date` is a Manila business date `YYYY-MM-DD`, not a UTC timestamp; no future cash transactions in v1.
- Balance starts at exactly `0.00`; only `posted` rows with dates on or before `to` contribute to closing balance.
- Selected range totals are separate from full running cash balance. A zero period net does not imply the account has zero cash.

### Ledger state changes

| Operation | Accounting effect | Traceability |
|---|---|---|
| POST | New manual income/expense cash movement | Created-by/time and audit log |
| VOID | Prior posted manual movement changes to void; excluded from balance | Original amount retained, reason, actor and timestamp |
| CORRECT | In one DB transaction, void prior posted manual row and create a linked replacement row | One corrected-from link, reason and two audit actions |
| IMPORT (Batch 13) | Disabled in v1 | Will use idempotent source IDs and batch receipts |

Neither manual void nor correction is allowed on imported records. That requires a separate approved imported-source adjustment policy in Batch 13. A void is an accounting cancellation of the entry, not proof of a bank refund. Reconcile cash movements with real payment evidence.

### Roles

| Ability | Viewer | Accountant | Admin |
|---|:---:|:---:|:---:|
| Dashboard, history, categories | Yes | Yes | Yes |
| Post manual transactions | No | Yes | Yes |
| Create/disable category | No | No | Yes |
| Void/correct manual transactions | No | No | Yes |
| View audit log | No | No | Yes |
| Create Finance users | No | No | Yes |

### Response fields

`GET /api/v1/finance/dashboard?from=2026-10-01&to=2026-10-27` returns `opening_balance`, `money_in`, `money_out`, `net_change`, `closing_balance`, `currency`, `total_posted` as separate period/lifetime metrics. Amounts are decimal strings. `GET /api/v1/finance/transactions` returns paginated records with date/status/kind/category filters.

### Batch 13 handoff

Add `finance_import_batches`, `finance_import_items`, checksum and import-by-source-id tracking. Match the exact Batch 11 `transactions.csv` + `manifest.json` contract. Reject changed revisions pending review; do not create new transaction IDs for already-ingested source IDs. Snapshot gaps are not voids. Salary must enter Finance through Realty's approved export only, not a second HR feed.
