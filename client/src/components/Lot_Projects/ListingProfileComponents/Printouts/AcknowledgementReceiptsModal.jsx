import { useMemo, useState } from 'react'
import { FiFileText, FiPrinter, FiX } from 'react-icons/fi'
import SignedCopyUploadModal from '../../../Shared/SignedCopyUploadModal'
import StatusAlert from '../../../Shared/StatusAlert'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const AcknowledgementReceiptsModal = ({
  projectSlug,
  listingId,
  payments = [],
  readOnly = false,
  onClose,
  onPrintAllUnsigned,
  onPrintAllSigned,
  onPrintUnsigned,
}) => {
  const [localPayments, setLocalPayments] = useState(() => payments)
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [printNotice, setPrintNotice] = useState(null)
  const verifiedPayments = useMemo(() => localPayments.filter((payment) => String(payment?.status || 'Verified').toLowerCase() === 'verified'), [localPayments])
  const printableSignedPayments = useMemo(() => verifiedPayments.filter((payment) => {
    const signedCopy = payment?.acknowledgementSignedCopy || null
    return signedCopy && String(signedCopy.malwareScanStatus || '').toLowerCase() === 'approved'
  }), [verifiedPayments])

  const updateSignedCopy = (paymentId, result) => {
    const signedCopy = result?.data?.signedCopy || null
    if (!signedCopy) return
    setLocalPayments((current) => current.map((payment) => Number(payment.paymentId || payment.id) === Number(paymentId)
      ? { ...payment, acknowledgementSignedCopy: signedCopy }
      : payment))
    setSelectedPayment((current) => current && Number(current.paymentId || current.id) === Number(paymentId)
      ? { ...current, acknowledgementSignedCopy: signedCopy }
      : current)
  }
  const handlePrintAllSigned = () => {
    if (!printableSignedPayments.length) return
    const opened = onPrintAllSigned?.(printableSignedPayments)
    setPrintNotice(opened === false
      ? { type: 'error', message: 'Your browser blocked the signed receipt print preview. Allow pop-ups for this site and try again.' }
      : { type: 'success', message: `${printableSignedPayments.length} signed receipt${printableSignedPayments.length === 1 ? '' : 's'} prepared in one combined print preview.` })
  }


  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/65 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-black text-slate-950">Acknowledgement Receipts</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Print the system-generated unsigned receipt or attach the physically signed copy to the exact payment.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><FiX /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-sm font-black text-slate-950">{verifiedPayments.length} verified payment{verifiedPayments.length === 1 ? '' : 's'}</p><p className="text-xs font-semibold text-slate-500">Each payment has its own acknowledgement receipt and signed-copy record.</p></div>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={onPrintAllUnsigned} disabled={!verifiedPayments.length} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiPrinter />Print All Unsigned</button>
              <button type="button" onClick={handlePrintAllSigned} disabled={!printableSignedPayments.length} title={!printableSignedPayments.length ? 'No security-approved signed acknowledgement receipts are available.' : 'Print all security-approved signed acknowledgement receipts in one combined preview.'} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-300"><FiPrinter />Print All Signed ({printableSignedPayments.length})</button>
            </div>
          </div>

          {printNotice ? <StatusAlert type={printNotice.type} message={printNotice.message} onClose={() => setPrintNotice(null)} className="mt-4" /> : null}

          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
            {verifiedPayments.length ? <div className="divide-y divide-slate-100">{verifiedPayments.map((payment) => {
              const paymentId = Number(payment.paymentId || payment.id || 0)
              const signedCopy = payment.acknowledgementSignedCopy || null
              const scanStatus = String(signedCopy?.malwareScanStatus || '').toLowerCase()
              return <div key={paymentId} className="grid gap-3 p-4 md:grid-cols-[1fr_auto] md:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-black text-slate-950">{payment.referenceId || `Payment #${paymentId}`}</p>{signedCopy ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${scanStatus === 'approved' ? 'bg-emerald-100 text-emerald-700' : scanStatus === 'rejected' || scanStatus === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{scanStatus === 'approved' ? 'Signed copy ready' : scanStatus === 'pending' ? 'Scan pending' : scanStatus === 'rejected' ? 'Blocked' : scanStatus === 'error' ? 'Scan error' : 'Not scanned'}</span> : null}</div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{payment.paymentDate || '-'} · {payment.method || '-'} · {money(payment.amount)}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button type="button" onClick={() => onPrintUnsigned?.(paymentId)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 hover:bg-blue-100"><FiPrinter />Print Unsigned</button>
                  <button type="button" onClick={() => setSelectedPayment(payment)} disabled={readOnly && !signedCopy} title={readOnly && !signedCopy ? 'No signed copy was retained for this historical payment.' : undefined} className={`inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-black disabled:cursor-not-allowed disabled:opacity-50 ${signedCopy ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}><FiFileText />{signedCopy ? 'View / Signed Copy' : readOnly ? 'No Signed Copy' : 'Upload Signed Copy'}</button>
                </div>
              </div>
            })}</div> : <div className="p-8 text-center text-sm font-semibold text-slate-500">No verified payments are available for acknowledgement receipts.</div>}
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-200 px-6 py-4"><button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-50">Close</button></div>
      </div>

      {selectedPayment ? <SignedCopyUploadModal
        title="Signed Acknowledgement Receipt"
        description={`Upload or view the physically signed receipt for ${selectedPayment.referenceId || `payment #${selectedPayment.paymentId || selectedPayment.id}`}. The generated receipt remains available as the unsigned original.`}
        recordLabel={`Acknowledgement Receipt · ${selectedPayment.referenceId || `Payment #${selectedPayment.paymentId || selectedPayment.id}`}`}
        category="Signed Acknowledgement Receipt"
        basePath={`/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${selectedPayment.paymentId || selectedPayment.id}/acknowledgement-signed-copy`}
        readOnly={readOnly}
        viewLabel="View"
        onClose={() => setSelectedPayment(null)}
        onChanged={(result) => updateSignedCopy(selectedPayment.paymentId || selectedPayment.id, result)}
      /> : null}
    </div>
  )
}

export default AcknowledgementReceiptsModal

