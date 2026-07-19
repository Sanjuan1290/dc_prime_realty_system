# Database seed

Import `Dump20260718_clean.sql` into an empty MySQL database.

The dump keeps all 48 table structures and seeds only:

- one `super_admin` account
- the document library
- document templates
- template-to-document assignments

All projects, seller groups, sellers, clients, listings, payments, commissions, employees, notifications, audit records, and other operational rows are empty. Auto-increment counters restart from the remaining seeded rows.

