# D&C Prime Realty System

React, Node.js, Express, and MySQL source code for the D&C Prime Realty administration and lot-project system.

## Changes in this package

### Audit logs

- Removed the permanent delete-all API and button.
- Added export-first archival for records older than the retention period.
- Default retention is 365 days. The allowed range is 90–3650 days.
- Limited archival and export downloads to Super Admin.
- Kept password and 6-digit email-code verification.
- Stored each CSV export in `audit_log_archive_batches` before moving rows.
- Moved archived rows to `audit_logs_archive`.
- Recorded archive creation and export downloads in `audit_log_archive_events`.
- Added database triggers that block direct audit-log deletion and make archive tables append-only.

### Pending cancellation

- Kept the existing **Settlement** action.
- Added **Cancel Cancellation**.
- Cancel Cancellation returns the listing to **Sold / Active**.
- It keeps buyer, payment, SOA, document, and commission records.
- The backend rejects this transition unless the dedicated action is used.


### Seller hierarchy and reservation documents

- Template selection filters the reservation document library instead of adding the full template.
- Seller Group Details can create a user inside the current group.
- Reporting follows BNM → Broker → Manager → Agent.
- Only BNM or Broker accounts can be group heads.
- Agent project rates are sales rates. Manager, Broker, and BNM project rates are override rates.
- New reservations require a complete role-valid path from Agent to the group head.

See `ROLE_BASED_SELLER_HIERARCHY_UPDATE.md` for the migration order and behavior.

## Database setup

### Fresh database

Import:

```text
database/Dump20260715_updated.sql
```

### Existing database

Run:

```text
server/migrations/20260715_audit_log_archival.sql
```

The migration removes the old deletion-verification table and installs the archival tables and triggers.

## Server setup

```bash
cd server
cp .env.example .env
npm ci
npm run dev
```

Set these audit archive values in `server/.env`:

```env
JWT_SECRET=replace_with_a_long_random_secret
AUDIT_ARCHIVE_CODE_SECRET=replace_with_a_different_long_random_secret
```

SMTP settings are required for the 6-digit verification email.

## Client setup

```bash
cd client
cp .env.example .env
npm ci
npm run dev
```

## Tests and build

Validated for this package:

- Server: 119 tests passed.
- Client: Vite production build completed.

## Scope note

A second-approver rule for all destructive financial actions was not activated in this package. That change needs an approval matrix covering payments, payroll, commissions, cash advances, cancellation settlement, and reversal rules. Adding it without that policy could block valid work or create inconsistent approvals.

## Public images

The uploaded source export contained remote references rather than the original PNG bytes. Valid placeholders are included in `client/public` so the app builds. Replace them with the company’s original assets when available.

