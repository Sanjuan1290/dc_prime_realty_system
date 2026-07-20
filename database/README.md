# Database setup

## Fresh database

Import:

```text
Dump20260720_complete.sql
```

This starts with `Dump20260720_current.sql` and then applies the final account-retention and secure-document migration.

## Existing database

Back up the database before running migrations.

Run only the files your database has not already received, in this order:

```text
server/migrations/20260715_audit_log_archival.sql
server/migrations/20260717_dashboard_reservation_history.sql
server/migrations/20260718_direct_agent_overrides.sql
server/migrations/20260718_direct_agent_overrides_repair.sql
server/migrations/20260719_dual_listing_pricing_and_contract_snapshots.sql
server/migrations/20260719_role_based_seller_rates.sql
server/migrations/20260719_cancellation_settlement_financial_archive.sql
server/migrations/20260720_login_remember_me_and_password_reset.sql
server/migrations/20260720_account_retention_secure_purge_cloudinary.sql
```

A database already matching `Dump20260720_current.sql` needs only:

```text
server/migrations/20260720_account_retention_secure_purge_cloudinary.sql
```

## Final migration behavior

`20260720_account_retention_secure_purge_cloudinary.sql`:

- Creates permanent buyer-account records for each reservation.
- Creates history-only account entries for older cancelled sales whose live buyer rows were deleted by the old flow.
- Adds account references to payments, schedules, documents, commissions, receipts, SOA statements, notifications, buyer forms, and cancellation archives.
- Allows several buyer profiles for one listing while keeping one current account pointer.
- Adds `Earned on Cancellation` and `Forfeited on Cancellation` release statuses.
- Adds normalized Cloudinary document-file metadata.
- Adds password/email-code verification and permanent purge-event tables.
- Does not delete existing buyer, payment, document, or commission history.

## Post-migration checks

Run these checks before opening the system to users:

```sql
SELECT account_status, COUNT(*)
FROM lot_project_accounts
GROUP BY account_status;

SELECT COUNT(*) AS payments_without_account
FROM lot_project_payments
WHERE lot_project_account_id IS NULL;

SELECT COUNT(*) AS schedules_without_account
FROM lot_project_payment_schedules
WHERE lot_project_account_id IS NULL;

SELECT COUNT(*) AS commissions_without_account
FROM lot_project_commissions
WHERE lot_project_account_id IS NULL;

SELECT l.lot_project_listing_unit_id, a.account_reference, a.account_status
FROM lot_project_listings l
LEFT JOIN lot_project_accounts a
  ON a.lot_project_account_id = l.current_account_id
ORDER BY l.lot_project_listing_id;
```

Rows without an account may be legitimate old unmatched records. Review them before assigning them manually; do not attach them to a buyer by unit ID alone.
