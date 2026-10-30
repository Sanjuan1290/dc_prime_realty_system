# D&C Prime Realty — Batch 3 Interface & Data Contracts

**Status:** Design proposal only. Routes, table names and payloads below DO NOT exist in the supplied source unless explicitly stated. Do not treat these as implemented endpoints.

## Contract 01 — HR salary cash release → existing Realty Company Finances

**Purpose:** replace `companyFinances.service.js` SQL reads of `employee_payrolls` without changing source payroll calculations or property-finance aggregation.

**Producer:** HR API/database, from a successfully committed payroll cash release.  
**Transport:** HR outbox retry worker → authenticated Realty internal API.  
**Proposed route:** `POST /api/v1/internal/finance/salary-events` on the Realty API.  
**Consumers:** Realty stored event inbox + Realty-owned salary projection.  
**Not allowed:** SQL joins against HR, automatic cross-DB transactions, direct HR database credentials inside Realty.

### Canonical release event (dummy identifiers)

```json
{
  "schema_version": "1.0",
  "event_id": "a7be2b7d-063c-4cb9-89bb-0ef2d7b8936a",
  "event_type": "salary.cash_released.v1",
  "source_system": "hr",
  "source_payroll_id": "123",
  "source_event_version": 1,
  "cash_date": "2026-10-27",
  "recorded_at": "2026-10-27T05:00:00Z",
  "currency": "PHP",
  "amount": "6749.99",
  "direction": "out",
  "reference": "HR-PAYROLL-123-RELEASE-1",
  "display_label": "Salary payment #123"
}
```

### Required validation/semantics

| Field | Rule |
|---|---|
| `schema_version`, `event_type` | Reject unsupported major versions and unknown event types |
| `event_id` | Unique immutable identifier; repeat with identical payload is safe |
| `source_system` | Exactly `hr` for this receiver |
| `source_payroll_id` | Opaque stable original HR payroll key; never treat as Realty primary key |
| `source_event_version` | Positive integer; reject duplicate versions with altered content |
| `cash_date` | Effective date of actual cash movement in Asia/Manila |
| `recorded_at` | UTC timestamp when HR finalized the event |
| `currency` | `PHP` (reject other currencies until conversion rules exist) |
| `amount` | Positive decimal string with 2 decimal places (including `0.00` only for audit-only noncash events if such type is later designed) |
| `direction` | `out` on release; permitted return/correction semantics must be explicitly defined |
| `reference` | Stable human trace; does not replace primary idempotency key |

**Idempotency:** Realty inbox unique `(source_system, event_id)` plus release-version uniqueness `(source_system, source_payroll_id, event_type, source_event_version)`; compare stored canonical payload hash when replayed. Identical replay = HTTP 200 already_processed; same key, different payload = HTTP 409/manual investigation. A single cash release must never generate two live Realty expense rows.

**Transaction handling:**
1. HR commits payroll released status, amount and immutable outbox event atomically in **HR DB**.
2. Sender may retry on timeout/network/5xx; do not acknowledge until Realty commits inbox + local projection in one **Realty DB** transaction.
3. Realty stores `source_event_id`, `source_payroll_id`, version, cash_date, original amount and received timestamp.
4. Realty finance's salary branch reads `finance_external_salary_entries` rather than `employee_payrolls`.
5. Reconcile daily by IDs, counts and PHP amount totals for confirmed HR releases through a cutoff. Show pending/failed transfers in operations review; never silently substitute missing data with 0.

**Corrections/reversals:** Existing payroll corrections may change gross/net calculation but must **not** silently rewrite a recorded cash movement. Represent a wrong recorded cash event through an explicitly approved compensating event and its original event reference. A separate **actual cash returned** event is recognized as an inflow only when funds really return. Correction that does not move cash remains an HR record/audit event, not automatic Realty cash income. Validate the permissible workflow against existing payroll release rules before coding.

