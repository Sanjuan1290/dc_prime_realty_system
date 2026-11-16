# PDF features and live-operation fixes — November 16, 2026

Implemented the five requests in `C:\Users\Robert\Downloads\fix dc prime.pdf`, then removed obsolete staging/cutover gates. The source and local production builds are ready. These changes have **not been published**. Render is still reported as not installed/connected in this session; Cloudflare deployment access is also unavailable.

## Delivered behavior

| Request | Result |
| --- | --- |
| Export HR salaries into Finance | Payroll provides ZIP and Excel exports of released payments, selected by actual release date. The server matches each payment to its immutable salary release event, checks exact amounts and records the export in the HR audit log. |
| HR & Payroll audit logs | A permissioned page lists employee, attendance and payroll events, with actor, Manila timestamp, filters, pagination and details. HR administrators/payroll managers receive the new permission through an idempotent additive upgrade. |
| Finance account creation by email | Admins enter name/email/role only. The server generates a random temporary password, emails it through Resend and stores only its scrypt hash. It expires in 24 hours. The API blocks Finance data until the owner chooses a different password. Resend revokes earlier temporary access; delivery failures remain visible and retryable. |
| Explain category mapping | Imports explain the mapping with a Salary → Payroll example, show each source application and approved rule, and distinguish new, duplicate, unmapped and changed payments. A preview never changes balances. |
| Company Finances exports and compatible imports | Existing report exports remain available; clearly labelled Export to Finance ZIP/Excel actions now use actual consistency checks instead of deployment approval flags. Both actual download formats were imported through the real Finance API. |
| Improve every Finance page | Consistent navigation, page descriptions, roles, loading/error/success states, account invitation states, import steps, readable amounts and responsive layouts. Older responses cannot overwrite a newer date/filter request. |

## Financial integrity and compatibility

HR salary and external Company Finances salary exports now use the same source identity and fingerprint. Their totals use integer centavos. An older external HR salary already imported under the Realty namespace is recognized only when a committed receipt proves that provenance; importing it again adds no expense. Historical Realty payroll with a coincidentally equal numeric ID remains separate. Existing ledger values are not rewritten.

Imports retain checksum validation, bounded ZIP/Excel parsing, formula protection, category/type checks, immutable imported rows, preview expiry and transactionally rechecked commits. The Excel reader now accepts legitimate empty directory entries written by ExcelJS while retaining decompression limits and workbook restrictions.

The Company Finances salary-source selection and genuine cash/source warnings remain intact. This change does not silently migrate historical salary balances, fabricate reconciliation, change finalized payroll or turn draft payroll into paid cash. Signed receipt uploads remain a separate storage feature; finalized receipt printing/export is enabled through the new permissions.

## Live defaults and deployment configuration

- HR supports `NODE_ENV=production`, requires verified TiDB TLS and a long JWT secret, and enables permissioned writes by default. `HR_READ_ONLY=true` deliberately pauses writes. Obsolete `HR_STAGING_ONLY`, `HR_ENABLE_WRITES` and `HR_ALLOW_PAYROLL_RELEASE` no longer gate live work.
- The HR production frontend enables writes, payroll release and the authenticated kiosk by default. `VITE_HR_READ_ONLY=true` and `VITE_HR_KIOSK_ENABLED=false` are explicit overrides. Existing PIN/station signing requirements remain enforced.
- HR attendance jobs start after readiness unless explicitly disabled. Salary delivery runs only with its endpoint/token configured and is independently pausable. Releasing payroll still creates its event when manual export is used instead of automatic delivery.
- Finance supports production with its independent database and verified TLS. Obsolete staging/production/import approval flags are ignored. `FINANCE_READ_ONLY=true` and `FINANCE_IMPORTS_READ_ONLY=true` provide explicit operational pauses.
- Finance startup adds missing invitation columns without changing current passwords. HR startup adds only the new role permissions. Both upgrades run within the startup deadline. Manual equivalents are in `SERVER/FINANCE/migrations/07_user_invitations.sql` and `SERVER/HR/migrations/20261116_live_reports.sql`.
- Configure `RESEND_API_KEY`, verified `EMAIL_FROM`, and `FINANCE_PUBLIC_URL=https://dc-prime-realty.pages.dev/finance` on **the Finance Render service**. Realty's email environment is not inherited. Actual provider delivery has not been tested; local checks capture email in memory.
- Render service roots remain `SERVER/SYSTEM`, `SERVER/HR`, `SERVER/FINANCE`; build `npm install`, start `npm start`, health `/api/v1/health`. Pages root remains `CLIENT`, build `npm run build:all`, output `dist`. Its three API origin variables must target the corresponding services. Deploy backends before the new Pages build so the invitation columns/routes exist when the UI arrives.

