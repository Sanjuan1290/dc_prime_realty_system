const SUPPORTED_DOUBLE_CHECK_TYPES = new Set([
  'project',
  'listing',
  'listing-documents',
  'reservation',
  'buyer-profile',
  'user',
  'seller-group',
  'document',
  'document-template',
  'document-upload',
  'payment',
  'payment-proof',
  'soa-terms',
  'penalty-adjustment',
  'commission-release',
  'proof-of-income',
  'employee',
  'attendance',
  'cash-advance',
  'payroll-release',
  'settings',
  'buyer-form',
  'audit-archive',
])

let handler = null
let queue = Promise.resolve()
const issuedTokens = new Map()
const TOKEN_TTL_MS = 2 * 60 * 1000

const makeToken = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `dc-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

const pruneTokens = () => {
  const now = Date.now()
  for (const [token, expiresAt] of issuedTokens.entries()) {
    if (expiresAt <= now) issuedTokens.delete(token)
  }
}

export const isSupportedDoubleCheckType = (type) => SUPPORTED_DOUBLE_CHECK_TYPES.has(String(type || ''))
export const getSupportedDoubleCheckTypes = () => [...SUPPORTED_DOUBLE_CHECK_TYPES]

export const setDoubleCheckHandler = (nextHandler) => {
  handler = typeof nextHandler === 'function' ? nextHandler : null
  return () => {
    if (handler === nextHandler) handler = null
  }
}

export const requestDoubleCheck = async (request = {}) => {
  if (!isSupportedDoubleCheckType(request.type)) {
    throw new Error(`Unsupported Final Double-Check type: ${String(request.type || 'missing')}`)
  }
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return { confirmed: true, token: '' }
  }

  const run = async () => Boolean(await handler(request))
  const pending = queue.then(run, run)
  queue = pending.catch(() => false)
  const confirmed = await pending
  if (!confirmed) return { confirmed: false, token: '' }

  pruneTokens()
  const token = makeToken()
  issuedTokens.set(token, Date.now() + TOKEN_TTL_MS)
  return { confirmed: true, token }
}

export const consumeDoubleCheckToken = (token) => {
  pruneTokens()
  const value = String(token || '')
  if (!value || !issuedTokens.has(value)) return false
  issuedTokens.delete(value)
  return true
}

export const isDoubleCheckCancelled = (error) =>
  error?.code === 'REVIEW_CANCELLED' || Number(error?.status || 0) === 499

export const getDoubleCheckNotice = (
  error,
  fallbackMessage = 'The action could not be completed.',
  cancelledMessage = 'Final review closed. You can continue editing; nothing was saved.'
) => isDoubleCheckCancelled(error)
  ? { type: 'info', message: cancelledMessage }
  : { type: 'error', message: error?.message || fallbackMessage }

