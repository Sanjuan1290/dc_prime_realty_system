# Finance gross activity and actual totals

The user requested removal of the Closing balance card, clarification of payroll undo entries in Money in/out, and actual totals after corrections. They selected separate actual money-in and money-out figures for the new card.

## Result

- Removed the Closing balance summary card from Dashboard, Reports and report PDF.
- Added Actual totals with money in and money out after matched payroll corrections.
- Labelled gross income/expenses, charts and tables to explain the retained undo history. Repeated imports count a source payment once.
- Preserved net cash change, opening/closing balance calculations, historical posting dates, imported records, audit history, running balance charts and gross category totals.

The user's screenshot is reproduced with synthetic source payments:

| Figure | Amount |
| --- | ---: |
| Gross money in | ₱411,329.16 |
| Gross money out | ₱14,925.00 |
| Net cash change | ₱396,404.16 |
| Actual money in | ₱403,866.66 |
| Actual money out | ₱7,462.50 |

The extra income/expense entries are a payroll release and its matching reversal. They offset each other in the net. Actual totals remove both and retain the later unreversed release. This is separate from duplicate file import prevention, which already preserves one ledger entry per source payment.

## Calculation and date rules

Matching requires a posted HR reversal with an even source event version and its exact preceding posted release, equal centavo amounts, and a release date no later than the reversal. A historical Realty identity must have a receipt proving external HR origin before it qualifies. Multiple receipts use an existence check rather than multiplying joined rows. The original release and reversal IDs are distinct before aggregation.

All matching uses only reversals through the selected end date. Earlier reports retain the salary until its reversal date. Actual totals count unreversed entries dated in the selected period. If a correction crosses the start date, actual in minus actual out can differ from net cash change; the UI explains this. Gross summaries and actual totals are account-wide even when an API caller filters the chart breakdown.

Amounts use integer centavos. A single SQL statement computes matched corrections and gross activity from the same database view. `/finance/dashboard` and `/finance/reports` share the calculation. Closing balance remains opening balance plus gross net change; a zero opening balance explains its equality with net change in the screenshot.

## Verification

All writes used synthetic accounts on the guarded local MySQL 8.0.41 database, port 13307. No production data or private email configuration was changed. No emails were sent.

| Check | Result |
| --- | --- |
| `node tools/qa/check-project.mjs` | 1,901 unit tests passed |
| `node --test tools/qa/pdf4-workflows.e2e.test.mjs` | 21 passed |
| `node --test tools/qa/finance-actual-totals.e2e.test.mjs` | 10 passed |
| `node tools/qa/finance-actual-totals-browser.mjs` | 5 checks passed |
| `node tools/qa/finance-reports-browser.mjs` | 7 checks passed |
| `node tools/qa/pdf5-browser.mjs` | 7 checks passed |
| `node tools/qa/check-project.mjs --build` | All four frontend builds passed |
| `git diff --check` | Passed |

Coverage includes actual payroll undo/recalculation/re-release, HR/System CSV export and Finance import, correction-only imports, multiple correction cycles, a changed salary amount, duplicate files committed repeatedly, the same salary exported by both producers, import undo/restoration, genuine income with the same category/amount, independent legacy payroll, proven legacy HR origin, equal-value salaries for different employees, historical cutoffs, cross-period corrections and empty periods. High-precision unit cases preserve centavos above floating-point precision.

Browser checks use the actual Finance build and API, verify the screenshot's gross and actual amounts, and inspect both Dashboard and Reports at 320, 390, 768 and 1440 pixels. Gross chart hover/keyboard/touch behavior and cash flow tables remain functional. PDF text includes the exact actual amounts and correction explanation; its first page was rendered and visually reviewed. Prior import-detail, invitation deletion, stale acceptance and audit checks also passed.

Ignored evidence: `QA_REPORTS/evidence/finance-actual-totals/`, `finance-reports/`, `pdf5/`, `finance-actual-totals.log` and `actual-totals-payroll.log`. The disposable QA schemas were reset before the original payroll workflow suite. An initial new-test helper called the native Fetch `ok` property as a function; correcting that helper yielded all 10 passing integration tests without application changes.

## Applying the change

Deploy the Finance backend and frontend together. No schema migration is required. Hosted TiDB execution was not exercised; verification used the isolated MySQL engine. No production deployment was performed.
