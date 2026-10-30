import { useMemo, useState } from 'react'
import { FiFileText, FiPrinter, FiSearch, FiX } from 'react-icons/fi'
import CommissionReceiptPreview from './CommissionReceiptPreview'
import SignedCopyUploadModal from '../../Shared/SignedCopyUploadModal'
import { profitReceiptProperties } from '../../../utils/networkProfitReceiptGroups'

const money = (value) => new Intl.NumberFormat('en-PH', {style:'currency',currency:'PHP'}).format(Number(value || 0))
const dateOnly = (value) => String(value || '').slice(0,10)
const receiptRow = ({ profit, stage }) => ({
  seller: { full_name: stage.payeeName || profit.payee, payee_name: stage.payeeName || profit.payee, role: 'network_company_profit' },
  receipt: { receiptDate: dateOnly(stage.receiptDate || stage.actualReleaseDate), bankName: stage.bankName,
    accountNumber: stage.accountNumber, referenceNumber: stage.paymentReference, witnessName: stage.witnessName,
    unitId: profit.unit, buyerName: profit.buyer, grossCommission: profit.totalProfit,
    commissionRate: profit.companyProfitRate, commissionRole: 'network_company_profit',
    totalAmount: stage.amount, releasePercent: Number(stage.releasePercent),
    cumulativeTargetPercent: Number(stage.triggerPercent),
    releases: [{stage:stage.stage, releasePercent: stage.releasePercent, triggerPercent: stage.triggerPercent}],
  },
})

