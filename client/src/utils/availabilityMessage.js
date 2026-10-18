// Error messages can originate from proxies, not just our JSON API.
// Do not print HTML documents or internal proxy diagnostics in the UI.
export const safeAvailabilityMessage = (value) => {
  const message = String(value || '').trim()
  if (!message) return 'The server cannot be reached right now.'
  if (/<\s*(?:!doctype|html|head|body|script|style)\b/i.test(message)
    || /<\/?[a-z][^>]*>/i.test(message)
    || message.length > 500) {
    return 'The server is temporarily unavailable. Please try again shortly.'
  }
  return message.slice(0, 240)
}

