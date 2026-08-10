import { consumeDoubleCheckToken, requestDoubleCheck } from './doubleCheck'

const DEFAULT_API_BASE_URL = '/api/v1'
const DEFAULT_TIMEOUT_MS = 75_000
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])
const CONFIRMATION_POLICIES = new Set(['compact', 'technical'])

const TECHNICAL_MUTATION_PATTERNS = [
  /\/user\/(?:login|logout|change-password)$/i,
  /\/user\/forgot-password(?:\/|$)/i,
  /\/upload-signature(?:\/|$)/i,
  /\/payments\/preview$/i,
  /\/purge-code$/i,
  /\/audit-logs\/archive\/request$/i,
]

const normalizeBaseUrl = (value) =>
  String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '')

const normalizePath = (value) => {
  const path = String(value || '').trim()
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
}

const normalizePathWithoutQuery = (value) => normalizePath(value).split('?')[0].replace(/\/+$/, '') || '/'

const parseRequestBody = (body) => {
  if (body == null || body === '') return null
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    const result = {}
    body.forEach((value, key) => {
      const normalized = typeof File !== 'undefined' && value instanceof File
        ? { name: value.name, size: value.size, type: value.type }
        : value
      if (Object.prototype.hasOwnProperty.call(result, key)) {
        result[key] = Array.isArray(result[key]) ? [...result[key], normalized] : [result[key], normalized]
      } else {
        result[key] = normalized
      }
    })
    return result
  }
  if (typeof body === 'string') {
    try { return JSON.parse(body) } catch { return body }
  }
  return body
}

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', data = null, cause = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = Number(status || 0)
    this.code = String(code || '')
    this.data = data
    this.cause = cause
  }
}

export const isAuthenticationError = (error) => Number(error?.status || 0) === 401
export const isMaintenanceError = (error) => error?.code === 'MAINTENANCE_MODE'
export const isServerUnavailableError = (error) =>
  error?.code === 'SERVER_UNAVAILABLE'
  || error?.code === 'REQUEST_TIMEOUT'
  || [502, 504].includes(Number(error?.status || 0))
  || (Number(error?.status || 0) === 503 && !error?.code)

const redirectToAvailabilityPage = (target, state = {}) => {
  if (typeof window === 'undefined') return
  if (window.location.pathname === target) return
  try {
    window.sessionStorage.setItem('dc_prime_availability_state', JSON.stringify({ ...state, savedAt: Date.now() }))
  } catch {
    // Navigation still works when browser storage is unavailable.
  }
  window.location.replace(target)
}

const parseResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json().catch(() => ({}))
  const text = await response.text().catch(() => '')
  return text ? { message: text } : null
}

const requireMutationConfirmation = async ({ normalizedPath, method, body, doubleCheck, confirmationHandled, confirmationToken }) => {
  if (!MUTATING_METHODS.has(method)) return

  if (confirmationToken) {
    if (!consumeDoubleCheckToken(confirmationToken)) {
      throw new ApiError('The Final Double-Check confirmation expired. Review the action again.', {
        status: 409,
        code: 'DOUBLE_CHECK_TOKEN_INVALID',
      })
    }
    return
  }

  if (doubleCheck) {
    const result = await requestDoubleCheck({
      ...doubleCheck,
      method,
      path: normalizedPath,
      data: doubleCheck.data ?? parseRequestBody(body),
    })
    if (!result.confirmed) {
      throw new ApiError('Review cancelled — you can continue editing. Nothing was saved.', {
        status: 499,
        code: 'REVIEW_CANCELLED',
      })
    }
    if (result.token) consumeDoubleCheckToken(result.token)
    return
  }

  const policy = String(confirmationHandled || '')
  if (!CONFIRMATION_POLICIES.has(policy)) {
    throw new ApiError('This action is missing an explicit confirmation policy.', {
      status: 409,
      code: 'MUTATION_CONFIRMATION_REQUIRED',
      data: { path: normalizedPath, method },
    })
  }

  if (policy === 'technical' && !TECHNICAL_MUTATION_PATTERNS.some((pattern) => pattern.test(normalizedPath))) {
    throw new ApiError('This mutation is not approved as a technical no-review operation.', {
      status: 409,
      code: 'TECHNICAL_MUTATION_NOT_ALLOWED',
      data: { path: normalizedPath, method },
    })
  }
}

export const requestApi = async (
  path,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    redirectOnUnavailable = true,
    headers,
    doubleCheck = null,
    confirmationHandled = '',
    confirmationToken = '',
    ...options
  } = {}
) => {
  const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL)
  const normalizedPath = normalizePath(path)
  const mutationPath = normalizePathWithoutQuery(path)
  const url = `${apiBaseUrl}${normalizedPath}`
  const method = String(options.method || 'GET').toUpperCase()
  let controller = null
  let timeoutId = null

  try {
    await requireMutationConfirmation({
      normalizedPath: mutationPath,
      method,
      body: options.body,
      doubleCheck,
      confirmationHandled,
      confirmationToken,
    })

    controller = new AbortController()
    const setTimer = typeof window !== 'undefined' ? window.setTimeout.bind(window) : setTimeout
    timeoutId = setTimer(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body && !(typeof FormData !== 'undefined' && options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
        ...(headers || {}),
      },
      signal: controller.signal,
    })

    const data = await parseResponseBody(response)
    if (!response.ok) {
      const error = new ApiError(data?.message || `Request failed with status ${response.status}.`, {
        status: response.status,
        code: data?.code || '',
        data,
      })
      if (redirectOnUnavailable && isMaintenanceError(error)) {
        redirectToAvailabilityPage('/maintenance', { message: error.message })
      } else if (redirectOnUnavailable && isServerUnavailableError(error)) {
        redirectToAvailabilityPage('/server-down', { message: error.message })
      }
      throw error
    }
    return data
  } catch (error) {
    if (error instanceof ApiError) throw error
    const apiError = error?.name === 'AbortError'
      ? new ApiError('The server took too long to respond.', { code: 'REQUEST_TIMEOUT', cause: error })
      : new ApiError('The server could not be reached.', { code: 'SERVER_UNAVAILABLE', cause: error })
    if (redirectOnUnavailable) redirectToAvailabilityPage('/server-down', { message: apiError.message })
    throw apiError
  } finally {
    if (timeoutId) {
      const clearTimer = typeof window !== 'undefined' ? window.clearTimeout.bind(window) : clearTimeout
      clearTimer(timeoutId)
    }
  }
}

