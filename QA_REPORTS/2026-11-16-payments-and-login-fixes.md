# Payments, login recovery and SOA interest — 16 November 2026

The new PDF requests were implemented after the user confirmed their scope. These changes are prepared locally; this session has not published them or changed production records or deployment secrets.

## Result

- Clicking Void opens the correct owner or Accounting Head authorization dialog. The missing `actorRole` reference caused the Payments tab crash. Existing password, email and correction authorization requirements remain in force.
- A reservation payment leaves First Due Date editable. Downpayment and installment payments lock it; cancelled and rejected payments do not. Other contract terms remain locked after a recorded payment.
- Changing First Due Date on a reservation-only account updates the existing installment dates in one transaction. Payment amounts, allocation links, schedule IDs and financial values are preserved. Inconsistent schedules return an error instead of replacing paid rows.
- The SOA form and unit information display the effective buyer-specific annual interest rate. An 11.5% reservation override is preserved when saving terms or penalty settings, even when the inventory listing default is 0%. Edit Listing explains that separate default.
- Finance and HR have show/hide password buttons, a Forgot password email form, and a reset form opened by an emailed link. SYSTEM already has these controls.
- Reset links expire after 20 minutes, replace previous links, and can be used once. Only token hashes are stored. Completed resets revoke existing sessions and preserve account roles. Disabled identities cannot receive reset links. Request responses do not disclose whether an account exists.

## Verification

All checks passed using synthetic accounts and a guarded MySQL instance at `127.0.0.1:13307`. Production records were not accessed or modified.

| Check | Result |
| --- | --- |
| SYSTEM unit tests | 1,748 passed |
| Finance unit tests | 77 passed |
| HR backend unit tests | 21 passed |
| HR frontend unit tests | 8 passed |
| Website unit tests | 9 passed |
| SOA API scenarios | 2 passed |
| Password recovery API scenarios | 3 passed |
| Payments/SOA browser scenarios | 6 passed |
| Finance/HR recovery browser scenarios | 4 passed |
| All four application builds | Passed |
| HR runtime isolation and SYSTEM local imports | Passed |

The SOA scenarios cover both reservation fee treatments, retained allocations, invalid dates, structural-term restrictions, downpayment locks, cancellation, and unchanged interest amounts. The first scheduled monthly interest at 11.5% matches the independent expected amounts: PHP 7,570.83 on PHP 790,000 financed principal, and PHP 8,050.00 on PHP 840,000.

Recovery scenarios cover expiry, replacement, concurrent use, password confirmation, session revocation, disabled users, cross-service token rejection and malformed input. Browser checks cover password visibility, email error messages, private-link navigation in an already open tab, password changes and subsequent login. Desktop and mobile layouts were inspected. Browser page errors: zero.

Provider calls were captured or stubbed. Delivery to a real email inbox is not verified because deployment email credentials were not available.

Evidence is saved locally under `QA_REPORTS/evidence/payments-login-results.json`, `payments-soa/`, `password-recovery/`, `soa-terms-api.log`, and `password-recovery-api.log`.

## Deployment steps

1. In the **HR database** (`dc_prime_hr_db`), apply `SERVER/HR/migrations/20261116_password_recovery.sql` using migration credentials. HR runtime schema changes remain prohibited by its isolation guard. A missing reset table affects recovery only; it does not stop the HR server from starting.
2. In the **Finance database** (`dc_prime_finance_db`), apply `SERVER/FINANCE/migrations/20261116_password_recovery.sql` if the runtime account lacks permission to create the new table. Finance initializes it automatically when permitted, and skips DDL once it exists.
3. Configure the email settings separately on each Render service. Use a valid Resend key and verified sender. Existing Finance invitation settings can be reused for Finance recovery. Never put these secrets into frontend variables.

   Finance:

   ```dotenv
   RESEND_API_KEY=<Finance service email key>
   EMAIL_FROM=<verified sender>
   FINANCE_PUBLIC_URL=https://dc-prime-realty.pages.dev/finance
   ```

   HR:

   ```dotenv
   RESEND_API_KEY=<HR service email key>
   EMAIL_FROM=<verified sender>
   HR_PUBLIC_URL=https://dc-prime-realty.pages.dev/hr/login
   ```

4. Deploy the SYSTEM, HR and Finance backend changes and the Cloudflare Pages build containing the SYSTEM, HR and Finance frontend changes.
5. Verify a reset email reaches a controlled test account in each deployed application. Open each email link, change its password, and verify that its previous sessions are rejected. Verify Void opens the authorization dialog and that a reservation-only account can save First Due Date. Do not void an actual payment just to check that the dialog opens.

## Reproduce locally

Start the guarded disposable database, run `tools/qa/setup-local-db.mjs --reset`, then run `tools/qa/serve-local.mjs`. Resetting is restricted to the QA-owned instance. Run these from the repository root:

```powershell
node tools/qa/check-project.mjs
node tools/qa/check-project.mjs --build
node --test tools/qa/soa-terms.e2e.test.mjs
node --test tools/qa/password-recovery.e2e.test.mjs
node tools/qa/password-recovery-browser.mjs
node tools/qa/payments-soa-browser.mjs
node SERVER/HR/scripts/check-isolation.mjs
node SERVER/SYSTEM/scripts/check-local-imports.mjs
```

The password recovery API scenarios prepare fresh single-use synthetic links for the browser scenarios; run them immediately before the recovery browser script.