**Outage behavior:** HR releases proceed under HR's own approval rules; undelivered events stay pending with alerting and retry. Realty finance reports must state the HR sync cutoff or stale/pending state, rather than imply current completeness. No rollback via deleting previously accepted ledger events.

**Cash advances:** The existing Realty finance diagnostic reads `employee_cash_advances` but no current separate cash expense model has been verified. Preserve or replace the warning using an HR-issued reconciliation status; **do not assume** advances are automatically expenses, salary deductions, or cash release events without a dedicated approved contract.

## Contract 02 — Seller Network import undo → HR employee link eligibility

**Purpose:** stop direct Realty reads/writes of `employees` in `server/controllers/System/sellerGroup.controller.js` while preserving its guards against unsafe undo.

**Owner of Seller Network import:** Realty.  
**Owner of employee ↔ Realty user optional association:** HR.  
**Proposed route:** `POST /api/v1/internal/employee-links/check-delete` on HR API, called by Realty during destructive undo. Bulk request passes only Realty user IDs and a purpose identifier; no email matching.

Example:

```json
{
  "schema_version": "1.0",
  "realty_user_ids": [123, 124],
  "purpose": "network_import_undo"
}
```

Example response:

```json
{
  "schema_version": "1.0",
  "checked_at": "2026-10-27T05:00:00Z",
  "links": [
    {"realty_user_id": 123, "active_hr_link": true},
    {"realty_user_id": 124, "active_hr_link": false}
  ]
}
```

**Guard:** abort destructive undo if any imported Realty user has a current HR association, HR cannot be reached, payload is incomplete, or check freshness cannot be trusted. Show which *Realty account IDs* require separate HR unlink review. Do not automatically clear `employees.linked_user_id` from Realty. Retain original `network_member_import_items.linked_employee_ids_json` snapshots and historical undo/review evidence.

**Race condition note:** a pre-delete check alone is not enough to prevent a *new HR link* during deletion. Choose a concrete protocol in implementation: (A) reserve/lock pending Realty IDs in HR with short-lived signed operation ID until Realty confirms deletion, OR (B) permanently disallow delete of any Realty account ever mapped to HR and use account deactivation. **Recommended conservative Batch 8 policy: B (deactivate/block physical deletion for mapped accounts); revisit only with an atomic application-level protocol.** Existing undo behavior for truly unmapped accounts may continue. This avoids pretending the two databases share a transaction.

**Migration:** existing HR `employees.linked_user_id` and legacy snapshots are copied into a verified `hr_realty_identity_links` mapping. A new seller import does not auto-link employees by email. Admin-managed link/unlink requires HR permission and logs actor/reason.

## Contract 03 — Realty → independent Finance CSV / Excel import

**Purpose:** keep Realty's original Finance Tracker, provide an explicit transfer file for Finance Management. The human-facing seven-column CSV remains available separately.

**Versioned export header (proposed v1):**

```csv
schema_version,source_system,source_transaction_id,source_version,transaction_date,recorded_at,transaction_type,category,description,amount,currency,status,reference_id
1.0,realty,salary:123,1,2026-10-27,2026-10-27T05:00:00Z,expense,Salary,Salary payment 123,6749.99,PHP,posted,HR-PAYROLL-123-RELEASE-1
```

| Field | Rule |
|---|---|
| `source_system`, `source_transaction_id`, `source_version` | Durable source identity, not file name or row number; source revision handled through a defined adjustment record |
| `transaction_date`, `recorded_at` | Date / timestamp semantics as above |
| `transaction_type` | `income` or `expense`; amount is positive |
| `category`, `description` | Sanitized as spreadsheet cell text, mapped by explicit policy |
| `amount`, `currency` | Decimal string to 2dp, `PHP` |
| `status` | `posted` or supported adjustment/void event, not silent overwrite |
| `reference_id` | Optional domain reference; preserve source provenance |

