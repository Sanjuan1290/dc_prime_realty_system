export const AUTH_EVENTS = Object.freeze({
  unauthorized: 'dc-prime:auth-unauthorized',
  forbidden: 'dc-prime:auth-forbidden',
  passwordChangeRequired: 'dc-prime:password-change-required',
})

export const emitAuthEvent = (eventName, detail = {}) => {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return

  window.dispatchEvent(new CustomEvent(eventName, { detail }))
}
