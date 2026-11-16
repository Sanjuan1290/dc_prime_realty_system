# Finance imports, undo and interaction design

Implemented the updated request to remove manual category matching and provide import/undo controls. These source changes are local; no push or deployment was performed.

## Import behavior

- Removed the Match source categories section, approval form, mapping list and mapping API endpoints.
- The workflow is now choose file → review payments → confirm import.
- Category names and income/expense types come from the export file. Matching categories are reused, missing ones are created, and inactive ones are reactivated during confirmation, with audit records. No category or balance changes occur during preview.
- Existing imported payments remain duplicates and keep their original categories. Previously undone payments with an identical fingerprint are restored to their original ledger records. Changed fingerprints remain blocked for review.
- Existing mapping records are retained as historical data and are no longer used by the importer.

## Undo behavior

- Completed imports offer Undo import in history. A confirmation dialog first shows the payments to remove, payments shared with other active imports, and the exact balance change.
- Undo marks the batch undone and removes payments from the posted balance only when no other active import includes them. Shared payments remain until the last active import is undone. Source identities, original financial values and audit history are preserved.
- Re-uploading the same file restores its original payment records without adding another source identity.
- Import/undo operations use one transaction lock to prevent concurrent operations from double-counting or losing shared payments. Repeated undo requests are idempotent. A stale balance-impact review requires a fresh confirmation.
- Imported payments cannot be changed through manual transaction controls. Manual cash entries are unaffected by import undo.
- Reconciliation uses active payments and active import receipts. Fully undone imports reconcile to zero active imported payments.

## Design

The Imports page has a styled file drop area, selected-file state, three-step progress indicator, automatic-category notices, payment preview, exact confirmation totals and an import history with status badges and undo actions. Abandoned previews are excluded from completed import history.

Finance controls share consistent spacing, typography, hover/focus/disabled states, loading indicators, error/warning/success alerts, subtle transitions and reduced-motion support. Confirmation dialogs manage focus, Escape, background scrolling and cancellation. The same dialog/alert components are used by manual entries, voids, account invitations and password setup. Audit actions use readable labels. Mobile import history uses cards and the dialogs fit the viewport.

Screenshots and local test artifacts are in `QA_REPORTS/evidence/import-undo/`, including `imports-desktop.png`, `import-preview.png`, `undo-review.png`, `imports-mobile.png` and `undo-mobile.png`.

## Deployment

Deploy the updated **Finance API before the frontend**. Its bounded startup upgrade adds undo fields and enum values, extends category names to 200 characters, and initializes the import transaction lock. The upgrade is idempotent and preserves existing data. A database already upgraded does not require DDL privileges to start.

If the service account cannot apply schema changes, run `SERVER/FINANCE/migrations/08_import_undo.sql` once with an authorized database account before deployment. No live database was modified during this task.

## Verification

All database writes and browser mutations used the guarded disposable database on loopback port 13307. No real accounts, emails or external business records were used.

| Check | Result |
| --- | --- |
| Unit suites: Realty 1,745; Finance 74; HR backend 18; HR frontend 8; Website 9 | 1,854 passed |
| Website, Realty, HR and Finance production builds | All four passed |
| Automatic categories, undo, restoration, duplicate and partial overlap, concurrent operations, stale reviews, category limits/reactivation and reconciliation API scenarios | 8 passed |
| Import/undo browser scenarios, including cancellation, alerts, focus, mobile and reduced motion | 9 passed |
| Baseline API flows | 25 passed |
| Attendance API flows | 15 passed |
| Prior PDF feature API flows, adapted to automatic categories | 7 passed |
| Finance/attendance browser flows | 13 passed |
| PDF feature browser flows, including invitations and HR exports | 5 passed |
| HR/Finance startup, production TLS and readiness scenarios | 10 passed |
| Git whitespace check | Passed |

Reproduction: use `tools/qa/setup-local-db.mjs`, `tools/qa/serve-local.mjs`, then the API and browser scripts listed in `tools/qa/README.md`. Evidence directories and temporary database files are ignored by Git.
