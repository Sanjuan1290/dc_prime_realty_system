# D&C Prime Realty

Four live applications share this repository. HR and Finance operate against their own databases and accounts. Production operation is the default; the previous staging/cutover approval flags no longer control startup or editing.

| Application | Frontend | Backend | Database |
| --- | --- | --- | --- |
| Website | CLIENT/WEBSITE | Optional SERVER/WEBSITE static host | None |
| Realty | CLIENT/SYSTEM | SERVER/SYSTEM | dc_prime_realty_system_db |
| HR & Payroll | CLIENT/HR | SERVER/HR | dc_prime_hr_db |
| Finance | CLIENT/FINANCE | SERVER/FINANCE | dc_prime_finance_db |

## Hosted layout

Cloudflare Pages builds all four frontends from **CLIENT**, using **npm run build:all**, output **dist**. Website is at /, Realty at /system, HR at /hr, and Finance at /finance. Pages Functions proxy APIs using these server-side environment variables:

| Variable | Render origin |
| --- | --- |
| SYSTEM_API_ORIGIN | https://dc-prime-realty-system.onrender.com |
| HR_API_ORIGIN | https://dc-prime-realty-hr.onrender.com |
| FINANCE_API_ORIGIN | https://dc-prime-realty-finance.onrender.com |

Each Render Web Service uses its SERVER app directory as its root, **npm install** to build, **npm start** to run, and **/api/v1/health** for readiness. Services bind 0.0.0.0:$PORT before checking the database. An unready database produces HTTP 503 and a bounded startup failure instead of a silent port timeout. Node.js 22+ is supported.

Set production secrets in provider settings, never in VITE variables or Git. Retain verified TiDB TLS and separate database credentials. See [HR settings](SERVER/HR/README.md) and [Finance settings](SERVER/FINANCE/README.md). The Website is static on Pages and requires no Render API service.

## Live HR and Finance operations

- HR employee/attendance editing, payroll generation, finalization and release use existing role permissions. HR_READ_ONLY=true explicitly pauses writes; VITE_HR_READ_ONLY=true optionally matches that state in the frontend.
- Payroll exports include released cash payments only, by actual release date. HR and Company Finances produce compatible ZIP/Excel transfer files. Finance handles file categories automatically and uses a preview plus atomic commit; repeated payments are skipped. Imports can be undone with an audit trail and restored by uploading the file again. Changed fingerprints require review.
- Company Finances retains actual balance/source consistency warnings. Exporting to Finance is enabled when those checks pass, without deployment approval flags. The historical salary-source setting remains explicit to preserve financial history.
- Finance invitations email a random temporary password, expire after 24 hours, and require password replacement before any Finance data is available. Configure Resend on the Finance service.
- HR audit history is available to HR administrators and payroll managers. Signed receipt uploads still require a separate secured-storage implementation; finalized receipt print/export is available to permissioned users.

## Local development and checks

Install each app's dependencies with npm ci in its directory. Run the frontend and backend scripts from [package.json](package.json). Defaults: Vite Website 5173, Realty 5174, HR 5175, Finance 5177; APIs Realty 5001, HR 5102, Finance 5103.

For verification without loading private .env files, use **node tools/qa/check-project.mjs** and **node tools/qa/check-project.mjs --build**. End-to-end tests use only a guarded disposable database on loopback port 13307; see [QA instructions](tools/qa/README.md).

The fresh-start schemas under DATABASES/FRESH_START are for new empty databases, not upgrades of existing live databases. The invitation columns, import undo support and new HR permissions have additive startup upgrades and separately reviewable SQL migrations. Existing business data and passwords are preserved.

See [implementation and release evidence](QA_REPORTS/2026-11-16-pdf-features-live-operation.md) for the current change's tests and publication status. Historical batch documents describe earlier states and are not active deployment gates.
