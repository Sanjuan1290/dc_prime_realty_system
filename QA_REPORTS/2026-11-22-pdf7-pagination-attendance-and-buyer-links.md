# PDF 7: pagination, attendance and buyer links

Implemented the requests in `fix dc prime (7).pdf` after reading all eight pages and inspecting their screenshots. Pages 1 and 5 repeat the Import History request.

| PDF page | Result |
| --- | --- |
| 1, 5 | Import history always shows its record range, current/total pages, Previous/Next and 10/20/50-row selection, including a single page or empty history. The API accepts a bounded page size and resolves requests beyond the results to the last available page. |
| 2 | HR audit Module and Action inputs are now native dropdowns. Options come from all stored audit values, including values outside the current page. Filtering sends the original stored codes and returns to page 1. Added Reset and the common pagination controls. |
| 3 | HR Employee Salary has pagination for the complete filtered register. Summary cards still total every filtered payroll record; department options, salary actions and exports are preserved. |
| 4 | Finance Audit Logs and Users show the common pagination controls. User search/role/status filters apply before pagination. Removing the last invitations on a page moves to a valid remaining page. Audit counts and page sizes come from the API. |
| 6 | Removed the Excel rules panel and its temporary overrides from HR and the legacy Realty attendance export. The workbook uses the fresh saved Attendance Settings returned by the export API. Date-range selection, Rest Days, validation and download remain. |
| 7 | Company-event Edit/Remove buttons stack within the calendar side panel, have flexible height and non-shrinking icons, and keep their labels inside their bounds at mobile, tablet and desktop widths. Applied to HR and the legacy Realty view. |
| 8 | Added actual Cloudflare Pages handlers for `/buyer-form` and `/buyer-form/*`. Existing links temporarily redirect to `/system/buyer-form/*`, preserving tokens and query parameters. The Realty SPA handles direct loads and refreshes; the Website SPA no longer takes those URLs. |

Imports and audit histories use API pagination. Finance Users and HR payroll paginate their existing complete result arrays; API contracts and full-register payroll calculations remain unchanged. HR's source-isolation check explicitly permits the shared presentation-only pagination component and CSS. No cross-application data access was added.

The buyer-link defect was the missing combined-site route: generated/shared links used `/buyer-form/...`, while the Realty router runs under `/system`. Existing links are repaired by the redirect, including links previously copied or emailed. Token verification, expiry, supersession, unit availability and submission rules remain enforced by the existing API.

## Verification

| Check | Result |
| --- | --- |
| `node tools/qa/check-project.mjs` | 1,914 unit tests passed across five suites |
| `node tools/qa/check-project.mjs --build` | All four frontend builds passed |
| `node --test tools/qa/pdf7-pagination.e2e.test.mjs` | 6 API cases passed |
| `node tools/qa/pdf7-browser.mjs` | 10 browser scenarios passed, without uncaught errors or server failures |
| `node tools/qa/pdf5-browser.mjs` | 7 Finance report, invitation, acceptance/deletion and audit regressions passed |
| `node tools/qa/pdf6-browser.mjs` | 8 previous-interface checks passed, retaining its documented local Settings limitation |
| `git diff --check` | Passed |

New routing unit cases check legacy tokens, query preservation, encoded paths, the buyer-form root, and Realty asset selection. API cases cover invalid sizes before SQL, default limits, stable ordering, correct counts, empty/last pages, authenticated access, dropdown metadata, all payroll totals and valid/expired/invalid buyer links. Native page-size and filter changes, deleting a final page, and payroll totals across pages are verified in actual production bundles.

The export test downloads and reads the XLSX file after setting synthetic HR attendance settings to 09:30–18:30. It verifies the scheduled-in/out cells, then restores the original settings. Test employees have dated Rest Days and a present attendance record; export safeguards were preserved. Layout evidence covers 320, 390, 768, 1024 and 1440 pixels where relevant. Anonymous form checks use real synthetic valid/expired tokens and verify a direct reload without an account.

All database work used the verified disposable server on loopback port 13307, separate credentials and synthetic accounts. No real email, hosted service, production record, supplied PDF or backup was changed. Screenshots, downloaded workbooks and browser results are in ignored `QA_REPORTS/evidence/pdf7`. The PDF 6 regression still records the pre-existing local MySQL/TiDB Settings DDL incompatibility; the new PDF 7 scenarios had no such failures.

## Publishing

Changes are local and are not committed, pushed or deployed. Deploy the HR and Finance Render APIs first, preserving their existing secrets, then publish the combined Cloudflare Pages build from `CLIENT` using `npm run build:all`, output `dist`. Pages must include the new buyer-form Functions. A Render SYSTEM deployment and database migration are not required for these changes. Existing buyer links work once the Pages routing update is published.
