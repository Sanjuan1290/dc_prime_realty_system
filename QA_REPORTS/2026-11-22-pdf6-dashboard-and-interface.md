# PDF 6: compact dashboard and interface cleanup

Implemented the six requests in `fix dc prime (6).pdf` after reading all pages and inspecting their screenshots. The current repository is the implementation source; the supplied code snapshot and SQL backup were not overwritten or restored.

| PDF page | Result |
| --- | --- |
| 1 | Finance Dashboard now has three monthly cards: available balance, actual money in and actual money out. It includes Transactions/Reports shortcuts and administrator-only Imports/Audit Logs shortcuts, plus empty-month and negative-balance notices. Detailed charts, custom date filters and PDF exports stay in Reports. Removed the “After payroll corrections” subtitle from the shared actual-totals card. |
| 2 | Removed 27 page/section header Refresh controls across Realty, HR and Finance, including Refresh history in Imports. Removed unused icons and handlers and adjusted filter layouts. Mutation-driven data updates and error recovery remain available. |
| 3 | Removed Salary Paid from the Realty Reports cash summary and Salary Paid (net of reversals) from Company Finances. Existing historical cash, balances and exports remain intact. |
| 4 | Removed the Breakdown column and its expansion controls from the shared Seller Performance Details table used by main and Lot Project reports. Seller/network filters, rankings, totals and pagination remain. Empty rows now span ten columns. |
| 5 | Removed the Financial analytics moved to Reports notice from the Lot Project dashboard. Quick navigation remains. |
| 6 | Removed Unit Status Mix, its pie-chart imports and its data mapping. Inventory Value Comparison now fills the row. |

The dashboard no longer fetches a transaction list it does not display. Role restrictions still come from the existing account permissions. No accounting calculation, payroll operation, production API behavior or database schema was changed.

## Verification

| Check | Result |
| --- | --- |
| `node tools/qa/check-project.mjs` | 1,904 unit tests passed across all five suites |
| `node tools/qa/check-project.mjs --build` | All four frontend builds passed |
| `node tools/qa/pdf6-browser.mjs` | 8 checks passed; one documented existing local Settings limitation |
| `node tools/qa/finance-actual-totals-browser.mjs` | 5 checks passed, including corrected amounts, historical periods and PDF output |
| `node tools/qa/finance-reports-browser.mjs` | 7 checks passed, including report filters, chart interactions, touch, keyboard, responsive layout and PDF export |
| `node tools/qa/pdf5-browser.mjs` | 7 checks passed, including invitations and account acceptance without a manual Refresh button |
| JSX button scan and `git diff --check` | No remaining page-header Refresh controls or whitespace errors |

Updated older test expectations that required the removed notice, duplicate chart, seller breakdown or manual refresh. Browser evidence and screenshots are retained under ignored `QA_REPORTS/evidence`, including `pdf6`, `finance-actual-totals`, `finance-reports` and `pdf5`.

Browser/API work used synthetic accounts and the verified disposable MySQL server on loopback port 13307. The Finance alert cases substituted a local report response; they did not change ledger entries. Existing Finance browser regressions create only synthetic QA transactions and invitations. No real email was sent.

The unchanged System Settings API returned 500 locally because it uses TiDB `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, which MySQL 8 does not parse. A parse-only `PREPARE` check confirmed `ER_PARSE_ERROR`; no ALTER was executed by that diagnostic. The Settings header was verified in its error state. This is recorded explicitly in the browser evidence rather than claimed as a successful Settings API check. No other server failures or uncaught browser exceptions were observed.

## Publishing

Changes are local and are not committed, pushed or deployed. Publish the existing Cloudflare Pages build from `CLIENT` using `npm run build:all`, output `dist`, to activate all interface changes. No Render deployment or database migration is required for this update. The supplied SQL backup and hosted records remain unchanged.
