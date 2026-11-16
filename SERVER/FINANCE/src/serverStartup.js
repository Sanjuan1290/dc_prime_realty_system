export const readStartupTimeout = (value, fallback, name) => {
  if (!String(value ?? '').trim()) return fallback
  const timeout = Number(value)
  if (!Number.isSafeInteger(timeout) || timeout < 1 || timeout > 120_000) {
    throw new Error(`${name} must be an integer from 1 to 120000 milliseconds.`)
  }
  return timeout
}

// A driver connection timeout alone does not bound pool acquisition plus the
// initial query. Keep one deadline across both stages, and discard timed-out
// connections so an unfinished protocol operation cannot return to the pool.
export const checkStartupDatabase = async (pool, { timeoutMs = 30_000, initialize = async()=>{} } = {}) => {
  let connection
  let timedOut = false
  let discarded = false
  let stage = 'connection'
  let timer

  const check = (async () => {
    const acquired = await pool.getConnection()
    if (timedOut) {
      acquired.destroy()
      return
    }
    connection = acquired
    stage = 'query'
    await connection.query({ sql: 'SELECT 1', timeout: timeoutMs })
    stage = 'schema'
    await initialize(connection)
  })()

  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      const error = Object.assign(new Error('Database startup check exceeded its deadline.'), {
        code: 'DATABASE_STARTUP_TIMEOUT', stage,
      })
      reject(error)
    }, timeoutMs)
  })

  try {
    await Promise.race([check, deadline])
  } catch (error) {
    if (connection) {
      connection.destroy()
      discarded = true
    }
    error.stage ||= stage
    throw error
  } finally {
    clearTimeout(timer)
    if (connection && !discarded) connection.release()
  }
}