No production database writes, real-account logins, real emails, pushes or deployments were performed in this task. Production secrets were not printed or copied into source.

## API security/wake-up investigation

Live GET checks reproduced intermittent JSON `API_ACCESS_BLOCKED` responses from the existing Pages proxy while other services were healthy. At one point HR and Finance health both returned 200; the latest all-service sample returned Realty health/status/session 503 with `API_ACCESS_BLOCKED`, HR health 503 with that code and session 503 with `SERVER_WAKING_UP`, and Finance health 200/session 401 as expected without authentication. A single healthy response does not prove recovery from the intermittent failure.

The blocked response is produced when Pages receives a Cloudflare challenge from its upstream. A challenge is distinct from Render's `hibernate-rate-limited` wake-up response. Cloudflare documents the [`cf-mitigated: challenge` signal](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/detect-response/) and the [different client-IP behavior of Worker subrequests](https://developers.cloudflare.com/fundamentals/reference/http-headers/). These support the diagnosis of a provider challenge; they do not establish which provider rule fired.

The new HR/Finance clients share a health readiness check before authentication. Only health GET requests retry within a bounded deadline; authentication submissions never replay automatically. Pages now forwards application headers and identifies its own server request instead of replaying browser security/forwarding metadata. Provider challenge errors include the upstream reference when available. These changes reduce startup races and improve diagnostics; their effect on the hosted challenge is **not yet verified**. They cannot override a hosting security policy. If the challenge recurs after publishing, inspect hosting/security events with that reference and apply the narrow provider-side correction needed for these API requests. No blanket security bypass or paid hosting upgrade was applied.

## Verification

All application tests use synthetic credentials and a guarded disposable MySQL instance under this workspace on loopback port 13307. Private `.env` files are excluded. This is not a TiDB production migration rehearsal.

| Check | Result |
| --- | --- |
| Unit suites: Realty 1,745; Finance 69; HR backend 18; HR frontend 8; Website 9 | 1,849 passed |
| Production builds: Website, Realty, HR, Finance | All four passed |
| Baseline application API flows | 25 passed |
| Attendance API flows, including invalid dates/times and exports | 15 passed |
| PDF API flows: invitations, enforced password change, expiry/resend, audit access, HR exports, old salary compatibility, actual Company Finances ZIP/Excel imports | 7 passed |
| HR/Finance startup: stalled connection/query, readiness, production startup, required TLS | 10 passed |
| PDF browser flows: invitation form, owner password setup, desktop/mobile Imports, HR audit, both salary download formats | 5 passed |
| Finance/attendance browser flows: cash posting/correction/void, viewer access, reconciliation, live attendance, kiosk, Excel and payroll | 13 passed |
| HR/Finance browser recovery scenarios | 14 passed |
| Realty browser recovery scenarios | 6 passed |
| HR runtime isolation and Git whitespace checks | Passed |

Evidence and screenshots are in the ignored `QA_REPORTS/evidence` directory. Reproduction steps are in `tools/qa/README.md`. Publication and a post-deployment smoke test remain pending connected deployment access.
