# API sign-in outage — 14 November 2026

The deployed API returned a Render startup throttle. A later check confirmed recovery without a deployment:

| Request | Initial observation | Recheck |
| --- | --- | --- |
| `/api/v1/system-status` | `429`, plain text `Too Many Requests`, `x-render-routing: hibernate-rate-limited` | `200`, `status: active` |
| `/api/v1/health` | Timed out after 20 seconds | `200`, `API is healthy` |
| `/api/v1/user/me` without cookies | Timed out after 20 seconds | `401 NOT_AUTHENTICATED`, expected without signing in |

The provider routing header identifies the observed throttle as a Render startup response. The repository's application login limiter returns a different JSON code, `LOGIN_RATE_LIMITED`, and only applies to login POST requests. The public system-status GET route has no application rate limiter.

[Render documents](https://render.com/docs/free#spinning-down-on-idle) that free web services sleep after 15 idle minutes and take approximately a minute to spin up. This fits the observed startup response and subsequent recovery. Service logs and account configuration have not been inspected: the Render integration is not connected.

## Local fix

- Both the combined and standalone Pages proxies translate the specific Render startup response into a non-cacheable JSON `503 SERVER_WAKING_UP` response with `Retry-After`. Genuine application login limits retain their original status, body and retry period.
- SYSTEM handles both normalized startup responses and the raw provider response. Other non-JSON `429` responses produce a clear rate-limit message instead of an API-down or HTML error.
- Background status/session checks on the sign-in page no longer navigate away from the form or repeat when the browser tab regains focus.
- Sign-in keeps entered credentials, disables additional submissions during the retry countdown, and lets the user retry afterward. A failed login is never automatically replayed.
- Login rate limits, authentication rules and business APIs remain enforced.

The fix is **local and not deployed**. Publishing the updated CLIENT source and Pages Functions through the existing Cloudflare Pages build will activate it. No backend deployment or database migration is required for these code changes. The handling improves recovery; it does not change Render's hosting plan or prevent idle spin-down.

## Verification

- Six new proxy and retry-policy unit tests passed.
- All 1,728 SYSTEM tests passed, including existing authentication and mutation-safety checks.
- All four frontend builds passed.
- Six production-bundle browser scenarios passed: initial startup, startup during login, genuine login throttling, non-JSON throttling, session-service failure and HTML gateway failure. Entered email/password remained intact, background focus did not add requests, and passwords were submitted again only after an explicit user action.
- The browser test used only a temporary loopback server and synthetic credentials; it did not access real accounts or databases.
- Public live checks used GET requests without cookies or credentials. No real sign-in, data modification, service restart or hosting upgrade was performed.

[Browser evidence](evidence/startup-recovery/results.json) and [latest public API checks](evidence/live-api-diagnostics.json) are retained locally and ignored by Git. See [QA commands](../tools/qa/README.md).
