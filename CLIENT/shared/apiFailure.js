import { getCloudflareChallengeError, getRenderStartupError, getRetryAfterSeconds } from './upstreamAvailability.js'

// Parsing an API/provider error never repeats the request or displays its HTML.
export const readApiFailure = async (response, service = 'API') => {
  const provider = getCloudflareChallengeError(response) || getRenderStartupError(response)
  if (provider) return provider
  const isJson = /application\/json/i.test(response.headers.get('content-type') || '')
  const data = isJson ? await response.json().catch(() => ({})) : {}
  if (!isJson) {
    const text = await response.text().catch(() => '')
    const challenge = getCloudflareChallengeError(response, text)
    if (challenge) return challenge
  }
  const code = data?.code || data?.error?.code
    || (response.status === 429 ? 'RATE_LIMITED' : response.status >= 500 ? 'SERVER_UNAVAILABLE' : 'REQUEST_FAILED')
  const fallbackDelay = code === 'API_ACCESS_BLOCKED' ? 0 : response.status === 429
    ? code === 'HR_LOGIN_RATE_LIMITED' ? 900 : code === 'RATE_LIMIT' ? 600 : 60
    : code === 'SERVER_WAKING_UP' ? 60 : response.status >= 500 ? 30 : 0
  const retryAfterSeconds = getRetryAfterSeconds(data?.retryAfterSeconds ?? data?.error?.retryAfterSeconds,
    getRetryAfterSeconds(response.headers.get('retry-after'), fallbackDelay))
  const fallbackMessage = response.status === 429 ? 'Too many sign-in requests. Please wait before trying again.'
    : response.status >= 500 ? `${service} is temporarily unavailable. Please try again shortly.`
      : `${service} request failed (${response.status}).`
  const candidate = data?.message || data?.error?.message
  const message = typeof candidate === 'string' && !/<\s*(?:!doctype|html|body|script)\b/i.test(candidate)
    ? candidate.slice(0, 500) : fallbackMessage
  return { code, message, retryAfterSeconds, data }
}
