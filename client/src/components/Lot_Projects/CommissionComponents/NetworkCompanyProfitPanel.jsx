import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiFileText, FiPrinter, FiShield, FiX } from 'react-icons/fi'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import SignedCopyUploadModal from '../../Shared/SignedCopyUploadModal'
import ReleaseReceiptFields, { emptyReleaseReceipt, validateReleaseReceipt } from './ReleaseReceiptFields'
import StatusAlert from '../../Shared/StatusAlert'

const money = (amount) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(amount || 0))
const readableMethod = (value) => ({ bank_transfer: 'Bank Transfer', cash: 'Cash', check: 'Check', other: 'Other' }[value] || value || '-')

// Seller Proof of Income and Network Profit Acknowledgment share the protected
// signed-file workflow, but NOT the personal seller commission ledger.
export const NetworkProfitAcknowledgement = ({ profit, stage, onClose }) => {
  if (!profit || !stage || stage.status !== 'Released') return null
  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/70 p-4">
    <style>{`@media print { body * {visibility:hidden!important;} #network-profit-print, #network-profit-print * {visibility:visible!important;} #network-profit-print{position:absolute;inset:0;width:100%;box-shadow:none!important;border:0!important;} .network-profit-actions{display:none!important;} }`}</style>
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl" id="network-profit-print">
      <div className="network-profit-actions mb-6 flex justify-end gap-2">
        <button type="button" onClick={() => window.print()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white"><FiPrinter className="mr-1 inline"/> Print / Save PDF</button>
        <button type="button" onClick={onClose} aria-label="Close acknowledgment" className="rounded-lg border px-3 py-2"><FiX/></button>
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">D&C Prime Realty</p>
      <h2 className="mt-2 text-2xl font-black">Network Company Profit Release Acknowledgment</h2>
      <p className="mt-1 text-sm text-slate-500">Reference: NCP-{stage.id} · {stage.stage}</p>
      <div className="mt-6 grid grid-cols-2 gap-4 border-y py-5 text-sm">
        <div><p className="text-slate-500">Project / Unit</p><p className="font-bold">{profit.project} · {profit.unit}</p></div>
        <div><p className="text-slate-500">Buyer Account</p><p className="font-bold">{profit.accountReference} · {profit.buyer}</p></div>
        <div><p className="text-slate-500">Network / Realty</p><p className="font-bold">{profit.network}</p></div>
        <div><p className="text-slate-500">Authorized Recipient (recorded payee)</p><p className="font-bold">{stage.payeeName || profit.payee}</p></div>
        <div><p className="text-slate-500">Payment Date</p><p className="font-bold">{String(stage.actualReleaseDate || '').slice(0,10)}</p></div>
        <div><p className="text-slate-500">Payment Method / Reference</p><p className="font-bold">{readableMethod(stage.paymentMethod)} · {stage.paymentReference}</p></div>
        {stage.receiptDate ? <div><p className="text-slate-500">Receipt Date / Witness</p><p className="font-bold">{String(stage.receiptDate).slice(0,10)} · {stage.witnessName || '-'}</p></div> : null}
        {stage.bankName ? <div><p className="text-slate-500">Bank / Account No.</p><p className="font-bold">{stage.bankName} · {stage.accountNumber || '-'}</p></div> : null}
        <div><p className="text-slate-500">Company Profit Rate</p><p className="font-bold">{profit.companyProfitRate.toFixed(4)}%</p></div>
        <div><p className="text-slate-500">Milestone</p><p className="font-bold">{stage.stage} · {stage.releasePercent}%</p></div>
      </div>
      <p className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">Amount Released</p>
      <p className="mt-1 text-3xl font-black">{money(stage.amount)}</p>
      <p className="mt-5 text-sm text-slate-600">This document acknowledges the payment of the Network's Company Profit share. It is not an individual seller's Proof of Income.</p>
      <div className="mt-12 grid grid-cols-2 gap-10 text-center text-sm"><div className="border-t pt-2">Authorized Accounting Representative</div><div className="border-t pt-2">Network / Payee Acknowledgment</div></div>
    </div>
  </div>
}

export default function NetworkCompanyProfitPanel({ projectSlug, canRelease = false, embedded = false, profitRecord = null }) {
  const queryClient = useQueryClient()
  const [releaseChoice, setReleaseChoice] = useState(null)
  const [method, setMethod] = useState('bank_transfer')
  const [receiptDetails, setReceiptDetails] = useState(emptyReleaseReceipt)
  const [receiptError, setReceiptError] = useState('')
  const [signedChoice, setSignedChoice] = useState(null)
  const [printChoice, setPrintChoice] = useState(null)
  const [notice, setNotice] = useState(null)
  const queryKey = useMemo(() => ['network-company-profit', projectSlug], [projectSlug])
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/network-company-profit`),
    enabled: Boolean(projectSlug) && !embedded,
  })
  const records = embedded ? (profitRecord ? [profitRecord] : []) : (data?.data || [])
  const mutation = useMutation({
    mutationFn: ({ profit, stage, paymentMethod, paymentReference, receiptDetails }) => useFetchPost(
      `/projects/lot-projects/${projectSlug}/network-company-profit/${profit.id}/releases/${stage.id}`,
      { paymentMethod, paymentReference, receiptDetails },
      { doubleCheck: { type: 'commission-release', summary: `${profit.unit} · ${profit.network} · Company Profit`,
        data: { commissionBeneficiary: {
          project: profit.project, unit: profit.unit, buyer: profit.buyer,
          beneficiary: profit.payee, role: 'Network Company Profit (not personal commission)',
          group: profit.network, commissionBase: profit.commissionBase,
          commissionRate: profit.companyProfitRate, grossCommission: profit.totalProfit,
          previouslyReleased: profit.released, remainingBeforeRelease: profit.remaining,
        }, selectedRelease: { releaseStage: stage.stage, triggerPercent: stage.triggerPercent,
          releasePercent: stage.releasePercent, grossReleaseAmount: stage.amount,
          netReleaseAmount: stage.amount, deductionAmount: 0, currentStatus: stage.status,
          paymentMethod, paymentReference },
        } } }
    ),
    onSuccess: (result) => {
      setReleaseChoice(null)
      setReceiptDetails(emptyReleaseReceipt())
      setReceiptError('')
      setNotice({ type: 'success', message: result.message || 'Company Profit released successfully.' })
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] })
    },
    onError: (err) => setNotice({ type: 'error', message: err.message || 'Company Profit release failed. Nothing was released.' }),
  })
  return <section className={embedded ? "bg-white" : "overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"}>
    <div className={embedded ? 'pb-3' : 'border-b border-slate-200 p-5'}>
      <h2 className={embedded ? 'text-sm font-black text-slate-950' : 'text-lg font-black text-slate-950'}>Network Company Profit Information</h2>
      <p className="mt-1 text-xs font-semibold text-slate-500">Company-owned profit, separate from personal seller commissions. Payments go to the saved Network/Realty payee.</p>
    </div>
    <div className={embedded ? 'space-y-4' : 'space-y-4 p-5'}>
      {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)}/> : null}
      {!embedded && isError ? <StatusAlert type="error" message={error?.message || 'Could not load Network Company Profit records.'} /> : null}
      {!embedded && isLoading ? <p className="text-sm text-slate-500">Loading Network Company Profit...</p> : null}
      {!embedded && !isLoading && !isError && records.length === 0 ? <p className="text-sm text-slate-500">No saved In-House Network Company Profit allocations for this project.</p> : null}
      {embedded && profitRecord ? <article className="space-y-5">
        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-4">
          {[
            ['Network / Realty', profitRecord.network],
            ['Registered Payee', profitRecord.payee],
            ['Broker', profitRecord.broker],
            ['Buyer', profitRecord.buyer],
            ['Unit', profitRecord.unit],
            ['Commission Base', money(profitRecord.commissionBase)],
            ['Company Profit Rate', `${Number(profitRecord.companyProfitRate || 0).toFixed(4)}%`],
            ['Total Company Profit', money(profitRecord.totalProfit)],
            ['Released', money(profitRecord.released)],
            ['Remaining', money(profitRecord.remaining)],
            ['Account Reference', profitRecord.accountReference || '-'],
            ['Project', profitRecord.project || '-'],
          ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
            <p className="mt-1 text-sm font-black text-slate-950">{value || '-'}</p>
          </div>)}
        </div>
        <section>
          <h3 className="mb-3 text-sm font-black text-slate-950">Company Profit Release Milestones</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[800px] divide-y divide-slate-200 text-xs">
              <thead className="bg-slate-50"><tr>
                {['Stage', 'Trigger %', 'Release %', 'Amount', 'Status', 'Actions'].map((heading) => <th key={heading} className="px-4 py-3 text-left font-black text-slate-700">{heading}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {profitRecord.stages.map((stage) => <tr key={stage.id}>
                  <td className="px-4 py-3 font-black text-slate-900">{stage.stage}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{stage.stage === 'Retention' ? '-' : `${Number(stage.triggerPercent)}%`}</td>
                  <td className="px-4 py-3 font-semibold text-slate-600">{Number(stage.releasePercent)}%</td>
                  <td className="px-4 py-3 font-black text-slate-900">{money(stage.amount)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 font-black ${stage.status === 'Released' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : stage.canRelease ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>
                      {stage.status === 'Released' ? 'Completed' : stage.canRelease ? 'Eligible' : stage.status === 'On Hold' ? 'On Hold' : 'Not Eligible'}
                    </span>
                    {stage.actualReleaseDate ? <p className="mt-1 text-[10px] font-semibold text-slate-500">{String(stage.actualReleaseDate).slice(0, 10)}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {stage.status === 'Released' ? <>
                        <button type="button" onClick={() => setPrintChoice({ profit: profitRecord, stage })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-black"><FiPrinter className="mr-1 inline"/>Print Acknowledgment</button>
                        <button type="button" onClick={() => setSignedChoice({ profit: profitRecord, stage })} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-black"><FiFileText className="mr-1 inline"/>Signed Copy</button>
                      </> : canRelease && stage.canRelease ?
                        <button type="button" onClick={() => { setReleaseChoice({ profit: profitRecord, stage }); setReceiptDetails(emptyReleaseReceipt()); setReceiptError(''); setNotice(null) }} className="rounded-lg bg-blue-700 px-3 py-1.5 font-black text-white">Release</button>
                        : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </section>
      </article> : null}
      {!embedded && records.map((profit) => <article key={profit.id} className="rounded-xl border border-slate-200 p-4">
        <div className="flex flex-wrap justify-between gap-3">
          <div><h3 className="font-black text-slate-900">{profit.unit} · {profit.network}</h3>
            <p className="text-sm text-slate-600">{profit.buyer} · Payee: {profit.payee} · Rate: {profit.companyProfitRate.toFixed(4)}%</p>
          </div>
          <div className="text-right"><p className="font-black text-slate-900">{money(profit.totalProfit)}</p>
            <p className="text-xs text-emerald-700">Released: {money(profit.released)}</p><p className="text-xs text-slate-500">Remaining: {money(profit.remaining)}</p></div>
        </div>
        <div className="mt-4 grid gap-2 lg:grid-cols-5">
          {profit.stages.map((stage) => <div key={stage.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-black">{stage.stage}</p><p className="text-xs text-slate-500">{stage.releasePercent}% · {money(stage.amount)}</p>
            <p className={`mt-2 text-xs font-bold ${stage.status === 'Released' ? 'text-emerald-700' : stage.canRelease ? 'text-blue-700' : 'text-amber-700'}`}>
              {stage.status === 'Released' ? 'Released' : stage.canRelease ? 'Eligible' : 'Not eligible / On hold'}
            </p>
            {stage.status === 'Released' ? <div className="mt-2 flex flex-wrap gap-1">
              <button type="button" onClick={() => setPrintChoice({ profit, stage })} className="rounded border bg-white px-2 py-1 text-xs font-bold"><FiPrinter className="mr-1 inline"/>Print</button>
              <button type="button" onClick={() => setSignedChoice({ profit, stage })} className="rounded border bg-white px-2 py-1 text-xs font-bold"><FiFileText className="mr-1 inline"/>Signed Copy</button>
            </div> : canRelease && stage.canRelease ? <button type="button" onClick={() => { setReleaseChoice({ profit, stage }); setReceiptDetails(emptyReleaseReceipt()); setReceiptError(''); setNotice(null) }} className="mt-2 rounded bg-blue-700 px-3 py-1.5 text-xs font-bold text-white">Release</button> : null}
          </div>)}
        </div>
      </article>)}
    </div>
    {releaseChoice ? <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-black">Release Network Company Profit</h3>
        <p className="mt-1 text-sm">{releaseChoice.profit.unit} · {releaseChoice.stage.stage} · <strong>{money(releaseChoice.stage.amount)}</strong></p>
        <p className="mt-2 text-sm text-slate-600">Recipient: <strong>{releaseChoice.profit.payee}</strong>. This is the Network's payout, not the Head's personal commission.</p>
        <label className="mt-4 block text-sm font-bold">Payment Method<select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option></select></label>
        <ReleaseReceiptFields value={receiptDetails} onChange={(next) => { setReceiptDetails(next); setReceiptError('') }} />
        {receiptError ? <p role="alert" className="mt-2 text-sm font-bold text-red-700">{receiptError}</p> : null}
        <p className="mt-3 text-xs text-amber-800"><FiShield className="mr-1 inline"/> This release requires Final Double-Check and is recorded in Audit Logs and the Head Review Center.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReleaseChoice(null)} disabled={mutation.isPending} className="rounded-lg border px-4 py-2">Cancel</button>
          <button type="button" disabled={mutation.isPending} onClick={() => {
            const problem = validateReleaseReceipt(receiptDetails)
            if (problem) { setReceiptError(problem); return }
            mutation.mutate({ ...releaseChoice, paymentMethod: method, paymentReference: receiptDetails.referenceNumber.trim(), receiptDetails })
          }} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">{mutation.isPending ? 'Saving...' : 'Review & Release'}</button></div>
      </div>
    </div> : null}
    {printChoice ? <NetworkProfitAcknowledgement {...printChoice} onClose={() => setPrintChoice(null)}/> : null}
    {signedChoice ? <SignedCopyUploadModal title="Network Company Profit Acknowledgment"
      description="View or upload the signed acknowledgment for this specific Network Profit release. Only security-approved files can be opened."
      recordLabel={`NCP-${signedChoice.stage.id} · ${signedChoice.profit.network}`}
      category="Signed Network Company Profit" readOnly={!canRelease}
      basePath={`/projects/lot-projects/${projectSlug}/network-company-profit/${signedChoice.profit.id}/releases/${signedChoice.stage.id}/signed-copy`}
      onClose={() => setSignedChoice(null)} /> : null}
  </section>
}
