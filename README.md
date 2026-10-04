# Employee + Accredited Seller Import Fix — 2026-10-04

This patch fixes Network member Excel import when the email already belongs to an employee/internal system account.

## New behavior
- Existing employee/system account is preserved; role, permissions, login and employee record are not overwritten.
- A separate seller identity is created for Network hierarchy/commission use when necessary.
- The seller identity is non-login when the same email is already owned by an active system login, avoiding active-email uniqueness conflicts.
- If a seller-role user already exists but has no `accredited_sellers` row, the importer attaches seller accreditation instead of rejecting the account.
- A system account and its seller identity may share the same email without triggering the old duplicate-account error.
- External Network accounts and protected system-generated accounts remain blocked.
- Matching employee rows with no `linked_user_id` are linked safely without replacing an existing link.

## Tests
- Network/import/commission regression set: 35/35 passing.
- Network member Excel import file: 20/20 passing.
- Changed server files pass `node --check`.

No database migration is required.
