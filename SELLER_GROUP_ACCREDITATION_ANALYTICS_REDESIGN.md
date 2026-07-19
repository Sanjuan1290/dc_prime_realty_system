# Seller Group Accreditation and Analytics Redesign

## What changed

### Seller group project accreditation

- New groups start with no project accreditation.
- Add Group and Edit Group require at least one selected project.
- Each selected project stores its own group pool rate from 6% to 15%.
- Removing a project from a group uses a confirmation dialog.
- Saving a removal deactivates that group-project accreditation and its future direct-rate and override configuration.
- Historical reservations, commissions, releases, and audit records remain unchanged.

### Group details page

- Removed the Project Commission Pool allocation panel.
- Removed Active Sales Agents, Direct-Sales Agents, and Paths With Errors cards.
- Replaced separate Direct Rate and Parent Override columns with one Rates column.
- The Actions column now contains one Edit Rate action.
- The rate editor handles the member's direct-sale setup and parent override in one modal.
- Project selection lists only projects accredited to the current group.

### Live project analytics

The selected project and date range now load real database totals for:

- active group members
- number of sales
- total sales value
- gross commission accumulated
- released commission
- remaining commission
- sales and commission trend
- sales by agent

Date controls include Last 30 Days, This Year, Last 12 Months, and a custom From Date / To Date range.

### Status and responsive behavior

- Added loading, refreshing, saving, success, warning, removal-confirmation, empty, and API-error states.
- Forms keep entered values after an API error.
- Buttons block duplicate requests while a save is pending.
- Tables switch to cards on smaller screens.
- Charts resize with their container.

## API changes

- `GET /seller-groups/:groupId/projects`
- `GET /seller-groups/:groupId/projects/:projectId/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PATCH /seller-groups/:groupId/projects/:projectId/members/:memberId/rates`

Existing group create and edit endpoints now require an explicit `project_rates` array.

## Database

No new migration is required for the current database. The redesign uses the existing:

- `seller_group_lot_project_rates`
- `agent_lot_project_direct_rates`
- `seller_hierarchy_lot_project_overrides`
- reservation and commission tables

The active/inactive field on `seller_group_lot_project_rates` now acts as the project-accreditation status.

## Deployment

1. Back up the application and database.
2. Replace the client and server files from this package.
3. Remove `client/src/components/System/sellerGroupComponents/CommissionRateModal.jsx` if it still exists.
4. Install dependencies with `npm ci` in `server` and `client`.
5. Restart the server.
6. Build and deploy the client.
7. Open each seller group and confirm its accredited projects in Edit Group.

## Validation completed

- Server tests: 104 passed, 0 failed.
- Changed client files: ESLint passed.
- Client production build: passed.
- Changed server controller and router: syntax checks passed.
- No live browser-to-MySQL test was run inside the build container.

