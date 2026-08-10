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

