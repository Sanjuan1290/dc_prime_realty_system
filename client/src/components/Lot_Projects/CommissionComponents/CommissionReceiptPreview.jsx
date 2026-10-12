import { FiPrinter, FiX } from 'react-icons/fi'
import { CommissionReceiptPrint } from '../ListingProfileComponents/Printouts/AccreditedSellerProofOfIncomePrintPage'

// Both seller and Network Company Profit receipts use the exact Accredited Sellers A4 format.
export default function CommissionReceiptPreview({ seller, receipt, onClose }) {
  if (!receipt) return null
  return <div className="fixed inset-0 z-[95] overflow-y-auto bg-slate-950/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Acknowledgement Receipt for Fund Release">
    <style>{`@page { size: A4 portrait; margin: 0; }
      @media print {
        body * { visibility: hidden !important; }
        #commission-receipt-print, #commission-receipt-print * { visibility: visible !important; }
        #commission-receipt-print { position: absolute !important; top: 0; left: 0; width: 210mm; border: 0 !important; padding: 0 !important; margin: 0 !important; box-shadow: none !important; }
        .commission-receipt-actions { display: none !important; }
        .print-page { box-shadow: none !important; }
      }`}</style>
    <div id="commission-receipt-print" className="mx-auto w-fit bg-white shadow-xl">
      <div className="commission-receipt-actions flex items-center justify-between gap-3 border-b px-4 py-3">
        <strong className="text-sm text-slate-800">Acknowledgement Receipt for Fund Release</strong>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><FiPrinter className="mr-1 inline"/> Print / Save PDF</button>
          <button type="button" aria-label="Close receipt" onClick={onClose} className="rounded-lg border p-2"><FiX/></button>
        </div>
      </div>
      <CommissionReceiptPrint seller={seller} receipt={receipt}/>
    </div>
  </div>
}
