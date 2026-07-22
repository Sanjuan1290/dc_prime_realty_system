export const getDocumentImageUrl = (entry) => {
  if (!entry) return ''
  if (typeof entry === 'string') return entry
  if (typeof entry !== 'object') return ''

  return String(
    entry.url ||
    entry.secure_url ||
    entry.fileUrl ||
    entry.file_url ||
    ''
  ).trim()
}

export const isProtectedDocumentFile = (entry) => Boolean(
  entry?.protected ||
  entry?.accessPath ||
  entry?.access_path ||
  entry?.fileId ||
  entry?.file_id ||
  entry?.cloudinaryPublicId ||
  entry?.cloudinary_public_id ||
  String(entry?.cloudinaryDeliveryType || entry?.cloudinary_delivery_type || '').toLowerCase() === 'authenticated'
)

const parseStoredFileValue = (value) => {
  if (!value) return []
  if (Array.isArray(value)) return value
  if (typeof value === 'object') return [value]
  if (typeof value !== 'string') return []

  const raw = value.trim()
  if (!raw) return []

  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : parsed ? [parsed] : []
  } catch {
    return [raw]
  }
}

export const normalizeDocumentFileEntry = (file, document = {}, index = 0) => {
  if (!file) return null

  if (typeof file === 'string') {
    const url = file.trim()
    if (!url) return null

    return {
      url,
      fileName: `${document.name || document.document_name || 'Document'} File ${index + 1}`,
      resourceType: url.toLowerCase().includes('.pdf') ? 'raw' : 'image',
      protected: false,
      accessPath: '',
    }
  }

  if (typeof file !== 'object') return null

  const url = getDocumentImageUrl(file)
  const fileId = Number(file.fileId || file.file_id || 0) || null
  const projectSlug = String(document.projectSlug || document.project_slug || '').trim()
  const accessPath = String(
    file.accessPath ||
    file.access_path ||
    (fileId && projectSlug
      ? `/projects/lot-projects/${projectSlug}/document-files/${fileId}/access-url`
      : '')
  ).trim()
  const protectedFile = isProtectedDocumentFile({ ...file, fileId, accessPath })
  const cloudinaryPublicId = file.cloudinaryPublicId || file.cloudinary_public_id || null

  // Protected files intentionally have no permanent public URL. Keep the
  // access route/file id so viewers can request a short-lived signed link.
  if (!url && !accessPath && !fileId && !cloudinaryPublicId) return null

  return {
    ...file,
    fileId,
    url,
    accessPath,
    protected: protectedFile,
    cloudinaryPublicId,
    fileName:
      file.fileName ||
      file.file_name ||
      file.originalFilename ||
      file.original_filename ||
      `${document.name || document.document_name || 'Document'} File ${index + 1}`,
    fileType: file.fileType || file.file_type || '',
    format: file.cloudinaryFormat || file.cloudinary_format || file.format || '',
    resourceType:
      file.cloudinaryResourceType ||
      file.cloudinary_resource_type ||
      file.resource_type ||
      file.resourceType ||
      (String(file.fileType || file.file_type || '').toLowerCase().includes('pdf') ? 'raw' : 'image'),
  }
}

export const getDocumentFiles = (document = {}) => {
  const candidates = [
    document.imageEntries,
    document.fileEntries,
    document.files,
    document.images,
    document.lot_project_client_document_file_url,
    document.file_url,
    document.fileUrl,
  ]

  const source = candidates
    .map(parseStoredFileValue)
    .find((entries) => entries.length) || []

  return source
    .map((file, index) => normalizeDocumentFileEntry(file, document, index))
    .filter(Boolean)
}

export const isPdfLike = (file = {}) => `${
  file.url || ''
} ${file.fileName || ''} ${file.fileType || file.file_type || ''} ${file.resourceType || ''} ${file.format || file.cloudinaryFormat || file.cloudinary_format || ''}`
  .toLowerCase()
  .includes('pdf')
