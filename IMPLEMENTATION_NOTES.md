# D&C Prime Realty Dashboard and Document Tracking Rework

## Implemented

### System Dashboard

- Added Admin access at `/admin/dashboard` and made it the Admin home page.
- Added `SYSTEM_DASHBOARD_VIEW` and granted Admin the dashboard permissions used by the API and client.
- Removed the **All** date option.
- Changed custom date inputs to calendar-month selectors.
- All date ranges resolve from the first day of the starting month through the final day of the ending month.
- Admin may use short ranges, including one month, but cannot request more than 12 calendar months.
- Super Admin may request more than 12 months after acknowledging the long-range warning.
- Updated the main cards to show:
  - Total Gross Sales
  - Cash Collected
  - Cash Collectibles − Discount
  - Total Number of Reservations
  - Total Net Sales
- Added the formula below each card.
- Added cancellation totals and a composed cancellation chart for count and contract value.
- Added pending-cancellation and cancelled values/counts to inventory reporting.
- Updated chart tooltips so each series has its matching colour square before the label.

### Reservation and cancellation history

- Added `lot_project_reservation_history` through an additive migration.
- New reservations create permanent history records.
- Pending, reversed, and finalized cancellation transitions update the matching reservation record.
- Finalized cancellations preserve TCP, verified cash collected, cancellation type, reason, timestamp, and acting user snapshots.
- Dashboard reservation and cancellation reporting uses the history table when available, with a compatibility fallback for databases that have not run the migration yet.

### Projects and documents

- Replaced the project-level **Required Docs** summary with **Pending Documents**.
- Pending means a required document with `Missing` or `Rejected` status.
- Changed the project table to show actual `Submitted / Total` document progress.
- Added a project selector, horizontal document-compliance chart, and complete per-unit table.
- The per-unit view separates Approved, Awaiting Approval, and Pending Required documents.
- Current compliance includes sold/active, fully paid, and pending-cancellation accounts; finalized cancelled, available, and hold units are excluded.

### Notifications

- Added Payment Notifications and Document Notifications tabs.
- Added document summary cards, filters, search, and links to the related listing.
- Document notifications report missing, rejected, submitted-awaiting-approval, and total pending requirements.

## New API routes

- `GET /api/v1/projects/lot-projects/document-compliance`
- `GET /api/v1/notifications/documents`

Existing per-project dashboard routes now return the revised sales, reservation, inventory, and cancellation fields.

## Database deployment

Run this migration before deploying the revised API:

```text
server/migrations/20260717_dashboard_reservation_history.sql
```

The migration is additive and backfills one history record for existing reserved, pending-cancellation, and cancelled listings. Repeated reservation/cancellation reporting becomes authoritative for events recorded after this migration is active.

Back up the production database first and run the migration against a staging copy. The SQL queries and migration were statically reviewed, but this workspace did not connect to the production MySQL database.

## Validation completed

- Server test suite: **80 passed, 0 failed**.
- Server JavaScript syntax checks: **passed**.
- Client production build: **passed**.
- Vite reports a bundle-size warning for chunks above 500 kB; it does not block the build.
- The repository-wide lint command still reports existing baseline issues across older files, primarily custom `useFetch` naming and React hook rules. These lint findings did not block the production build or server tests.

## Main changed files

```text
client/src/App.jsx
client/src/config/permissions.js
client/src/layout/adminLayout.jsx
client/src/pages/System/Dashboard.jsx
client/src/pages/System/Projects.jsx
client/src/pages/System/Notifications.jsx
server/config/permissions.js
server/controllers/Lot_Projects/Dashboard/Dashboard.controller.js
server/controllers/Lot_Projects/ListingProfile/ReserveListing.controller.js
server/controllers/Lot_Projects/Listings/Listings.controller.js
server/controllers/System/projects.controller.js
server/controllers/System/notifications.controller.js
server/routers/System/projects.routers.js
server/routers/System/notifications.routers.js
server/migrations/20260717_dashboard_reservation_history.sql
server/tests/adminPermissions.test.js
server/tests/dashboardDateRange.test.js
```
