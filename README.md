# Lot Project Dashboard / Reports split

This patch performs the requested UI split for `/portal/lot-projects/:projectSlug`.

- The previous analytics-heavy `Dashboard.jsx` is preserved as `Reports.jsx`.
- A new operational `Dashboard.jsx` shows current unit status, attention items, upcoming dues, recent unit issues, and quick navigation.
- Adds `/portal/lot-projects/:projectSlug/reports`.
- Adds **Reports** to the Lot Project sidebar directly after Dashboard.
- Reuses `LOT_DASHBOARD_VIEW`; no database migration or backend route is required.
- Updates regression tests that were intentionally coupled to the previous Dashboard analytics page.

Apply the files over the matching repository paths, then run the normal client build and server test suite.

Validation: the focused source/regression checks for this split passed. One unrelated test could not execute from the reconstructed all-in-one source dump because a shared backend module is truncated in that dump; no failure was produced by the Dashboard/Reports changes.