**Importer:** preview with counts and money in/out; check header/version/file type/currency/dates, finite positive amounts, category mapping, user permissions, duplicate source keys, source corrections and spreadsheet formula strings; write an import batch audit and row errors. Same file or overlapping date exports may be imported repeatedly without doubling amounts. Do not calculate date-range balance from rows omitted by an export filter unless a clearly labeled period scope is shown.

**Important duplicate path:** HR salary should flow `HR → Realty existing finance → Realty exported row → independent Finance`. Do not also feed the exact same salary from HR directly to independent Finance, unless a single normalized source key and dual-path reconciliation design is explicitly adopted later.

**Future cancellations/voids:** importing a new version of an existing transaction must not create another posted amount. Prefer immutable adjusting/reversing transactions with stable IDs and explicit references; do not mutate prior approved ledger evidence silently. Import zero opening balance only as a configured ledger baseline, not as a synthetic income row.

## Contract 04 — HR payroll receipts and malware scan updates

- HR database owns `employee_payroll_signed_receipts` and protected document metadata after cutover.
- Keep Cloudinary asset IDs/version and verified scan states; access uses HR permissions, not shared Realty session cookies.
- Incoming Cloudinary callbacks must be signature-verified at the actual provider-facing endpoint; route based on trusted ownership metadata to the correct service, or relay a signed authenticated internal event (idempotent by provider event/resource/version).
- Avoid exposing raw asset URLs, access tokens, employee names, or file contents in financial transfer payloads.
- Test old receipts, new uploads, scan pending/infected/clean transitions, and denial of cross-app access.

## Contract 05 — Independent auth and history

- Realty/HR/Finance sessions, tokens, roles, password reset, user tables and logs are owned independently.
- No cross-app session accepted by default; shared email never acts as an access key.
- `hr_legacy_user_map` records verified old Realty actor IDs to local HR actors, including status and conversion timestamp; historical actor snapshots survive deactivated or deleted source identities.
- Preserve immutable source audit and receipt evidence in Realty during the migration/retention period; copy relevant material to HR with explicit source IDs.

## Proposed database additions (names are placeholders for versioned migrations)

| Database | Proposed table | Purpose |
|---|---|---|
| HR | `hr_users`, HR role/permission tables | Independent staff authentication |
| HR | `hr_legacy_user_map` | Historical actor/account mapping |
| HR | `hr_settings` | 10 attendance/department settings extracted from Realty |
| HR | `hr_realty_identity_links` | Optional employee ↔ external Realty account reference |
| HR | `hr_integration_outbox` | Atomic pending salary event deliveries |
| HR | `hr_audit_logs` | New HR-only actions |
| Realty | `finance_external_salary_event_inbox` | Received HR event ID/hash and delivery history |
| Realty | `finance_external_salary_entries` | Materialized cash activity used by existing finance SQL |
| Finance | Independent ledger/users/import-batch/row-error/adjustment/audit tables | Designed/created during Batches 12–13 |

These are **design-time candidates**, not a complete CREATE TABLE specification. Each new schema requires field-level PK/FK/index/security review and real target-DB compatibility testing in its implementation batch.

## Contract test matrix

| Test | Pass condition |
|---|---|
| Release send twice | Exactly one Realty salary expense, second call idempotently acknowledged |
| Release payload tampered with existing event ID | Conflict, no financial rewrite |
| HR↔Realty network timeout | HR outbox retries; Realty state stable; sync lag visible |
| Same Realty finance export imported twice | No duplicated independent Finance ledger entries |
| Overlapping exports | Only unseen source versions imported |
| Payroll calculation correction | No fictional cash inflow |
| Cancelled/mismatched seller import undo | Active HR-linked identity not deleted; no Realty SQL touching HR tables |
| HR API unavailable on destructive undo | Undo blocked, not bypassed |
| Signed receipts and Cloudinary scan callback | Scan updates routed to owning HR service; external access denied |
| Auth and access | Realty sessions never grant HR/Finance roles |

