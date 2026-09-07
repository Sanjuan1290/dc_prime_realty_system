const clean = (value) => String(value ?? '').trim()

export const normalizeDocumentCodeInput = (value) => clean(value)
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .replace(/-{2,}/g, '-')

export const suggestDocumentCode = (documentName) => {
  const base = normalizeDocumentCodeInput(documentName)
  return base ? `DOC-${base.replace(/^DOC-?/, '')}` : ''
}

export const isValidDocumentCode = (value) => /^DOC-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(clean(value))
