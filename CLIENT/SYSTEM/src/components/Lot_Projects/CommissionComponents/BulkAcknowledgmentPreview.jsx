import { useRef, useState } from 'react'
import { FiPrinter, FiX } from 'react-icons/fi'
import { CommissionReceiptPrint } from '../ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'
import { openElementInPdfPrintWindow } from '../ListingProfileComponents/Printouts/pdfExportUtils'

// One A4 acknowledgment per payee, with the exact existing receipt template.
// No upload controls here: signed files remain attached to each individual receipt.
export default function BulkAcknowledgmentPreview({ receipts, stage, unit, onClose }) {
  const printRef = useRef(null)
  const [error, setError] = useState('')
  const print = async () => {
    setError('')
    try {
      await openElementInPdfPrintWindow(printRef.current, {
        filename: `All-Acknowledgments-${unit}-${stage}`,
      })
    } catch (err) {
      setError(err?.message || 'Unable to print the combined acknowledgments.')
    }
  }
  return <div role="dialog" aria-modal="true" aria-label="Print all acknowledgments" className="fixed inset-0 z-[99] overflow-y-auto bg-slate-950/70 p-3 sm:p-6">
    <div className="mx-auto max-w-[225mm] bg-white shadow-xl">
      <div className="print-hidden flex items-center justify-between gap-3 border-b p-3">
        <div><p className="font-black">Print All Acknowledgments</p><p className="text-xs text-slate-500">{unit} · {stage} · {receipts.length} separate A4 receipts</p></div>
        <div className="flex gap-2"><button type="button" onClick={print} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><FiPrinter className="mr-1 inline"/>Print / Save PDF</button><button type="button" onClick={onClose} aria-label="Close combined preview" className="rounded-lg border p-2"><FiX/></button></div>
      </div>
      {error ? <p role="alert" className="p-3 text-sm font-bold text-red-700">{error}</p> : null}
      <div ref={printRef} className="print-preview-pages">
        {receipts.map((item) => <CommissionReceiptPrint key={item.key} seller={item.seller} receipt={item.receipt}/>)}
      </div>
    </div>
  </div>
}

