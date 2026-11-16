# Render startup timeout — 16 November 2026

The supplied failed deployment built successfully, passed the JavaScript import check and started `node server.js`, but never logged `TiDB connected` or opened an HTTP port. It eventually failed Render's port scan and health check.

In the checked-out commit `fd973ff2`, `startServer()` awaited `db.query('SELECT 1')` before calling `app.listen()`. That startup order can produce this failure when the database operation stalls. The host and port selection already used `0.0.0.0` and `PORT`.

## Fix

- Bind the HTTP port before the database startup probe.
- Keep `/api/v1/health` at `503` until that probe succeeds. Business API routes also return `503` while initialization is pending, and background jobs start only after database readiness.
- Provide `/api/v1/live` for immediate process liveness.
- Apply a 30-second overall deadline covering connection acquisition and `SELECT 1`, plus an explicit 10-second driver connection timeout. Optional environment variables can override these within bounded limits.
- Destroy failed or timed-out acquired connections and destroy connections arriving after the deadline. Exit with code 1 on startup failure, logging only an actionable code and stage instead of credentials or raw connection details.
- Add the read-only `npm run check:db` command and [Render setup/troubleshooting instructions](../SERVER/SYSTEM/RENDER_SETUP.md).

This corrects startup ordering and indefinite waiting. A Render-specific database credential, TLS or network problem must still be resolved if the bounded check fails there. The changes are local and have not been committed, pushed or deployed.

## Validation

- Seven startup-probe unit tests passed: successful release, connection timeout, late connection disposal, query timeout, connection errors, query errors and configuration validation.
- Three real-entrypoint integration scenarios passed. With a local stalled MySQL handshake or a simulated stalled query, the server exposed its HTTP port, returned liveness `200`, readiness/login `503`, and exited with `DATABASE_STARTUP_TIMEOUT`. With a healthy synthetic connection, readiness changed from `503` to `200` and unauthenticated access still returned `401`.
- The full project unit suites passed, including all 1,735 SYSTEM tests.
- A separate read-only check against the locally configured TiDB database completed `SELECT 1` successfully in approximately 3.1 seconds. It did not start application services or background jobs. This does not verify Render's environment variables or network path.
- Test service processes used synthetic credentials, local network endpoints and isolated working directories. No business records were changed.

The JavaScript import checker includes the new startup helper and diagnostic script. See the final command output for its updated source-file count.

Generated integration evidence is in [server-startup-results.json](evidence/server-startup-results.json). It is retained locally and ignored by Git.

## Deployment

Deploy the updated SYSTEM backend from `SERVER/SYSTEM`, preserving the existing authorized credentials and health check path `/api/v1/health`. Confirm that `Server running ...` appears before `Checking TiDB connection ...`, followed by `TiDB connected`. If the check fails, the new error code/stage provides the next diagnostic step listed in the Render setup document.

Render service logs and settings cannot be inspected directly in this session because its integration is not installed. The supplied deployment log and local reproductions are the evidence for this fix. No Render service, environment, billing plan or database access rule was changed.
