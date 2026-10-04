# Network Member Import Validation Fix — 2026-10-04

This patch fixes the Accredited Sellers / In-House Network Excel member import Preview flow.

## Fixes
- Approves only `POST /seller-groups/:groupId/members/import/preview` as a validation-only technical mutation, matching the existing Listing Excel import Preview pattern.
- Preview now reaches the server and returns row-level validation instead of showing `This mutation is not approved as a technical no-review operation.`
- Error alert includes the first row-specific errors, e.g. `Row 4: Reports Under Email ... was not found...`.
- The Import Preview table continues showing every affected Excel row and all of its validation messages.
- Actual Commit no longer uses a technical bypass. It now opens a Final Double-Check showing Network, filename, member count, Create/Update/Transfer counts, and Active status before saving.
- Commit remains transactional and revalidates the hierarchy on the server.

## Tests
`server/tests/networkMemberExcelImport20261004.test.js`: 16/16 passed.

No database migration is required.
