# HR and Finance startup recovery — 16 November 2026

Both deployed health endpoints recovered during this investigation, before these local changes were deployed:

| Endpoint | Initial probe | Later probe |
| --- | --- | --- |
| `/hr-api/api/v1/health` | `429`, Cloudflare HTML challenge page | `200`, HR `status: ok` |
| `/finance-api/api/v1/health` | `503 SERVER_WAKING_UP`, retry after 60 seconds | `200`, Finance `ok: true` |

The initial unauthenticated `/auth/me` probes returned the same respective provider failures. Both documented direct Render health URLs timed out at 20 seconds. The challenge response identifies what this diagnostic request received; it does not establish whether the challenge originated at the Pages edge or an upstream provider, or whether every user experienced the same challenge.

The latest successful health responses identify both intended backend services. Real account sign-in was not attempted, so a successful health check does not verify an individual account or password. No credentials shown in the supplied screenshots were used.

## Local changes

- HR now binds its HTTP port before database initialization and applies an overall deadline covering connection acquisition and the initial query. Its health and business routes stay at `503` until ready. Attendance/outbox jobs remain behind readiness and their existing enable flags.
- Finance now binds explicitly to `0.0.0.0:$PORT`, runs a bounded startup probe and exposes readiness. Its health route no longer launches an unbounded query on every request.
- Each backend has its startup helper inside its own deployment directory. There is no dependency on another backend's files, credentials or database.
- Both login screens retain entered passwords for startup, rate-limit and gateway failures, display retry countdowns, and block extra submissions during the retry interval. They never automatically submit a password again. HR still clears the password after a genuine `401` credential rejection.
- HR's login session query does not refetch when its tab regains focus. Finance displays initial session-service failures instead of silently discarding them, and its requests have a timeout.
- Both clients understand flat and nested API errors, raw provider throttles and safe gateway messages. Cloudflare security challenges receive an explicit access-blocked message rather than a promise that the server is waking up.
- Actual HR and Finance login throttles advertise their remaining retry interval. The existing attempt limits remain in place.
- HR's source-isolation checker permits and checks only the two named pure provider-error utilities outside HR source. Other cross-application imports remain forbidden.

## Validation

- All 1,842 unit/regression tests passed, including 1,742 SYSTEM, 65 Finance, 18 HR backend, 8 HR frontend and 9 Website tests.
- Eight real-entrypoint startup scenarios passed across HR and Finance: stalled acquisition, stalled query, healthy readiness, and rejection of unapproved production startup for each service.
- Fourteen browser scenarios passed against the production HR/Finance bundles and the real local Pages proxy: initial startup, startup during login, genuine login limits, non-JSON limits, session outage, HTML gateway error and security challenge for each app.
- The existing SYSTEM startup browser checks were also run as regression coverage for the shared proxy.
- All four frontend builds passed. HR runtime isolation and SYSTEM local-import checks passed.

Tests used local sockets, synthetic database pools and synthetic credentials. They did not access real account records, run live jobs, invoke business-write endpoints or alter hosting/security settings.

## Deploy the changes

Commit and deploy the updated source to these existing services:

| Service | Root/build/start | Health check |
| --- | --- | --- |
| HR backend | `SERVER/HR` / `npm install` / `npm start` | `/api/v1/health` |
| Finance backend | `SERVER/FINANCE` / `npm install` / `npm start` | `/api/v1/health` |
| Combined Pages frontend/functions | `CLIENT` / `npm run build:all` / output `dist` | Existing Pages configuration |

The previous SYSTEM backend deployment does not deploy these independent HR and Finance services. These changes are local, uncommitted and not deployed.

Keep the existing authorized database credentials, TLS, authentication and feature controls. [HR setup](../SERVER/HR/README.md) and [Finance setup](../SERVER/FINANCE/README.md) list the relevant variables and mode guards. HR remains staging-only; Finance production remains explicitly gated. Neither service's production or financial-operation permissions were enabled by this fix.

If a service remains unavailable after deployment, inspect its Render startup log. Database failures now report `DATABASE_STARTUP_TIMEOUT` or the driver's code, plus the connection/query stage. Configuration guards can also reject a deployment before it opens a port. The requested HR/Finance logs were not supplied during this run, and this session has no connected Render administration tools, so those account settings were not inspected or changed.

If an HTML security challenge recurs on an API request, review the request's Cloudflare security event and the applicable proxy/upstream configuration. [Cloudflare documents](https://developers.cloudflare.com/cloudflare-challenges/challenge-types/challenge-pages/#compatibility-limitations) that interstitial challenge pages are incompatible with ordinary API fetch responses. The client now distinguishes that condition from server startup; no security rule was bypassed or disabled.

Local evidence, ignored by Git: [startup scenarios](evidence/hr-finance-startup-results.json), [browser scenarios](evidence/hr-finance-recovery/results.json), [initial API probe](evidence/live-api-hr-finance.json), and [successful health recheck](evidence/live-api-hr-finance-health.json).