export default function NetworkProfitProofOfIncomeModal({ group, canPrint = false, canViewFiles = false, canUpload = false, onClose }) {
  const properties = useMemo(() => profitReceiptProperties(group?.records), [group])
  const [propertyId, setPropertyId] = useState(() => String(properties[0]?.accountId || ''))
  const [selectedIds, setSelectedIds] = useState(null)
  const [search, setSearch] = useState('')
  const [printChoice, setPrintChoice] = useState(null)
  const [signedChoice, setSignedChoice] = useState(null)
  const property = properties.find((p) => String(p.accountId) === propertyId) || properties[0] || null
  const selected = useMemo(() => (property?.records || []).filter((row) =>
    selectedIds === null || selectedIds.includes(Number(row.stage.id))), [property, selectedIds])
  const selectedCents = selected.reduce((sum, row) => sum + Math.round(Number(row.stage.amount || 0) * 100), 0)
  const receiptSummary = useMemo(() => {
    if (!property || !selected.length) return null
    if (selected.length === 1) return receiptRow(selected[0])
    const profit = property.profit
    const dated = selected.map(({stage}) => dateOnly(stage.receiptDate || stage.actualReleaseDate)).sort()
    return {
      seller: { full_name: profit.payee, payee_name: profit.payee, role: 'network_company_profit' },
      receipt: {
        isConsolidatedSummary: true,
        receiptDate: dated.at(-1), bankName: 'See individual releases', accountNumber: 'See individual releases',
        referenceNumber: 'Multiple references', witnessName: '',
        unitId: profit.unit, buyerName: profit.buyer, grossCommission: profit.totalProfit,
        commissionRate: profit.companyProfitRate, commissionRole: 'network_company_profit',
        totalAmount: selectedCents / 100,
        releasePercent: selected.reduce((sum,row) => sum + Number(row.stage.releasePercent || 0), 0),
        cumulativeTargetPercent: Math.max(...selected.map(({stage}) => Number(stage.triggerPercent || 0))),
        releases: selected.map(({stage}) => ({
          stage: stage.stage, releasePercent: stage.releasePercent, triggerPercent: stage.triggerPercent,
          amount: stage.amount, actualReleaseDate: dateOnly(stage.actualReleaseDate),
          referenceNumber: stage.paymentReference,
        })),
      },
    }
  }, [property, selected, selectedCents])
  const filteredProperties = properties.filter((p) => [p.profit.project,p.profit.unit,p.profit.buyer,p.profit.accountReference]
    .some((value) => String(value || '').toLowerCase().includes(search.trim().toLowerCase())))
  const toggleStage = (id) => {
    const available = property?.records.map(({stage}) => Number(stage.id)) || []
    const current = selectedIds === null ? available : selectedIds
    setSelectedIds(current.includes(id) ? current.filter((item) => item !== id) : [...current,id])
  }
  return <div className="fixed inset-0 z-[90] overflow-y-auto bg-slate-950/65 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label="Print Proof of Income — Network Company Profit">
    <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-7">
        <div><h2 className="text-xl font-black text-slate-950">Print Proof of Income</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">{group.network} · {group.payee} · Combine released stages from one property into a printable summary.</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">Network Company Profit is separate from each seller's personal commission.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close Network Proof of Income" className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX/></button>
      </header>
      <div className="space-y-5 p-5 sm:p-7">
        <label className="relative block max-w-lg"><FiSearch className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400"/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search Unit ID, project, buyer or account reference" className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-3 text-sm" aria-label="Search Network Company Profit properties" />
        </label>
        <section className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            <h3 className="text-sm font-black text-slate-900">Released Company Profit by property</h3>
            {!filteredProperties.length ? <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-500">No matching released Company Profit.</p> : null}
            {filteredProperties.map((p) => <button key={p.accountId} type="button" onClick={() => { setPropertyId(String(p.accountId)); setSelectedIds(null) }}
              className={`block w-full rounded-xl border p-4 text-left ${property?.accountId === p.accountId ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <p className="font-black text-slate-900">{p.profit.project} · {p.profit.unit}</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">{p.profit.buyer} · {p.profit.accountReference || ''}</p>
              <p className="mt-2 text-xs font-black text-emerald-700">{p.records.length} released stage(s) · {money(p.records.reduce((sum,row) => sum + Number(row.stage.amount),0))}</p>
            </button>)}
          </div>
          <div className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-black text-slate-950">Selected Releases</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Choose existing paid stages from this buyer account only. No payments or receipt records will be created.</p>
            <div className="mt-3 space-y-2">{(property?.records || []).map(({stage}) =>
              <label key={stage.id} className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 p-3 text-sm">
                <span className="flex items-center gap-3"><input type="checkbox" checked={selectedIds === null || selectedIds.includes(Number(stage.id))} onChange={() => toggleStage(Number(stage.id))} />
                  <span><strong className="block">{stage.stage}</strong><span className="text-xs text-slate-500">{dateOnly(stage.actualReleaseDate)} · {stage.paymentReference || '-'}</span></span></span>
                <strong>{money(stage.amount)}</strong>
              </label>)}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-4"><span className="font-black">Selected Total</span><strong className="text-emerald-700">{money(selectedCents/100)}</strong></div>
            {selected.length > 1 ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-900">Multiple stages will print as a consolidated summary of already-issued acknowledgments. Each original receipt and signed copy remains separate.</p> : null}
            {canPrint ? <button type="button" disabled={!selected.length} onClick={() => setPrintChoice(receiptSummary)} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 p-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50"><FiPrinter/>Print Selected Releases — {money(selectedCents/100)}</button> : <p className="mt-4 text-xs text-amber-700">Printing requires Accredited Sellers print permission.</p>}
          </div>
        </section>
        <section>
          <h3 className="text-sm font-black text-slate-900">Generated receipt history</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Original payment acknowledgments and signed documents remain attached to each released milestone.</p>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[600px] text-left text-xs">
            <thead className="bg-slate-50 text-slate-500"><tr>{['Property','Stage / Reference','Date','Amount','Actions'].map((x) => <th key={x} className="p-3">{x}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">{(property?.records || []).map((record) =>
              <tr key={record.stage.id}><td className="p-3 font-bold">{record.profit.unit}</td><td className="p-3">{record.stage.stage}<p className="text-slate-500">{record.stage.paymentReference || '-'}</p></td>
                <td className="p-3">{dateOnly(record.stage.actualReleaseDate)}</td><td className="p-3 font-bold">{money(record.stage.amount)}</td>
                <td className="p-3"><div className="flex gap-2">{canPrint ? <button type="button" onClick={() => setPrintChoice(receiptRow(record))} className="rounded-lg border px-2 py-1 font-bold"><FiPrinter className="mr-1 inline"/>Print</button> : null}
                  {canViewFiles ? <button type="button" onClick={() => setSignedChoice(record)} className="rounded-lg border px-2 py-1 font-bold"><FiFileText className="mr-1 inline"/>Signed Copy</button> : null}</div></td>
              </tr>)}</tbody>
          </table></div>
        </section>
      </div>
      <footer className="border-t border-slate-200 p-4 text-right"><button type="button" onClick={onClose} className="rounded-lg border px-5 py-2 text-sm font-bold">Close</button></footer>
    </div>
    {printChoice ? <CommissionReceiptPreview seller={printChoice.seller} receipt={printChoice.receipt} onClose={() => setPrintChoice(null)}/> : null}
    {signedChoice ? <SignedCopyUploadModal
      title="Signed Network Company Profit Acknowledgment" category="Signed Network Company Profit"
      recordLabel={`NCP-${signedChoice.stage.id}`}
      description="Signed original for this specific released Company Profit milestone."
      basePath={`/projects/lot-projects/${signedChoice.profit.projectSlug}/network-company-profit/${signedChoice.profit.id}/releases/${signedChoice.stage.id}/signed-copy`}
      readOnly={!canUpload} onClose={() => setSignedChoice(null)} /> : null}
  </div>
}


