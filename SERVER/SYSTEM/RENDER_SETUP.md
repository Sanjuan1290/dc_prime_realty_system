# SYSTEM API on Render

Use root directory `SERVER/SYSTEM`, build command `npm install`, start command `npm start`, and health check path `/api/v1/health`. The HTTP server binds to `0.0.0.0` and Render's `PORT` environment variable. The local fallback is port 5001.

Render's requirements are documented at [port binding](https://render.com/docs/web-services#port-binding).

## Database environment

Copy the connection values from the intended TiDB database's connection dialog into Render's Environment settings:

| Variable | Value |
| --- | --- |
| `TIDB_HOST` | TiDB hostname, without `https://` or an appended port |
| `TIDB_PORT` | TiDB connection port, commonly 4000 |
| `TIDB_USERNAME` | The SYSTEM database's authorized username |
| `TIDB_PASSWORD` | That user's password |
| `TIDB_DATABASE` | `dc_prime_realty_system_db`, or the explicitly approved SYSTEM staging database |
| `TIDB_SSL` | `true` for the hosted TiDB connection |
| `JWT_SECRET` | The existing strong SYSTEM session-signing secret |
| `CORS_ORIGIN` | The authorized frontend origin, including `https://dc-prime-realty.pages.dev` |

Optional timeout overrides have these defaults:

```text
TIDB_CONNECT_TIMEOUT_MS=10000
DATABASE_STARTUP_TIMEOUT_MS=30000
```

The overall startup deadline includes acquiring a pooled connection and completing `SELECT 1`. Both timeout values must be positive integer milliseconds, at most 120000. Values are configurable for a measured startup requirement; incorrect credentials or blocked database network access still need correction.

## Startup and health

1. The HTTP port opens and logs `Server running on 0.0.0.0:<port>`.
2. `/api/v1/live` returns `200` immediately to identify a running process.
3. `/api/v1/health` and business API routes return `503` while the database startup check is pending.
4. After a successful database check, the server logs `TiDB connected`, health becomes `200`, and the daily penalty scheduler starts.
5. A failed or stalled check logs its error code and `connection` or `query` stage, then exits with code 1. It cannot wait indefinitely before exposing an HTTP port.

Keep Render's deployment health check on `/api/v1/health`. It confirms that the initial database check completed successfully. `/api/v1/live` is a process diagnostic endpoint.

These startup changes need a Render SYSTEM backend redeployment. No database migration or dependency upgrade is required.

## Diagnose a failed database check

The startup log intentionally omits passwords, connection strings and raw driver errors. Use the error code to guide the next check:

| Code | Check |
| --- | --- |
| `ER_ACCESS_DENIED_ERROR` | TiDB username/password and that user's access |
| `ER_BAD_DB_ERROR` | The configured database name and whether that database exists |
| `ENOTFOUND`, `EAI_AGAIN` | Hostname and DNS resolution |
| `ETIMEDOUT`, `ECONNREFUSED`, `DATABASE_STARTUP_TIMEOUT` | Host/port, TiDB service availability and network access from Render |
| TLS/certificate-related code | TiDB TLS configuration and certificate validation |

For a read-only diagnosis from an environment with the service's connection variables, run:

```text
npm run check:db
```

This executes only the bounded `SELECT 1` probe and does not start HTTP handlers, jobs, migrations or financial updates. A successful check on a developer's computer confirms that computer's settings and network path; verify the values and network access used by Render separately.
