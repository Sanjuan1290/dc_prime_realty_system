# D&C Batch 8 — Salary event contract v1

**Producer:** independent HR staging. **Consumer:** Realty staging. **Schema:** `1.0`.

`POST /api/v1/internal/finance/salary-events` with JSON and a server-only `Authorization: Bearer <secret>` header. Receiver requires staging enabled, checks secret with constant-time comparison, and writes the inbox plus materialized cash expense in one Realty database transaction. Sender has a separate HR transaction containing the release and its outbox record. There is no distributed SQL transaction between databases.

```json
{
  "schema_version": "1.0",
  "event_id": "a7be2b7d-063c-4cb9-89bb-0ef2d7b8936a",
  "event_type": "salary.cash_released.v1",
  "source_system": "hr",
  "source_payroll_id": "123",
  "source_event_version": 1,
  "cash_date": "2026-10-27",
  "recorded_at": "2026-10-27T05:00:00.000Z",
  "currency": "PHP",
  "amount": "6749.99",
  "direction": "out",
  "reference": "HR-PAYROLL-123-RELEASE-1",
  "display_label": "Salary payment #123"
}
```

**Idempotency:** primary key `event_id`; unique `(source_system, source_payroll_id, source_event_version)`; unique Realty salary entry per source payroll. Canonical payload SHA256 ensures identical replay accepted, modified/re-keyed payloads rejected. Returns `200 {success:true,status:'recorded' | 'already_processed',event_id}` or a typed failure. Money never enters manual `company_finance_transactions`.

**Privacy:** no employee name, compensation details beyond actual cash release, pay-period deductions, account credentials or protected receipt links in event.

**Cash reporting:** source `salary`, reference `salary:<payroll_id>`, expense equal to released `net_fund_release`, using actual released cash date. `recorded_at` is transformed from UTC to Manila time. Zero cash does not produce an expense.

**Reconciliation:** count, ID, dates and cent-level totals across original HR releases / HR outbox / Realty salary projection. `finance_hr_sync_state` is NOT updated automatically when a message arrives. Manual attestation is required after independent comparison. HR advances require separate review; incomplete state yields warning and `balance_verified=false`.

**Not supported in v1:** offsetting historical salary corrections, payment reversal events, separate cash-return events, multi-currency payroll, backdated duplicate releases, automatic historical backfill. Those require a separate approved immutable policy and updated contract, not quiet overwrites.
