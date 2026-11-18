# Full Payment settlement checks — 18 November 2026

Implemented the user-approved rule: calculate Full Payment as of its selected payment date, exclude unpaid future scheduled interest, include remaining principal and separate payable LMF once, and collect already-due interest or penalties only after an authorized account-rule review. Noncollectible due charges and future interest become explicit settlement adjustments, never cash allocations.

The preview and backend validation use the same settlement calculator. Posting persists and applies that quote, including its per-row adjustments. Cash receipts, audit metadata, and operational reviews preserve the breakdown and authorization. Corrections bind the charge decisions to the governed correction payload. Replaying history preserves legacy Full Payments whose settlement record is NULL.

Connected fixes:

- Reopening an account preserves the stored schedule amounts instead of regenerating interest removed at settlement. Canonical receivables remain zero after successful Full Payment.
- Edits and voids restore excluded interest before replaying allocations. Ordinary corrections before an existing settlement preserve the later receipt.
- Duplicate request lookups use a current locking read, preventing concurrent retries from inserting a second receipt.
- The Payments & SOA card shows `Includes ₱[amount] in unpaid scheduled interest.` using unpaid interest on active rows, separately from total scheduled interest.
- Full Payment requires a server quote, preserves a zero result, blocks unresolved charges and stale previews, and retains input focus while updating charge decisions.

## Validation

All checks passed against local code. API tests used synthetic accounts and the guarded QA MySQL instance at `127.0.0.1:13307`, whose datadir was verified inside this workspace. No live database or deployment was changed.

| Check | Result |
| --- | --- |
| All unit suites | 1,876 passed: System 1,753; Finance 78; HR 27; HR client 9; Website 9 |
| Full Payment API scenarios | 12 passed |
| Existing SOA date/terms API scenarios | 2 passed |
| Existing API regression suites | 55 passed across payments, reports, Finance, import undo, and payroll workflows |
| Payments & SOA browser checks | 12 passed; no page errors |
| Production builds | System, Finance, HR, Website passed |
| Whitespace check | `git diff --check` passed |

The Full Payment API cases cover posting, reopening the account, exact cash allocations, edit previews with rollback, authorized date edits, void restoration, included/separate LMF, incorrect amount rejection, collectible and noncollectible charges, Accounting Staff/Head approval, complete and partial balloons, partial future interest already paid, duplicate/concurrent requests, backdated chronology review, legacy Full Payment preservation, and downpayment discount credits.

Commands:

```text
node tools/qa/check-project.mjs
node tools/qa/check-project.mjs --build
node tools/qa/run-pdf3-api-checks.mjs
node --test tools/qa/full-payment.e2e.test.mjs tools/qa/soa-terms.e2e.test.mjs
node tools/qa/payments-soa-browser.mjs
git diff --check
```

API evidence: `QA_REPORTS/evidence/full-payment-api.log` and `pdf3-api-results.json`. Browser evidence and screenshots: `QA_REPORTS/evidence/payments-soa/`. Unit/build logs: `QA_REPORTS/evidence/`.

## Deployment requirement

Apply `SERVER/SYSTEM/migrations/20261118_full_payment_settlements.sql` before deploying. Without it, Full Payment is blocked with a migration review message. Existing payment types remain available.

Account-specific charge collectibility remains an Accounting decision with a recorded basis. The referenced [Republic Act No. 6552](https://elibrary.judiciary.gov.ph/thebookshelf/showdocs/2/1688) does not replace reviewing the applicable account rules. No universal collectibility assumption was hardcoded.
