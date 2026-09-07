const STORAGE_PREFIX = 'signed_receipt_print_payload:'

const createPrintKey = () => (
  window.crypto?.randomUUID?.()
  || `${Date.now()}-${Math.random().toString(36).slice(2)}`
)

export const openSignedReceiptPrintPreview = ({ title = 'Signed Receipts', files = [] } = {}) => {
  const printableFiles = (Array.isArray(files) ? files : [])
    .filter((file) => file && String(file.accessPath || '').trim())
    .map((file, index) => ({
      key: file.key || `signed-receipt-${index + 1}`,
      name: file.name || file.fileName || `Signed Receipt ${index + 1}`,
      fileName: file.fileName || file.name || `signed-receipt-${index + 1}`,
      fileType: file.fileType || '',
      accessPath: String(file.accessPath || '').trim(),
      malwareScanStatus: String(file.malwareScanStatus || '').toLowerCase(),
      allowUnscanned: file.allowUnscanned === true,
    }))

  if (!printableFiles.length) return false

  const printKey = createPrintKey()
  localStorage.setItem(
    `${STORAGE_PREFIX}${printKey}`,
    JSON.stringify({
      title,
      files: printableFiles,
      createdAt: new Date().toISOString(),
    })
  )

  const printWindow = window.open(
    `/portal/printouts/signed-receipts?printKey=${encodeURIComponent(printKey)}`,
    '_blank'
  )

  return Boolean(printWindow)
}

export const readSignedReceiptPrintPayload = () => {
  try {
    const printKey = new URLSearchParams(window.location.search).get('printKey')
    if (!printKey) return {}

    const saved = localStorage.getItem(`${STORAGE_PREFIX}${printKey}`)
    if (!saved) return {}

    const parsed = JSON.parse(saved)
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}
