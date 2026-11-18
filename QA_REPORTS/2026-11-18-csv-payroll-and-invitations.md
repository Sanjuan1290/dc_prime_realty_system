# CSV transfer, payroll wording, and Finance invitations — 18 November 2026

## Completed changes

- Removed the main-system `Record income or expense in Finance` shortcut while keeping the CSV export.
- Configured the same dedicated random CSV signing key in all three local backend `.env` files. The private deployment setting is in the Git-ignored `.env.finance-transfer.local`; its value was not printed or committed. The read-only `tools/qa/check-finance-csv-config.mjs` verifies matching local keys and exercises both producers against the Finance parser without opening a database connection.
- Replaced the payroll undo explanation with plain wording. The date label is now `Undo date`. Removed the checkbox, its request field, and the corresponding server requirement. The form still requires a reason, valid date, administrator password, and email code. Undo history, original receipts, immutable Finance reversal events, and rate limits remain enforced.
- Finance invitation failures now distinguish testing-sender restrictions, unverified domains, rejected email keys, sending limits, and timeouts. Responses contain a safe explanation and error code, without provider bodies, API keys, or temporary passwords. Pending accounts can be invited again after fixing the cause.

The payroll explanation now reads:

> This moves the salary back to Draft so you can edit and recalculate it. The old approval and receipt stay in history. Export a Finance CSV covering the payment date and undo date to update Finance. No money is moved.

The last two sentences appear for released payroll only.

## Export and import validation

Real application entrypoints, real browser downloads, and guarded disposable databases were used. All database writes targeted the QA-owned MySQL instance at `127.0.0.1:13307`, after verifying its datadir within this workspace. No live business records were changed and no invitation or verification email was sent to a real recipient.

The main-system property case created three verified cash payments through the actual payment API: `50,000.00`, `176,933.33`, and `176,933.33`. The exported CSV retained all three source IDs and totaled exactly `403,866.66`. Finance imported three new records for that exact amount. The test requests page 99 to confirm that display pagination does not truncate the export.

The HR path exported actual immutable released-salary events and imported the original CSV into Finance. Exporting the same HR salary through the main system was recognized as a duplicate. Altered amounts, forged checksums, unsigned files, and unsupported formats were rejected.

Browser checks downloaded both files through their real screens, uploaded them in Finance, and completed confirmation. Existing payments were skipped with an import receipt and no extra balance change. Balance deltas were compared against the committed income and expense totals. The test follows the current `Record Import Receipt` flow when every row is already imported.

The payroll suite verified undo without the removed checkbox, administrator and code checks, invalid/expired/stale codes, reversal dates, history and receipt retention, original/reversal CSV exports, duplicate handling, ordered re-release, Finance undo, and rollback. Invitation integration checks verified that a provider restriction leaves an account pending, and a simulated successful resend replaces its password hash and records delivery without returning credentials.

| Check | Result |
| --- | --- |
| Unit suites | 1,890 passed: System 1,757; Finance 88; HR 27; HR client 9; Website 9 |
| Baseline API suite | 25 passed |
| CSV export/import API suite | 7 passed |
| Payroll undo and connected Finance API suite | 19 passed |
| Finance invitation integration checks | 2 passed |
| CSV browser checks | 3 passed; no page errors |
| Payroll and connected browser checks | 9 passed; no page errors |
| Application builds | System, HR, Finance, Website passed |
| Local signing-key round trips | SYSTEM → Finance and HR → Finance passed |
| Whitespace | `git diff --check` passed |

Evidence is retained locally under `QA_REPORTS/evidence/`: `pdf3-api.log`, `pdf3-csv-finance.log`, `payroll-undo-simplified-api.log`, `finance-invitations-api.log`, `csv-finance/browser-results.json`, and `pdf4-browser/browser-results.json`, with browser screenshots and unit/build logs.

## Invitation finding and deployment settings

The local Finance sender uses Resend's `resend.dev` testing domain. The user confirmed that the failed invitation's recipient differs from the address registered with Resend. This fits Resend's documented restriction: the testing sender is limited to the registered address; sending to other recipients requires a verified sending domain. See [Resend's error reference](https://resend.com/docs/api-reference/errors).

A read-only domain-list request returned `restricted_api_key`: this key can send email but cannot inspect domain settings. That response does not establish that the sending key is invalid. The failed live email's provider log was not available, so the sender restriction is a likely explanation rather than a verified production rejection. No domain, recipient, or email setting was changed after the user's clarification.

To clear the live CSV configuration error, set the same `FINANCE_TRANSFER_SIGNING_SECRET` on the SYSTEM, HR, and Finance backend services in Render, then restart or redeploy those services. The prepared private local setting can be copied from `.env.finance-transfer.local`. Git-ignored local `.env` files are not deployed by a repository push or frontend rebuild. Hosted Render environment settings were not changed from this session.
