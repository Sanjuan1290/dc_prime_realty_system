# Database migrations

These files are historical schema/data migrations for existing D&C Prime Realty databases. Keep them in source control even when the current database already contains the resulting columns or data fixes: they document the upgrade path used by older deployments.

## Order

Apply unapplied migrations in filename/date order. Always back up the database first and read each migration header before running it.

## Important distinctions

- `20260718_direct_agent_overrides.sql` is the original direct-agent commission migration.
- `20260718_direct_agent_overrides_repair.sql` is a resumable repair for databases where the original migration stopped part-way. It is not a duplicate replacement.
- `20260803_payment_soa_transaction_safety.sql` adds payment/SOA request-key safety.
- `20260803_financial_transaction_hardening.sql` adds additional uniqueness and financial-transaction safeguards. It is not a duplicate of the payment/SOA migration.

## Verification scripts

Read-only verification SQL does not belong in this migration directory. It lives under `server/scripts/` instead.

Current verification script moved there:

- `server/scripts/verify-downpayment-amount-mode.sql`

That script checks the downpayment amount-mode schema and does not modify data.

## Final Double-Check refactor

The client Final Double-Check refactor does not require a database migration.

## Storage-code and canonical-file migration

`20260810_storage_codes_and_canonical_file_names.sql` adds permanent storage identifiers used by protected Cloudinary assets:

- project storage codes such as `PRJ-LA-001`
- listing storage codes such as `LST-000042`
- permanent Document Library codes such as `DOC-ITB`
- payment storage codes such as `PAY-2026-000061`
- canonical document version/sequence metadata and payment-proof sequence metadata

Apply this SQL migration before running `npm run migrate:cloudinary-documents`. The Cloudinary script is dry-run by default; only `--apply` changes remote assets/database file metadata.

- `20260907_attendance_settings_and_secure_barcodes.sql` — persistent Attendance Settings and separate secure 10-digit Attendance Barcodes.


## 2026-09-26 — Payment notifications and cancellation access
Run `20260926_payment_notifications_and_cancellation_access.sql` after the RBAC migrations. It adds the Add Payment email-notification toggle. The three new cancellation permissions default OFF for configurable roles and can be enabled from Role & Access Control.

## 2026-10-05 Batch 5: Broker Name and Company Profit cap

`20261005_batch5_broker_name_and_company_profit_cap.sql` drops the unique index on Broker Name (License No., Realty Name and PRC No. stay unique) and adds `system_settings.max_company_profit_percent_of_pool` (default 50).

Run the read-only report `server/scripts/verify-company-profit-and-seller-identity.sql` before and after. It lists In-House Network rates above the new Company Profit cap, active sellers without a PRC No., and PRC/TIN numbers shared by more than one active seller. The new rules only apply when a Network or seller is next saved.

Seller PRC/TIN uniqueness is enforced in the application (`server/services/sellerIdentity.service.js`) inside the save transaction, not by a database index, because PRC/TIN live on `users` while Network membership status lives on `accredited_sellers`.

## 2026-10-05 Batch 6: review workflow fixes

`20261005_batch6_workflow_responders_and_approval_types.sql` adds `operational_reviews.approval_type` and the Audit Case responder reassignment columns, and backfills existing Super Admin reviews as emergency changes so open Audit Cases on them can be answered. The two `ADD CONSTRAINT` statements are the only non-idempotent lines; on a re-run their duplicate-name error can be ignored.

Every action that creates an Operational Review must be registered in `server/config/reviewActions.js` with its department. `createOperationalReview()` rejects unregistered keys.
