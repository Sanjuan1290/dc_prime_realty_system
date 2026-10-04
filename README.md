# D&C Prime Realty — Accredited Sellers Excel Import / Export

This patch is based on `dc_prime_reconstructed_updated_20261004_v2`.

## Included
- In-House Network `Import Members` button beside `Add Member`.
- `.xlsx` template download with Members, Instructions, and Examples sheets.
- No Network Name column; current Network is authoritative.
- No Status column; successfully imported sellers are Active by default.
- Server Preview with hierarchy validation and no writes.
- Transactional Confirm Import with hierarchy-order processing.
- Active cross-Network seller protection and safe inactive transfer rules.
- Main Accredited Sellers `Export Excel` action.
- Automated import/hierarchy/source tests.

## Database
No new database schema migration is required for this patch. It uses the existing `users`, `accredited_sellers`, `accredited_seller_managed_sellers`, and `seller_groups` tables.

The earlier Network/Broker/Company Profit migration is still required if it has not already been applied.

## Template refinement (2026-10-04)
- Removed the extra UI copy about intentionally excluding Network Name/Status and the SD→UM→SA-only wording.
- The Examples sheet now shows the complete existing DM → SD → UM → SA chain.
- The Members sheet now starts with one highlighted sample Sales Director row. Users can delete it before entering data; if it is left untouched, the importer ignores it automatically.
- The sample row uses Sales Director because bulk import must not create or replace the Network Division Manager/head.
