import { useMemo, useRef } from 'react'
import { FiDownload, FiPrinter } from 'react-icons/fi'
import { buildCode128Geometry, normalizeEmployeeBarcodeCode, validateCode128BText } from '../../../utils/code128'

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))

const safeFilePart = (value) =>
  String(value || '')
    .trim()
    .replace(/[^a-z0-9_-]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'employee'

export const downloadAttendanceBarcodePng = ({ value, employeeName = '', employeeCode = '' } = {}) => {
  if (typeof document === 'undefined') return false

  const code = normalizeEmployeeBarcodeCode(value)
  const validation = validateCode128BText(code)
  if (!validation.valid) return false

  let geometry
  try {
    geometry = buildCode128Geometry(code)
  } catch {
    return false
  }

  const scale = 4
  const padding = 32
  const barcodeHeight = 72 * scale
  const hasName = Boolean(String(employeeName || '').trim())
  const hasEmployeeCode = Boolean(String(employeeCode || '').trim())
  const headerHeight = (hasName ? 40 : 0) + (hasEmployeeCode ? 30 : 0) + 18
  const width = Math.ceil((geometry.moduleWidth * scale) + (padding * 2))
  const height = Math.ceil(padding + headerHeight + barcodeHeight + 58 + padding)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) return false

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.fillStyle = '#111827'
  context.textAlign = 'center'
  context.textBaseline = 'middle'

  let y = padding + 12
  if (hasName) {
    context.font = '700 24px Arial, sans-serif'
    context.fillText(String(employeeName).trim(), width / 2, y + 8)
    y += 40
  }
  if (hasEmployeeCode) {
    context.font = '700 18px Arial, sans-serif'
    context.fillText(`Employee Code: ${String(employeeCode).trim()}`, width / 2, y)
    y += 30
  }

  const barcodeY = y + 12
  context.fillStyle = '#000000'
  geometry.bars.forEach((bar) => {
    context.fillRect(
      padding + (bar.x * scale),
      barcodeY,
      Math.max(bar.width * scale, 1),
      barcodeHeight
    )
  })

  context.font = '700 22px monospace'
  context.fillText(code, width / 2, barcodeY + barcodeHeight + 34)

  const download = document.createElement('a')
  download.href = canvas.toDataURL('image/png')
  download.download = `attendance-barcode-${safeFilePart(employeeCode || employeeName || code)}.png`
  document.body.appendChild(download)
  download.click()
  download.remove()
  return true
}

const Code128Barcode = ({ value, employeeName = '', employeeCode = '', showPrint = true, showDownload = true, compact = false }) => {
  const svgRef = useRef(null)
  const code = normalizeEmployeeBarcodeCode(value)
  const validation = validateCode128BText(code)
  const geometry = useMemo(() => {
    if (!validation.valid) return null
    try { return buildCode128Geometry(code) } catch { return null }
  }, [code, validation.valid])

  if (!geometry) {
    return (
      <div className="flex min-h-28 items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 text-center text-xs font-semibold text-slate-400">
        The secure Attendance Barcode will appear after the employee is saved.
      </div>
    )
  }

  const barcodeHeight = compact ? 54 : 76
  const textY = barcodeHeight + (compact ? 18 : 22)
  const viewHeight = textY + (compact ? 8 : 12)

  const printBarcode = () => {
    const svg = svgRef.current?.outerHTML
    if (!svg) return
    const popup = window.open('', '_blank', 'width=640,height=520')
    if (!popup) return
    const safeName = escapeHtml(employeeName || 'Employee')
    const safeEmployeeCode = escapeHtml(employeeCode)
    const safeBarcode = escapeHtml(code)
    popup.document.write(`<!doctype html><html><head><title>${safeName} - ${safeEmployeeCode || safeBarcode}</title><style>body{font-family:Arial,sans-serif;margin:0;padding:28px;text-align:center}.card{display:inline-block;border:1px solid #ddd;border-radius:14px;padding:22px 26px}.name{font-weight:700;font-size:18px}.employee-code{margin:6px 0 14px;color:#444;font-weight:700}.label{margin-top:10px;font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.08em}svg{width:420px;max-width:100%;height:auto}@media print{button{display:none}.card{border:0}}</style></head><body><div class="card"><div class="name">${safeName}</div>${safeEmployeeCode ? `<div class="employee-code">Employee Code: ${safeEmployeeCode}</div>` : ''}<div class="label">Attendance Barcode</div>${svg}</div><br><button onclick="window.print()" style="margin-top:20px;padding:10px 18px;font-weight:700">Print Barcode</button></body></html>`)
    popup.document.close()
    popup.focus()
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {employeeCode ? <p className="mb-2 text-center text-xs font-black uppercase tracking-wide text-slate-500">Employee Code: {employeeCode}</p> : null}
      <div className="overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${geometry.moduleWidth} ${viewHeight}`} role="img" aria-label={`Code 128 attendance barcode for ${code}`} className="mx-auto block h-auto w-full max-w-md" preserveAspectRatio="xMidYMid meet">
          <rect width={geometry.moduleWidth} height={viewHeight} fill="white" />
          {geometry.bars.map((bar, index) => <rect key={`${bar.x}-${index}`} x={bar.x} y="0" width={bar.width} height={barcodeHeight} fill="black" />)}
          <text x={geometry.moduleWidth / 2} y={textY} textAnchor="middle" fontFamily="monospace" fontSize={compact ? 10 : 12} fontWeight="700" fill="black">{code}</text>
        </svg>
      </div>
      {showPrint || showDownload ? (
        <div className={`mt-3 grid gap-2 ${showPrint && showDownload ? 'sm:grid-cols-2' : ''}`}>
          {showDownload ? (
            <button
              type="button"
              onClick={() => downloadAttendanceBarcodePng({ value: code, employeeName, employeeCode })}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700 hover:bg-blue-100"
            >
              <FiDownload />Download Attendance Barcode
            </button>
          ) : null}
          {showPrint ? (
            <button type="button" onClick={printBarcode} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><FiPrinter />Print Attendance Barcode</button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default Code128Barcode


