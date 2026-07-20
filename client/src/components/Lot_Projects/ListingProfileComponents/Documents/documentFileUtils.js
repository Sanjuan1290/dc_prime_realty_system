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
  )
}

export const isProtectedDocumentFile = (entry) => Boolean(
  entry?.protected ||
  entry?.accessPath ||
  entry?.access_path ||
  entry?.fileId ||
  entry?.file_id ||
  String(entry?.cloudinaryDeliveryType || entry?.cloudinary_delivery_type || '').toLowerCase() === 'authenticated'
)

export const normalizeDocumentFileEntry = (file, document = {}, index = 0) => {
  if (!file) return null

  if (typeof file === 'string') {
    return {
      url: file,
      fileName: `${document.name || 'Document'} File ${index + 1}`,
      resourceType: file.toLowerCase().includes('.pdf') ? 'raw' : 'image',
      protected: false,
      accessPath: '',
    }
  }

  if (typeof file !== 'object') return null

  const url = getDocumentImageUrl(file)
  const fileId = file.fileId || file.file_id || null
  const accessPath = file.accessPath || file.access_path || (fileId ? `/document-files/${fileId}/access-url` : '')
  const protectedFile = isProtectedDocumentFile({ ...file, fileId, accessPath })

  if (!url && !accessPath && !fileId) return null

  return {
    ...file,
    fileId,
    url,
    accessPath,
    protected: protectedFile,
    fileName:
      file.fileName ||
      file.file_name ||
      file.originalFilename ||
      file.original_filename ||
      `${document.name || 'Document'} File ${index + 1}`,
    resourceType:
      file.cloudinaryResourceType ||
      file.cloudinary_resource_type ||
      file.resource_type ||
      file.resourceType ||
      (String(file.fileType || file.file_type || '').toLowerCase().includes('pdf') ? 'raw' : 'image'),
  }
}

export const getDocumentFiles = (document = {}) => {
  const source = Array.isArray(document.imageEntries) && document.imageEntries.length
    ? document.imageEntries
    : Array.isArray(document.images) && document.images.length
      ? document.images
      : document.fileUrl
        ? [document.fileUrl]
        : []

  return source
    .map((file, index) => normalizeDocumentFileEntry(file, document, index))
    .filter(Boolean)
}

export const isPdfLike = (file = {}) => `${
  file.url || ''
} ${file.fileName || ''} ${file.fileType || file.file_type || ''} ${file.resourceType || ''}`
  .toLowerCase()
  .includes('pdf')
