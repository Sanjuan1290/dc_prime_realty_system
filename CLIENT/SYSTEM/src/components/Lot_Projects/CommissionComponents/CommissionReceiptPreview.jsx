import { useRef, useState } from 'react'
import { FiPrinter, FiX } from 'react-icons/fi'
import { CommissionReceiptPrint } from '../ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'
import { openElementInPdfPrintWindow } from '../ListingProfileComponents/Printouts/pdfExportUtils'

// Only clone the receipt into a separate printing document. Printing the parent
// Commission Details page leaves hidden content in pagination and can repeat the
// acknowledgment on multiple sheets in Chromium.
export default function CommissionReceiptPreview({ seller, receipt, onClose }) {
  const receiptRef = useRef(null)
  const [printError, setPrintError] = useState('')
  if (!receipt) return null
  const handlePrint = async () => {
    setPrintError('')
    try {
      await openElementInPdfPrintWindow(receiptRef.current, {
        filename: `Acknowledgement-Receipt-${receipt.receiptId || receipt.referenceNumber || 'Fund-Release'}`,
      })
    } catch (error) {
      setPrintError(error?.message || 'The receipt could not be printed. Please allow pop-ups and retry.')
    }
  }
  return (
    <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Acknowledgement Receipt for Fund Release">
      <div className="mx-auto w-fit bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <strong className="text-sm text-slate-800">Acknowledgement Receipt for Fund Release</strong>
          <div className="flex gap-2">
            <button type="button" onClick={handlePrint} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><FiPrinter className="mr-1 inline"/> Print / Save PDF</button>
            <button type="button" aria-label="Close receipt" onClick={onClose} className="rounded-lg border p-2"><FiX/></button>
          </div>
        </div>
        {printError ? <p role="alert" className="max-w-[210mm] px-4 py-2 text-xs font-bold text-red-700">{printError}</p> : null}
        <div ref={receiptRef} data-single-fund-release-receipt="true">
          <CommissionReceiptPrint seller={seller} receipt={receipt}/>
        </div>
      </div>
    </div>
  )
}


