# Batch 4 — Staging Deployment Matrix (Proposed; Not Deployed)

These are **planning defaults**, not verified DNS hostnames or deployed systems.

| App | Local dev UI/API | Owning DB | Staging status |
|---|---|---|---|
| Legacy client | http://localhost:5174 | Realty DB via legacy server | Exists in source, requires clean-checkout verification |
| Legacy server | http://localhost:5001 | `dc_prime_realty_system_db` | Exists in source, requires restore and deployment checks |
| website | http://localhost:5173 | None; public buyer forms call Realty API | Placeholder |
| realty-client | http://localhost:5174 | Realty API only | Placeholder |
| realty-server | http://localhost:5001 | `dc_prime_realty_system_db` | Placeholder |
| hr-client | http://localhost:5175 | HR API only | Placeholder |
| hr-server | http://localhost:5002 | `dc_prime_hr_db` | Placeholder |
| finance-client | http://localhost:5176 | Finance API only | Placeholder |
| finance-server | http://localhost:5003 | `dc_prime_finance_db` | Placeholder |

**Do not start a placeholder server or a second legacy server.** Ports listed for future app replacements overlap deliberately with the current legacy service; cutover happens only in later batches.

## Security rules for later batches

- Each API: separate identity store, credentials, JWT/session secret, restricted database user, migrations, and backups.
- Browser API: only documented CORS origins. Use host-only `HttpOnly`, `Secure` cookies where supported, and CSRF protection for cookie-authenticated changes.
- Production: no wildcard credentialed CORS, no broad `Domain` cookies. Verify reverse proxy and HTTPS configuration.
- HR scheduler and Realty penalty scheduler must never run in duplicate during extraction.
- HR signed receipts and Cloudinary webhooks require routing and file-access validation.
- A health response without DB checks proves only the HTTP process responds; validate DB connectivity separately.
- Database and Cloudinary settings require actual staging provider credentials; no secrets are included.

## Required evidence before staging is claimed ready

Record DNS and service names, TLS certificates, allowed origins, backend permissions, DB restore output, Cloudinary credentials/ownership, database grant checks, and the application version/commit that was deployed.
