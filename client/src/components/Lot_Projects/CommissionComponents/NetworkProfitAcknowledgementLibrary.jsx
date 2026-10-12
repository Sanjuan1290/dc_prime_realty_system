import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiFileText, FiPrinter, FiX } from 'react-icons/fi'
import { useFetch } from '../../../utils/useFetch'
import StatusAlert from '../../Shared/StatusAlert'
import SignedCopyUploadModal from '../../Shared/SignedCopyUploadModal'
import { NetworkProfitAcknowledgement } from './NetworkCompanyProfitPanel'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

export default function NetworkProfitAcknowledgementLibrary({ canViewFiles = false, canUpload = false, onClose }) {
  const [printChoice, setPrintChoice] = useState(null)
  const [signedChoice, setSignedChoice] = useState(null)
  const [search, setSearch] = useState('')
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['network-company-profit-acknowledgments'],
    queryFn: () => useFetch('/accredited/network-company-profit-acknowledgments'),
  })
  const records = (data?.data || []).filter(({ profit, stage }) =>
    [profit.network, profit.project, profit.unit, profit.buyer, stage.paymentReference]
      .some((v) => String(v || '').toLowerCase().includes(search.toLowerCase()))
  )
  return <div className="fixed inset-0 z-[75] overflow-y-auto bg-slate-950/60 p-4">
    <div className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-xl">
      <header className="mb-5 flex justify-between gap-4"><div>
        <h2 className="text-xl font-black">Network Company Profit Acknowledgments</h2>
        <p className="mt-1 text-sm text-slate-600">Company share releases and signed acknowledgments. Individual seller Proof of Income remains separate.</p>
      </div><button type="button" onClick={onClose} className="rounded border px-3 py-2" aria-label="Close Network Company Profit"><FiX/></button></header>
      <input aria-label="Search Company Profit acknowledgments" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Network, project, unit, buyer, reference..." className="mb-4 w-full rounded-lg border p-3" />
      {isLoading ? <p>Loading release acknowledgments...</p> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Could not load acknowledgments.'} /> : null}
      {!isLoading && !isError && !records.length ? <p className="text-sm text-slate-500">No released Company Profit acknowledgments were found.</p> : null}
      <div className="space-y-2">{records.map(({ profit, stage }) => <div key={stage.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
        <div><p className="font-bold">{profit.network} · {profit.unit} · {stage.stage}</p>
          <p className="text-sm text-slate-600">{profit.project} · {profit.buyer} · Payee: {stage.payeeName || profit.payee}</p>
          <p className="text-xs text-slate-500">NCP-{stage.id} · {String(stage.actualReleaseDate || '').slice(0,10)} · {stage.paymentReference}</p></div>
        <div className="flex items-center gap-2"><span className="font-black">{money(stage.amount)}</span>
          <button type="button" onClick={() => setPrintChoice({ profit, stage })} className="rounded border px-3 py-2 text-sm font-bold"><FiPrinter className="mr-1 inline"/>Print</button>
          {canViewFiles ? <button type="button" onClick={() => setSignedChoice({ profit, stage })} className="rounded border px-3 py-2 text-sm font-bold"><FiFileText className="mr-1 inline"/>Signed</button> : null}
        </div>
      </div>)}</div>
    </div>
    {printChoice ? <NetworkProfitAcknowledgement {...printChoice} onClose={() => setPrintChoice(null)} /> : null}
    {signedChoice ? <SignedCopyUploadModal
      title="Network Company Profit Acknowledgment" recordLabel={`NCP-${signedChoice.stage.id}`}
      description="Manage the signed acknowledgment for this Network's Company Profit release."
      category="Signed Network Company Profit"
      basePath={`/projects/lot-projects/${signedChoice.profit.projectSlug}/network-company-profit/${signedChoice.profit.id}/releases/${signedChoice.stage.id}/signed-copy`}
      readOnly={!canUpload} onClose={() => setSignedChoice(null)}/>: null}
  </div>
}
