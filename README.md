# Mobile Attendance / Browser Storage Resilience Fix

This patch addresses the mobile `/attendance` crash where a browser can deny access to `window.localStorage`.

## What changed

1. `/attendance` now boots as a standalone public entry path from `main.jsx`. Direct visits do not load `App.jsx` or the portal/website route graph first.
2. Added `client/src/utils/safeStorage.js`; reading the `localStorage`/`sessionStorage` property itself is inside `try/catch`.
3. Hardened public website preference/tripping persistence and print-preview payload writes so denied browser storage degrades gracefully instead of throwing.
4. Added a regression test for standalone Attendance boot and safe-storage behavior.

## Validation

Run:

```powershell
cd client
npm run build

cd ../server
npm test
```

No database migration is required.
