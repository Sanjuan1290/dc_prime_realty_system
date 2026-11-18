# Finance filters, chart interactions, and responsive tables — 18 November 2026

Moved Type, Source, and Category into a single Transaction filters form alongside From, To, and Status. Apply filters updates the transaction query and resets pagination; Reset filters restores the current month through today. Changing Type clears a category that might no longer apply. Added a validated, parameterized source filter to the backend, using the same conditions for record counts and returned rows.

Reports retain their date controls and show all posted activity for that period. Removed the Breakdown filters panel and adjusted PDF wording to match.

All SVG report and dashboard charts now resize to their container instead of requiring horizontal scrolling. Hover, keyboard focus with arrow/Home/End keys, and touch reveal exact currency amounts and period/category details. The running-balance chart includes the opening balance as an inspectable point. Escape or tapping elsewhere dismisses the tooltip. Dashboard category meters also show their details on hover and focus.

Redesigned the cash-flow disclosure with an icon, description, period count, visible expand control, colored amounts, and a totals row. Cash-flow and category tables become stacked rows on narrow screens. Corrected the mobile sidebar's inherited full-screen height and kept navigation within its own horizontal scroll area.

## Validation

All checks used local code. Browser checks exercised the real production bundle and Finance API. Synthetic transactions were created only after verifying the disposable database's loopback port (`13307`) and workspace-owned datadir. No production records were changed.

- **1,893 unit tests passed**, including three new transaction-filter cases for combined filtering, pagination, all-source behavior, and invalid inputs. Existing financial report calculations remain covered.
- **Seven browser scenarios passed with no page errors:** real source/category queries and counts; moved controls; exact hover values; keyboard navigation; report and transaction layouts at 320, 390, 768, and 1440 pixels; dashboard interactions; real touch selection and dismissal; negative balances; long category names; daily/monthly/yearly buckets; an empty period; and PDF download validation.
- **All four application builds passed.**
- `git diff --check` passed.

The tests verify the existing report values and exact tooltip strings, including the opening and closing balances. PDF export produces a nonempty PDF from the responsive charts.

Commands:

```text
node tools/qa/check-project.mjs
node tools/qa/check-project.mjs --build
node tools/qa/finance-reports-browser.mjs
git diff --check
```

## Local evidence

- [Mobile report and expanded tables](evidence/finance-reports/report-390.png)
- [Desktop report](evidence/finance-reports/report-1440.png)
- [Mobile transaction filters](evidence/finance-reports/transactions-390.png)
- [Mobile dashboard](evidence/finance-reports/dashboard-mobile.png)
- [PDF export](evidence/finance-reports/finance-report.pdf)
- Browser results: `QA_REPORTS/evidence/finance-reports/results.json`
- Unit and build logs: `QA_REPORTS/evidence/`

Evidence screenshots contain synthetic QA figures. Generated evidence is retained locally and ignored by Git. Deploy the Finance frontend and backend together so the moved Source control has its required API support.
