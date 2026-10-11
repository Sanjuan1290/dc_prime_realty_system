# D&C Prime Realty — full available source / TiDB Review Center fixes (2026-10-11)

## What caused the production failure

The live API returned `ON condition doesn't support subqueries yet`. The notification filter in `server/services/internalNotification.service.js` joined `audit_cases` using `(SELECT MAX(...))` inside a JOIN `ON`. TiDB rejects this pattern. The query was reused by `GET /workflow/summary`, `GET /workflow/notifications`, and notification cleanup on review transitions.

## Changed runtime source files

- `server/services/internalNotification.service.js`: latest audit case resolved through a grouped derived table and two ordinary joins. No JOIN-ON subquery.
- `server/controllers/Lot_Projects/Listings/Listings.controller.js`: same TiDB-safe pattern in the legacy buyer-profile fallback.
- `server/controllers/System/workflow.controller.js`: previous optional counter resilience plus non-sensitive server logs, so a failed notification counter doesn't take down the entire queue.
- `server/services/workflowSummaryNotifications.service.js`: fail-isolated notification counts.
- `client/src/pages/System/ReviewCenter.jsx`: display a dash for unavailable counts rather than incorrectly displaying zero.
- `client/src/components/System/sellerGroupComponents/NetworkMemberImportHistoryModal.jsx`: explicitly mark the manually confirmed Undo Import request as `confirmationHandled: 'compact'`, allowing the API to receive it.

## Regression tests updated / added

- `server/tests/tiDBJoinCompatibility20261011.test.js` — new targeted TiDB tests.
- `server/tests/workflowSummaryResilience20261010.test.js` — preserved counter fallback tests.
- `server/tests/reviewVisibilityNetworkCleanup20261006.test.js`
- `server/tests/reviewNotificationAssignmentUi20261006.test.js`
- `server/tests/approvalAuditBatch4Integration20261004.test.js` — corrected a stale test assumption after record navigation moved to a shared helper.

## Verification

- 610 JS/JSX/TS source files parsed with TypeScript's parser: 0 syntax errors.
- Relative imports resolved against the reconstructed tree before omitting the 23 unavailable binary media assets.
- 46 focused regression tests passed.
- Full extracted test suite: **892 passed, 14 failed** out of 906. The 14 failures were test startup failures caused by missing npm dependencies in this offline environment (`jsonwebtoken`, `bcrypt`, `dotenv`, etc.). This is NOT a statement that a dependency-installed test run would pass. No live TiDB connection was available.
- No new DB migration required for this fix. All existing migrations are retained unchanged.

## Source/media completeness

The original input was the `AllCodes(4).txt` text export. It contains the full available text source (737 entries), but 23 binary image/video files appear **only as remote URLs**, not actual files. They are intentionally omitted from the ZIP. See `MEDIA_FROM_TEXT_EXPORT.md`. For an exact binary-identical repository release, obtain a ZIP or git checkout of the original repo. This package preserves the rest of the source tree, its migrations/tests, and a reference copy of the supplied SQL backup (reference only; DO NOT execute it as a migration).

## Install safely

1. **Make a backup** of the current Git repository and the live TiDB database.
2. If you already have the repository and media, prefer merging the **small targeted patch ZIP** over copying the reconstructed complete source tree. This avoids replacing any real asset.
3. If restoring a new copy from this source export, restore media from the original project using `_delivery/restore_media_assets.py --restore` on a computer with Internet before production build.
4. Install server and client dependencies using the existing lockfiles (`npm ci` in `server` and `client`).
5. Run server tests: `cd server && npm test`. Run client build: `cd client && npm run build`. Investigate failures instead of deploying blindly.
6. Deploy backend to Render first, then frontend to Cloudflare Pages.
7. Test the authenticated `GET /api/v1/workflow/summary` and `GET /api/v1/workflow/notifications?limit=100` with Super Admin, Auditor, and every Department Head/Staff role. Verify status 200, correct role-specific counts, and notification cleanup after a review transition.
8. Check Render logs for `[workflow/summary]` if any count is still unavailable. The error can differ from the fixed TiDB syntax error.

**Do not** run database resets, `TRUNCATE`, the supplied backup SQL, or database-migration scripts as part of this specific repair.

## Security

An earlier Network panel screenshot included a session cookie. Revoke that session / rotate account session auth before further debugging; don't share raw JWT values in reports.
