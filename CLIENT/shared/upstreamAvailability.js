const DEFAULT_STARTUP_RETRY_SECONDS = 60

export const getRetryAfterSeconds = (value, fallback = 0) => {
  const text = String(value ?? '').trim()
  if (!text) return fallback
  const seconds = /^\d+(?:\.\d+)?$/.test(text)
    ? Number(text)
    : Math.ceil((Date.parse(text) - Date.now()) / 1000)
  return Number.isFinite(seconds) && seconds > 0
    ? Math.min(Math.ceil(seconds), 3600)
    : fallback
}

export const getRenderStartupError = (response) => {
  if (response.status !== 429
    || response.headers.get('x-render-routing') !== 'hibernate-rate-limited') return null
  const code = 'SERVER_WAKING_UP'
  const message = 'The API server is waking up. Please wait before trying again.'
  return {
    code, message,
    retryAfterSeconds: getRetryAfterSeconds(response.headers.get('retry-after'), DEFAULT_STARTUP_RETRY_SECONDS),
    error: { code, message }, // Finance uses a nested error; SYSTEM and HR use the top-level fields.
  }
}

export const normalizeUpstreamAvailability = async (response) => {
  const error = getRenderStartupError(response)
  if (!error) return response
  await response.body?.cancel()
  return new Response(JSON.stringify(error), {
    status: 503,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'Retry-After': String(error.retryAfterSeconds),
    },
  })
}
