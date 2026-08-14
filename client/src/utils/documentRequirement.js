export const normalizeDocumentRequirement = (value, fallback = 'required') => {
  if (value === false || value === 0 || value === '0') return 'optional'
  if (value === true || value === 1 || value === '1') return 'required'

  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'optional' || normalized === 'false') return 'optional'
  if (normalized === 'required' || normalized === 'true') return 'required'

  return fallback
}

export const resolveDocumentRequirement = (document = {}, fallback = 'required') => {
  const candidates = [
    document.requirement,
    document.lot_project_listing_document_is_required,
    document.lot_project_default_document_is_required,
    document.template_document_list_is_required,
    document.document_is_required,
    document.is_required,
  ]

  const value = candidates.find((candidate) => candidate !== undefined && candidate !== null && candidate !== '')
  return normalizeDocumentRequirement(value, fallback)
}
