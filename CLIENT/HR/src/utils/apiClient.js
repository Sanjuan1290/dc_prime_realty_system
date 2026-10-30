import { HR_FEATURE_FLAGS } from '../config/featureFlags'

const AUTH_PATHS = new Set(['/auth/login','/auth/logout'])
const KIOSK_MUTATION_PATHS = new Set(['/attendance-kiosk/unlock','/attendance-kiosk/lock','/attendance-kiosk/scan'])
const TIMEOUT_MS = 60000

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', data = null } = {}) {
    super(message)
    this.name = 'ApiError'; this.status = status; this.code = code; this.data = data
  }
}
export const isAuthenticationError = (error) => Number(error?.status) === 401
export const isServerUnavailableError = (error) => ['SERVER_UNAVAILABLE', 'REQUEST_TIMEOUT'].includes(error?.code)
export const isMaintenanceError = (error) => error?.code === 'MAINTENANCE_MODE'

export const resolveHrApiBase = (raw) => {
  const value = String(raw || '').trim().replace(/\/+$/, '')
  if (!value) throw new ApiError('HR API URL is not configured.', { code: 'HR_API_URL_REQUIRED' })
  if (/^\/\//.test(value) || !(/^(https:\/\/[^/]+|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?|\/api\/v1|\/hr-api\/api\/v1)(?:\/api\/v1)?$/i.test(value))) {
    throw new ApiError('Invalid HR API URL. Configure the HR-specific API hostname or the staging proxy.', { code: 'INVALID_HR_API_URL' })
  }
  return value
}
const apiBase = () => resolveHrApiBase(import.meta.env.VITE_HR_API_URL)

const normalizePath = (path) => {
  const value = String(path || '').trim()
  if (!value.startsWith('/') || value.startsWith('//') || /[\r\n]/.test(value)) {
    throw new ApiError('Invalid HR API path.', { code: 'INVALID_HR_PATH' })
  }
  const pathname = value.split('?')[0]
  if (!/^\/(?:auth|employees|attendance|employee-payroll|attendance-kiosk|health)(?:\/|$)/.test(pathname)) {
    throw new ApiError(`Unsupported HR API route: ${pathname}`, { code: 'HR_ROUTE_NOT_ALLOWED' })
  }
  return value
}

const parseResponse = async (response) => {
  const ct = response.headers.get('content-type') || ''
  if (/application\/json/i.test(ct)) return response.json().catch(() => ({}))
  // Never echo HTML proxy errors or private upstream details.
  return { message: response.ok ? '' : `HR API request failed (${response.status}).` }
}

const fetchHr = async (path, options = {}, asBlob = false) => {
  const normalized = normalizePath(path)
  const pathname = normalized.split('?')[0]
  const method = String(options.method || 'GET').toUpperCase()
  if (!['GET','HEAD','POST','PATCH','PUT','DELETE'].includes(method)) throw new ApiError('Unsupported method.', {code:'HR_METHOD_NOT_ALLOWED'})
  const isMutation = !['GET','HEAD'].includes(method)
  if (isMutation && !AUTH_PATHS.has(pathname)) {
    if (KIOSK_MUTATION_PATHS.has(pathname)) {
      if (!HR_FEATURE_FLAGS.kiosk) throw new ApiError('HR kiosk is disabled during staging.', {code:'HR_KIOSK_DISABLED'})
    } else if (!HR_FEATURE_FLAGS.stagingWrites) {
      throw new ApiError('HR staging is read-only.', { code:'HR_READ_ONLY' })
    }
    if (/^\/employee-payroll\/payrolls\/[^/]+\/release(?:\/|$)/.test(pathname)) {
      throw new ApiError('Payroll release requires Batch 8.', {code:'HR_PAYROLL_RELEASE_DISABLED'})
    }
    if (/signed-receipts(?:\/|$)/.test(pathname)) {
      throw new ApiError('Signed receipts require Batch 9.', {code:'HR_SIGNED_RECEIPTS_DISABLED'})
    }
    if (options.confirmationHandled === 'technical' && !['/employees/employee-code-preview','/employees/barcode-preview','/attendance/scan'].includes(pathname) && !KIOSK_MUTATION_PATHS.has(pathname)) {
      throw new ApiError('Technical confirmation is unavailable for this HR action.', {code:'HR_CONFIRMATION_REQUIRED'})
    }
    if (!KIOSK_MUTATION_PATHS.has(pathname) && options.confirmationHandled !== 'technical') {
      if (typeof window === 'undefined' || !window.confirm('Confirm this HR change?')) {
        throw new ApiError('Changes cancelled.', {status:499,code:'REVIEW_CANCELLED'})
      }
    }
  }
  // Do not pass UI-only mutation policy data into fetch.
  const { confirmationHandled, doubleCheck, confirmationToken, redirectOnUnavailable, timeoutMs = TIMEOUT_MS, ...fetchOptions } = options
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(`${apiBase()}${normalized}`, {
      ...fetchOptions,
      method,
      credentials:'include',
      headers: {
        ...(fetchOptions.body && !(typeof FormData !== 'undefined' && fetchOptions.body instanceof FormData) ? { 'Content-Type':'application/json' } : {}),
        ...fetchOptions.headers,
      },
      signal: controller.signal,
    })
    if (!response.ok) {
      const data = await parseResponse(response)
      throw new ApiError(data?.message || `HR API error (${response.status}).`,{status:response.status,code:data?.code || '',data})
    }
    if (asBlob) return {
      blob: await response.blob(),
      contentType: response.headers.get('content-type') || '',
      contentDisposition: response.headers.get('content-disposition') || '',
    }
    return parseResponse(response)
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(error?.name==='AbortError' ? 'HR API request timed out.' : 'HR API unavailable.',{
      code:error?.name==='AbortError'?'REQUEST_TIMEOUT':'SERVER_UNAVAILABLE',
    })
  } finally {clearTimeout(timeout)}
}
export const requestApi = (path, options = {}) => fetchHr(path, options)
export const requestApiBlob = (path, options = {}) => fetchHr(path, {...options, method:'GET'}, true)
