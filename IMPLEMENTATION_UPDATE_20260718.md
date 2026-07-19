# Seller Group and Database Reset Update

## Seller group changes

- The member rate column now shows numeric receiving rates only.
- Removed `Direct sales: Not enabled`, `Parent gets`, and similar technical labels.
- Each reservation commission path must allocate exactly the selected group pool rate.
- Added pagination to the Member Rates list with 10, 25, and 50 row options.
- Removed the Sales and Commission Trend chart.
- Removed the Sales by Agent chart.
- New Seller Group and Edit Seller Group now use a Group Pool Rate dropdown from 6% to 15%.

## Database reset

Import `database/Dump20260718_clean.sql` to rebuild the schema with only:

- One active Super Admin account
- 22 document library records
- 5 document templates
- 29 template-to-document mappings

All operational records are empty. This includes projects, listings, clients, seller groups, accredited sellers, payments, commissions, employees, notifications, and audit logs.

### Seeded Super Admin

- Email: `robertrenbysanjuan@gmail.com`
- Default password: `password`

Change the password after the first login.

## Validation

- Server regression suite: 107 passed, 0 failed
- Changed client files: ESLint passed
- Client production build: passed

The repository-wide ESLint command still reports older issues in unrelated existing files. Those files were not changed in this update.
