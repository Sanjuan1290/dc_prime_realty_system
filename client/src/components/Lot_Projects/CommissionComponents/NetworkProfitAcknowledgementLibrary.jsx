import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { FiFileText, FiPrinter, FiX, FiSearch } from 'react-icons/fi'
import { useFetch } from '../../../utils/useFetch'
import StatusAlert from '../../Shared/StatusAlert'
import SignedCopyUploadModal from '../../Shared/SignedCopyUploadModal'
import { NetworkProfitAcknowledgement } from './NetworkCompanyProfitPanel'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

export default function NetworkProfitAcknowledgementLibrary({ canViewFiles = false, canUpload = false, onClose, embedded = false }) {
  const [printChoice, setPrintChoice] = useState(null)
  const [signedChoice, setSignedChoice] = useState(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['network-company-profit-acknowledgments'],
    queryFn: () => useFetch('/accredited/network-company-profit-acknowledgments'),
  })
  const records = (data?.data || []).filter(({ profit, stage }) =>
    [profit.network, profit.project, profit.unit, profit.buyer, stage.paymentReference]
      .some((v) => String(v || '').toLowerCase().includes(search.toLowerCase()))
  )
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const activePage = Math.min(page, totalPages)
  const pageRecords = records.slice((activePage - 1) * pageSize, activePage * pageSize)
  return <div className={embedded ? "rounded-2xl border border-slate-200 bg-white shadow-sm" : "fixed inset-0 z-[75] overflow-y-auto bg-slate-950/60 p-4"}>
    <div className={embedded ? "" : "mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-xl"}>
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-4"><div>
        <h2 className="text-xl font-black">Proof of Income &amp; Network Company Profit</h2>
        <p className="mt-1 text-sm text-slate-600">Network Company Profit releases and acknowledgment documents, in the same table layout as Seller Directory. Individual seller Proof of Income remains beside each seller.</p>
      </div>{!embedded && onClose ? <button type="button" onClick={onClose} className="rounded border px-3 py-2" aria-label="Close Network Company Profit"><FiX/></button> : null}</header>
      <div className="p-4">
        <label className="relative block max-w-sm">
          <FiSearch className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input aria-label="Search Company Profit acknowledgments" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search Network, project, unit, buyer, reference..." className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm" />
        </label>
      </div>
      {isLoading ? <p className="px-4 py-7 text-sm text-slate-500">Loading release acknowledgments...</p> : null}
      {isError ? <div className="p-4"><StatusAlert type="error" message={error?.message || 'Could not load acknowledgments.'} /></div> : null}
      {!isLoading && !isError && !records.length ? <p className="px-4 py-7 text-sm text-slate-500">No released Company Profit acknowledgments were found.</p> : null}
      <div className="overflow-x-auto">
        <table className="min-w-[990px] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs font-black uppercase tracking-wide text-slate-500">
            <tr>{['Network / Realty', 'Project / Unit', 'Buyer', 'Payee', 'Milestone', 'Release Date', 'Amount', 'Actions'].map((column) =>
              <th key={column} className="border-y border-slate-200 px-4 py-3">{column}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{pageRecords.map(({ profit, stage }) =>
            <tr key={stage.id} className="hover:bg-slate-50">
              <td className="px-4 py-4 font-black text-slate-950">{profit.network}<p className="text-xs font-medium text-slate-500">NCP-{stage.id}</p></td>
              <td className="px-4 py-4 font-semibold text-slate-700">{profit.project}<p className="text-xs text-slate-500">{profit.unit}</p></td>
              <td className="px-4 py-4 text-slate-700">{profit.buyer || '-'}</td>
              <td className="px-4 py-4 text-slate-700">{stage.payeeName || profit.payee}</td>
              <td className="px-4 py-4 text-slate-700">{stage.stage}<p className="text-xs text-slate-500">{stage.paymentReference || '-'}</p></td>
              <td className="px-4 py-4 text-slate-700">{String(stage.actualReleaseDate || '').slice(0,10)}</td>
              <td className="px-4 py-4 font-black text-slate-900">{money(stage.amount)}</td>
              <td className="px-4 py-4"><div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setPrintChoice({ profit, stage })} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><FiPrinter/>Print</button>
                {canViewFiles ? <button type="button" onClick={() => setSignedChoice({ profit, stage })} className="inline-flex items-center gap-1 rounded-lg border px-3 py-2 text-xs font-bold"><FiFileText/>Signed Copy</button> : null}
              </div></td>
            </tr>)}</tbody>
        </table>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
        <p className="text-xs font-semibold text-slate-500">Showing page {activePage} of {totalPages} · {records.length} release records</p>
        <div className="flex items-center gap-2">
          <select aria-label="Company Profit records per page" value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1) }} className="rounded-lg border border-slate-200 bg-white p-2 text-xs font-bold"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select>
          <button type="button" disabled={activePage === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Prev</button>
          <button type="button" disabled={activePage === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40">Next</button>
        </div>
      </footer>
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
