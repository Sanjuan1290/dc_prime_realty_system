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

export const normalizeDocumentResponsibleParty = (value, fallback = 'client') => {
  const normalized = String(value ?? '').trim().toLowerCase()
  if (['client', 'buyer', 'customer'].includes(normalized)) return 'client'
  if (['internal', 'company', 'company_internal', 'company / internal'].includes(normalized)) return 'internal'
  if (['seller', 'agent', 'seller_agent', 'seller / agent'].includes(normalized)) return 'seller'
  return ['client', 'internal', 'seller'].includes(fallback) ? fallback : 'client'
}

export const resolveDocumentResponsibleParty = (document = {}, fallback = 'client') => {
  const candidates = [
    document.responsibleParty,
    document.responsible_party,
    document.lot_project_listing_document_responsible_party,
    document.lot_project_default_document_responsible_party,
    document.template_document_list_responsible_party,
    document.document_responsible_party,
  ]

  const value = candidates.find((candidate) => candidate !== undefined && candidate !== null && candidate !== '')
  return normalizeDocumentResponsibleParty(value, fallback)
}

export const getDocumentResponsiblePartyLabel = (value) => {
  const responsibleParty = normalizeDocumentResponsibleParty(value)
  if (responsibleParty === 'internal') return 'Company / Internal'
  if (responsibleParty === 'seller') return 'Seller / Agent'
  return 'Client'
}

