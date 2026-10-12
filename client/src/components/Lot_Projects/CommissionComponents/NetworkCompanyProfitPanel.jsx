import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiFileText, FiPrinter, FiShield, FiX } from 'react-icons/fi'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import SignedCopyUploadModal from '../../Shared/SignedCopyUploadModal'
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

export default function NetworkCompanyProfitPanel({ projectSlug, canRelease = false }) {
  const queryClient = useQueryClient()
  const [releaseChoice, setReleaseChoice] = useState(null)
  const [method, setMethod] = useState('bank_transfer')
  const [reference, setReference] = useState('')
  const [signedChoice, setSignedChoice] = useState(null)
  const [printChoice, setPrintChoice] = useState(null)
  const [notice, setNotice] = useState(null)
  const queryKey = useMemo(() => ['network-company-profit', projectSlug], [projectSlug])
  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/network-company-profit`),
    enabled: Boolean(projectSlug),
  })
  const records = data?.data || []
  const mutation = useMutation({
    mutationFn: ({ profit, stage, paymentMethod, paymentReference }) => useFetchPost(
      `/projects/lot-projects/${projectSlug}/network-company-profit/${profit.id}/releases/${stage.id}`,
      { paymentMethod, paymentReference },
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
      setReference('')
      setNotice({ type: 'success', message: result.message || 'Company Profit released successfully.' })
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] })
    },
    onError: (err) => setNotice({ type: 'error', message: err.message || 'Company Profit release failed. Nothing was released.' }),
  })
  return <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 p-5">
      <h2 className="text-lg font-black text-slate-950">Network Company Profit</h2>
      <p className="mt-1 text-sm text-slate-600">Separate from personal seller commissions. Released only to the saved Network/Realty payee, with its own audit trail and signed acknowledgment.</p>
    </div>
    <div className="space-y-4 p-5">
      {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)}/> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Could not load Network Company Profit records.'} /> : null}
      {isLoading ? <p className="text-sm text-slate-500">Loading Network Company Profit...</p> : null}
      {!isLoading && !isError && records.length === 0 ? <p className="text-sm text-slate-500">No saved In-House Network Company Profit allocations for this project.</p> : null}
      {records.map((profit) => <article key={profit.id} className="rounded-xl border border-slate-200 p-4">
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
            </div> : canRelease && stage.canRelease ? <button type="button" onClick={() => { setReleaseChoice({ profit, stage }); setNotice(null) }} className="mt-2 rounded bg-blue-700 px-3 py-1.5 text-xs font-bold text-white">Release</button> : null}
          </div>)}
        </div>
      </article>)}
    </div>
    {releaseChoice ? <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h3 className="text-lg font-black">Release Network Company Profit</h3>
        <p className="mt-1 text-sm">{releaseChoice.profit.unit} · {releaseChoice.stage.stage} · <strong>{money(releaseChoice.stage.amount)}</strong></p>
        <p className="mt-2 text-sm text-slate-600">Recipient: <strong>{releaseChoice.profit.payee}</strong>. This is the Network's payout, not the Head's personal commission.</p>
        <label className="mt-4 block text-sm font-bold">Payment Method<select value={method} onChange={(e) => setMethod(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="bank_transfer">Bank Transfer</option><option value="cash">Cash</option><option value="check">Check</option><option value="other">Other</option></select></label>
        <label className="mt-4 block text-sm font-bold">Payment Reference<input value={reference} maxLength={120} onChange={(e) => setReference(e.target.value)} placeholder="Transfer, check, or cash voucher reference" className="mt-1 w-full rounded-lg border p-3" /></label>
        <p className="mt-3 text-xs text-amber-800"><FiShield className="mr-1 inline"/> This release requires Final Double-Check and is recorded in Audit Logs and the Head Review Center.</p>
        <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setReleaseChoice(null)} disabled={mutation.isPending} className="rounded-lg border px-4 py-2">Cancel</button>
          <button type="button" disabled={!reference.trim() || mutation.isPending} onClick={() => mutation.mutate({ ...releaseChoice, paymentMethod: method, paymentReference: reference.trim() })} className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white disabled:opacity-40">{mutation.isPending ? 'Saving...' : 'Review & Release'}</button></div>
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
