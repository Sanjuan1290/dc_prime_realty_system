const privateField = /password|token|secret|cookie|signature|bank|pin|account.?number|otp|verification.?code|code_hash/i
export const auditLabel = value => String(value || 'Details').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_.-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase())
export const auditValue = (value,key) => /amount|salary|net.?fund.?release|monthly.?basic|half.?month.?basic|(?:daily|hourly|minute).?rate|money.?in|money.?out|balance|gross.?pay|net.?pay|deduction|addition/i.test(key||'') && /^-?\d+(?:\.\d+)?$/.test(String(value)) ? new Intl.NumberFormat('en-PH',{style:'currency',currency:'PHP'}).format(Number(value)) : String(value)
export function auditDetails(value) {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return { description: 'Details were not recorded in a readable format.' } }
  }
  const clean = (item, key = '', depth = 0) => {
    if (privateField.test(key)) return 'Hidden for privacy'
    if (depth > 8) return 'Additional details omitted'
    if (typeof item === 'string' && /^[\s]*[\[{]/.test(item)) { try { return clean(JSON.parse(item),key,depth+1) } catch { return 'Details unavailable' } }
    if (Array.isArray(item)) return item.slice(0, 100).map(entry => clean(entry, '', depth + 1))
    if (item && typeof item === 'object') return Object.fromEntries(Object.entries(item).slice(0, 100).map(([name, entry]) => [name, clean(entry, name, depth + 1)]))
    return item
  }
  return clean(value && typeof value === 'object' ? value : {})
}
