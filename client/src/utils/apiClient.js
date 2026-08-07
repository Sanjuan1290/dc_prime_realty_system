import { buildMutationReviewRequest, requestMutationReview, shouldReviewMutation } from './mutationReview'

const DEFAULT_API_BASE_URL = '/api/v1'
const DEFAULT_TIMEOUT_MS = 75_000

const normalizeBaseUrl = (value) =>
  String(value || DEFAULT_API_BASE_URL).trim().replace(/\/+$/, '')

const normalizePath = (value) => {
  const path = String(value || '').trim()
  if (!path) return ''
  return path.startsWith('/') ? path : `/${path}`
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

export const isAuthenticationError = (error) =>
  Number(error?.status || 0) === 401

export const isMaintenanceError = (error) =>
  error?.code === 'MAINTENANCE_MODE'

export const isServerUnavailableError = (error) =>
  error?.code === 'SERVER_UNAVAILABLE'
  || error?.code === 'REQUEST_TIMEOUT'
  || [502, 504].includes(Number(error?.status || 0))
  || (Number(error?.status || 0) === 503 && !error?.code)

const redirectToAvailabilityPage = (target, state = {}) => {
  if (typeof window === 'undefined') return
  if (window.location.pathname === target) return

  try {
    window.sessionStorage.setItem(
      'dc_prime_availability_state',
      JSON.stringify({ ...state, savedAt: Date.now() })
    )
  } catch {
    // Navigation still works when browser storage is unavailable.
  }

  window.location.replace(target)
}

const parseResponseBody = async (response) => {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return response.json().catch(() => ({}))
  }

  const text = await response.text().catch(() => '')
  return text ? { message: text } : null
}

export const requestApi = async (
  path,
  {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    redirectOnUnavailable = true,
    headers,
    skipReview = false,
    review = null,
    ...options
  } = {}
) => {
  const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_URL)
  const normalizedPath = normalizePath(path)
  const url = `${apiBaseUrl}${normalizedPath}`
  const method = String(options.method || 'GET').toUpperCase()
  let controller = null
  let timeoutId = null

  try {
    if (shouldReviewMutation(normalizedPath, method, { skipReview })) {
      const confirmed = await requestMutationReview(buildMutationReviewRequest({
        path: normalizedPath,
        method,
        body: options.body,
        review,
      }))

      if (!confirmed) {
        throw new ApiError('Review cancelled — you can continue editing. Nothing was saved.', {
          status: 499,
          code: 'REVIEW_CANCELLED',
        })
      }
    }

    controller = new AbortController()
    timeoutId = window.setTimeout(() => controller.abort(), timeoutMs)

    const response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        ...(options.body
          && !(typeof FormData !== 'undefined' && options.body instanceof FormData)
          ? { 'Content-Type': 'application/json' }
          : {}),
        ...(headers || {}),
      },
      signal: controller.signal,
    })

    const data = await parseResponseBody(response)

    if (!response.ok) {
      const error = new ApiError(
        data?.message || `Request failed with status ${response.status}.`,
        {
          status: response.status,
          code: data?.code || '',
          data,
        }
      )

      if (redirectOnUnavailable && isMaintenanceError(error)) {
        redirectToAvailabilityPage('/maintenance', {
          message: error.message,
        })
      } else if (redirectOnUnavailable && isServerUnavailableError(error)) {
        redirectToAvailabilityPage('/server-down', {
          message: error.message,
        })
      }

      throw error
    }

    return data
  } catch (error) {
    if (error instanceof ApiError) throw error

    const apiError = error?.name === 'AbortError'
      ? new ApiError('The server took too long to respond.', {
          code: 'REQUEST_TIMEOUT',
          cause: error,
        })
      : new ApiError('The server could not be reached.', {
          code: 'SERVER_UNAVAILABLE',
          cause: error,
        })

    if (redirectOnUnavailable) {
      redirectToAvailabilityPage('/server-down', {
        message: apiError.message,
      })
    }

    throw apiError
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId)
  }
}
