import { useMemo, useRef } from 'react'
import { FiPrinter } from 'react-icons/fi'
import { buildCode128Geometry, normalizeEmployeeBarcodeCode, validateCode128BText } from '../../../utils/code128'

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[char]))

const Code128Barcode = ({ value, employeeName = '', employeeCode = '', showPrint = true, compact = false }) => {
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
      {showPrint ? <button type="button" onClick={printBarcode} className="mt-3 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><FiPrinter />Print Attendance Barcode</button> : null}
    </div>
  )
}

export default Code128Barcode
