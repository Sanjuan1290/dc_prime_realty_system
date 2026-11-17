# CSV-only Finance transfers — 16 November 2026

Implemented locally. No deployment accounts, production database records or production secrets were changed.

## Behavior

- Company Finances has one export action: **Export to Finance (CSV)**. The standard CSV report, Excel report, ZIP transfer and Excel transfer buttons were removed. Its API also rejects those older export modes.
- HR Payroll has **Export to Finance (CSV)** in its header. It opens a date-range dialog, with no format selector. Payroll summary and receipt file-export actions were removed from the Payroll workspace. Official receipt printing remains available.
- HR exports only released salary cash payments by actual release date. Drafts and unpaid payroll remain excluded.
- Finance accepts only the original verified `.csv` download. ZIP, Excel, unsigned CSV and renamed archives are refused by the API as well as the file picker.
- Files carry their metadata and an HMAC-SHA256 signature in the CSV. Changing amounts, descriptions, metadata, rows, checksums or the file encoding invalidates verification. A CSV can still be edited on a computer; Finance rejects the edited file.
- Duplicate detection, automatic categories, preview/confirmation, Undo import and restoration work with the CSV format. Previously committed ZIP/Excel history can still be reviewed and undone. Old uncommitted previews must be replaced with a new CSV.
- Current-month exports stop at today. HR reconciliation is required through today when the selected period ends in the future; past periods retain their exact reconciliation cutoff.

## Deployment

1. Set the **same** `FINANCE_TRANSFER_SIGNING_SECRET` value on the SYSTEM, HR and Finance Render services. A private random value has been generated in the Git-ignored local file:

   `QA_REPORTS/.runtime/finance-transfer-signing.env`

   Copy the value after `=` into each service's environment setting. It is a dedicated signing secret; do not use an authentication secret or expose it through a frontend variable. The value is deliberately absent from this report and Git.

2. Apply `SERVER/FINANCE/migrations/20261116_csv_transfers.sql` to **dc_prime_finance_db** if the Finance runtime account cannot alter tables. Finance otherwise applies the additive enum update during startup. The old format values remain so existing import history stays valid.
3. Deploy the three backends and the Cloudflare Pages frontend build. Set the signing secret before enabling the new download/import paths. A missing or mismatched secret prevents verification; there is no unsigned fallback. Normal authentication and health endpoints remain available.
4. Download a fresh CSV from Company Finances and HR Payroll, then preview each in Finance. Verify a changed copy is rejected and that a second import of the original is skipped. Use controlled test records when verifying import/undo in the deployed system.

The generated production setting differs from the dummy signing key used by the isolated QA services. Existing HR reconciliation requirements remain enforced; only QA fixtures receive synthetic reconciliation checkpoints during automated tests.

## Verification

All final checks passed on synthetic data in the guarded local MySQL instance. Production TiDB and email/deployment services were not accessed.

| Check | Passed |
| --- | ---: |
| Unit tests across all apps | 1,864 |
| Existing application API scenarios | 25 |
| CSV-specific API scenarios | 6 |
| Updated feature API scenarios | 7 |
| Import/undo API scenarios | 8 |
| CSV-specific browser scenarios | 3 |
| Updated feature browser scenarios | 5 |
| Import/undo browser scenarios | 9 |
| Application builds | 4 |

HR runtime isolation, HR frontend isolation, SYSTEM local imports and Git whitespace checks also passed. Browser checks use the actual builds and local APIs; desktop/mobile layouts, native dialog focus/Escape, signed downloads, tampered-file alerts, original-file previews, imports, duplicates, undo and restoration were exercised. No uncaught browser errors occurred.

Evidence: `QA_REPORTS/evidence/csv-only-results.json`, `csv-finance/browser-results.json`, `import-undo/browser-results.json`, `pdf-features/results.json`, and `csv-*.log`. Screenshots and downloaded synthetic files are under `QA_REPORTS/evidence/csv-finance/`.

To reproduce, start the QA-owned database, reset it with `node tools/qa/setup-local-db.mjs --reset`, then start `node tools/qa/serve-local.mjs`. Run API scenarios in this order because they share financial fixtures:

```powershell
node tools/qa/check-project.mjs
node tools/qa/check-project.mjs --build
node --test tools/qa/api.e2e.test.mjs
node --test tools/qa/csv-finance.e2e.test.mjs
node --test tools/qa/pdf-features.e2e.test.mjs
node --test tools/qa/import-undo.e2e.test.mjs
node tools/qa/csv-finance-browser.mjs
node tools/qa/pdf-features-browser.mjs
node tools/qa/import-undo-browser.mjs
```
