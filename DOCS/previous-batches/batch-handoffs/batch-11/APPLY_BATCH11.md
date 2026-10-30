# Batch 11 — Apply to a development/staging Git branch

## Preconditions

- Apply the Batch 4–10 overlays first in sequence, including Batch 8's `financeActivitySqlFor` and salary source mode. Do NOT deploy this on top of the Oct 27 source alone if the prior overlays are absent.
- Keep the authoritative original Realty system unchanged until full staging verification.
- This overlay updates `server/` and `client/`, the folders still in service during the planned staged extraction. After Realty moves to `apps/realty-{client,server}`, merge these changes into the actual Realty-owned folders and review imports.
- Create a Git branch and review diffs. Make a complete backup before pushing code changes.

## Files to apply

- `server/services/companyFinanceExport.service.js` (new)
- `server/controllers/System/companyFinances.controller.js` (replace/merge)
- `server/package.json` (add `exceljs` and `jszip`)
- `server/.env.batch11.example` (reference ONLY)
- `server/tests/batch11FinanceExport.test.mjs` (new)
- `client/src/pages/System/CompanyFinances.jsx` (replace/merge)
- docs and contract

No SQL migration is needed for this batch. No schema or historical financial data changes.

## Staging setup

1. In your full Git checkout, merge files and run `npm install` from the actual repo/workspace root so that `server/package-lock.json` and the root lock are updated consistently. Commit the lockfile diff. Do NOT copy the old lockfile as if it contained the new dependencies.
2. Run the backend tests (including `server/tests/batch11FinanceExport.test.mjs`) and frontend build. Verify normal Realty workflows and company finance totals.
3. Verify report CSV's seven old columns are unchanged with no new query parameters.
4. Download Excel report, check Transactions/Summary/Metadata tabs, large rows, amount precision and text safety.
5. Keep `FINANCE_TRANSFER_ENABLED=false`; verify transfer requests return HTTP 409 with `FINANCE_EXPORT_TRANSFER_DISABLED` and that reports remain available.
6. Reconcile an explicit staging dataset through an approved cutoff and set `FINANCE_TRANSFER_ENABLED=true` and `FINANCE_TRANSFER_RECONCILED_THROUGH_DATE=YYYY-MM-DD` **staging only**.
7. Download CSV transfer ZIP; verify `transactions.csv` SHA-256 equals `manifest.json.transactions_sha256`, amount/count totals, exported IDs and source/period filters. Test overlapping dates and repeat export (source IDs stay stable).
8. Test transfer XLSX in the intended spreadsheet software, including cells starting `=`, `+`, `-`, `@` and CSV fullwidth variants. XLSX must have literal strings (not executable formulas).
9. Disable transfer again until Batch 13 importer has been tested and owner approval is documented. Batch 14 remains the independent Finance production-launch gate.

## Limitations

- Export snapshots do not include voided manual entries, reversal events or a full correction history; importing changed same IDs requires manual review.
- Current consolidated view omits actual payment receipt reference IDs and leaves `reference_id` blank rather than guessing.
- CSV transfer is shipped as ZIP plus manifest (no direct raw-file transfer endpoint) for empty-export checks and integrity metadata.
- The existing finance warning flag does not prove full reconciliation; the approved cutoff is a separate manual control.
- Package dependencies cannot be verified by source-only offline unit tests. A real installed staging build plus workbook open test is mandatory.
