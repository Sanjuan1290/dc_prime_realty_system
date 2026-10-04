# Role & Access Control — Optional Label Removal

Date: 2026-10-04

Changes:
- Removed the visible `Optional` chip from the Role & Access Control legend.
- Removed the visible `OPTIONAL` status line under editable permission items.
- Renamed `Select All Optional` to `Select All`.
- Renamed `Clear Optional` to `Clear All`.
- Changed `Optional permissions may be adjusted below.` to `Permissions may be adjusted below.`
- Permission behavior is unchanged: editable permissions remain selectable; Required, Inherited, and Not Allowed states remain visible and enforced.

Validation:
- Targeted RBAC/UI regression tests: 9/9 passing.
- No database migration required.
