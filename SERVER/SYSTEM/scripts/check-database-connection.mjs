// Read-only diagnosis: no HTTP entrypoint, scheduler, migrations or business queries.
import 'dotenv/config'
import { db } from '../db/connect.js'
import { checkStartupDatabase, readStartupTimeout } from '../services/serverStartup.service.js'

const timeoutMs = readStartupTimeout(process.env.DATABASE_STARTUP_TIMEOUT_MS, 30_000, 'DATABASE_STARTUP_TIMEOUT_MS')
const started = Date.now()
try {
  await checkStartupDatabase(db, { timeoutMs })
  console.log(JSON.stringify({ status: 'PASS', check: 'database SELECT 1', elapsedMs: Date.now() - started }))
  await db.end()
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', code: error.code || error.name, stage: error.stage, timeoutMs, elapsedMs: Date.now() - started }))
  // A timed-out acquisition may still hold a driver socket. Do not wait for it.
  process.exit(1)
}
