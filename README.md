# Accredited Seller duplicate identity validation fix — 2026-10-04

This patch tightens the In-House Network Excel member importer.

## Rules
- Duplicate email inside the same Excel file is a hard error.
- Exact duplicate full name inside the same Excel file is a hard error, even when emails differ.
- Full-name matching is case-insensitive and collapses repeated spaces.
- A new import row cannot use the exact full name of another Accredited Seller already in the target Network when the email is different.
- Updating the same existing seller (same email) is not treated as a name conflict.
- Existing employee/system account + seller identity sharing the same email remains supported.

Preview errors identify the conflicting Excel row number/email or the existing Network member.

No database migration is required.

## Validation
- Network member Excel import tests: 24/24 passed.
- Related runnable Network/commission tests: 28/28 passed.
- `networkMemberImport.service.js` passed `node --check`.
- `sellerGroupRedesign.test.js` still cannot load in the reconstructed environment because `bcrypt` is not installed; this is an environment dependency issue and occurs before assertions run.
