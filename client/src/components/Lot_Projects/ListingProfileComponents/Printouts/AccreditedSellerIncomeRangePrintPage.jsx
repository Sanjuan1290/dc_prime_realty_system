import PrintPageShell from './PrintPageShell'
import { CommissionReceiptPrint } from './AccreditedSellerProofOfIncomePrintPage'

const readIncomeRangePayload = () => {
  try {
    const saved = localStorage.getItem('accredited_seller_income_range_payload')
    if (!saved) return {}
    return JSON.parse(saved)
  } catch {
    return {}
  }
}

const AccreditedSellerIncomeRangePrintPage = () => {
  const payload = readIncomeRangePayload()
  const seller = payload?.seller || {}
  const receipts = Array.isArray(payload?.receipts) ? payload.receipts : []

  return (
    <PrintPageShell
      title={`Acknowledgement Receipts for Fund Release${receipts.length ? ` (${receipts.length})` : ''}`}
      printDisabled={!receipts.length}
      printDisabledMessage="No generated acknowledgement receipts are available in this date range."
    >
      {receipts.length ? (
        receipts.map((receipt) => (
          <CommissionReceiptPrint
            key={receipt.receiptId || `${receipt.referenceNumber}-${receipt.receiptDate}`}
            seller={seller}
            receipt={receipt}
          />
        ))
      ) : (
        <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white p-[20mm] text-center text-sm text-slate-600 shadow-lg print:shadow-none">
          No generated acknowledgement receipts were loaded for this date range.
        </section>
      )}
    </PrintPageShell>
  )
}

export default AccreditedSellerIncomeRangePrintPage


