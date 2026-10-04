# D&C Prime Realty — RBAC Roles & Per-Account Access Update

This project tree contains the cumulative 2026-09-25 implementation of the role-based + per-account + project-scope access-control plan.

Implemented areas include:

- six internal system roles with Super Admin full-access bypass;
- editable role-default permission templates;
- authoritative copied per-account permissions;
- all-project / selected-project scope for configurable system roles;
- immutable system roles and account-code/person-key sequencing;
- atomic Change Position / replacement-account workflow;
- permanent deactivation and session invalidation;
- safe historical email reuse and email-or-account-code login;
- granular backend route authorization and project-scope enforcement;
- permission-aware layouts, navigation, direct routes, tabs and actions;
- server-side response shaping for protected project/listing data;
- preservation of accredited-seller roles and owner-level security safeguards.

## Migration

Apply:

`server/migrations/20260925_system_rbac_roles_and_access.sql`

This migration updates role-default templates without silently replacing existing users' authoritative `user_permissions`.

## Validation artifacts

See:

- `RBAC_UPDATE_NOTES.md`
- `FINAL_TEST_RESULT_SUMMARY.txt`
- `FINAL_VALIDATION.md`
- `MIGRATION_VALIDATION.txt`
- `FULL_SERVER_TEST_FINAL_HARNESS.txt`
- `CLIENT_PRODUCTION_BUILD_ATTEMPT.txt`

## Final environment-dependent verification

The execution environment used to prepare this package could not resolve `registry.npmjs.org`; installed npm dependencies were not available. Before deployment, run:

```bash
cd server
npm ci
npm test

cd ../client
npm ci
npm run build
```

The supplied code passes migration validation, the complete repository test inventory under temporary import-compatibility stubs, and source syntax parsing. The real Vite production build is **not claimed as verified** until the commands above run successfully with actual dependencies.

## 2026-10-04 — Accredited Sellers Excel Import / Export

- Added **Import Members** inside each In-House Network, beside Add Member.
- Import template columns: First Name, Middle Name, Last Name, Email, Contact Number, Role, Reports Under Email, TIN, PRC Number.
- Network assignment is taken from the open In-House Network page; imported members are Active by default.
- Preview validates the complete hierarchy without writing to the database. Excel row order does not matter; hierarchy is resolved DM → SD → UM → SA.
- Bulk import cannot add/replace the Network hierarchy head, cannot silently change seller roles, and blocks Active sellers assigned to another Network.
- Inactive sellers may transfer only after old Network dependencies/head responsibility are cleared.
- Confirm Import revalidates inside one transaction so the file is all-or-nothing.
- Added **Export Excel** to the main Accredited Sellers page for all non-system-dummy accredited seller records.
- This feature uses the existing database schema; **no additional database migration is required** beyond the previously supplied Network/Broker/Company Profit migration.
