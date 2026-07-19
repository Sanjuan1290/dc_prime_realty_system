import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import PrintPageShell from './PrintPageShell'
import { money, formatDate } from './printUtils'
import { useFetch } from '../../../../utils/useFetch'

const numberValue = (value) =>
  new Intl.NumberFormat('en-PH', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(Number(value || 0))


const todayDateOnly = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())

const statusTone = (status = '') => {
  const value = String(status || '').toLowerCase()
  if (value.includes('available')) return 'text-emerald-700'
  if (value.includes('hold')) return 'text-amber-700'
  if (value.includes('cancel')) return 'text-red-700'
  return 'text-blue-700'
}

const ProjectPriceListPrintPage = () => {
  const { projectSlug } = useParams()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lot-project-price-list', projectSlug],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/price-list`),
    enabled: Boolean(projectSlug),
  })

  const payload = data?.data || {}
  const project = payload.project || {}
  const listings = payload.listings || []

  useEffect(() => {
    if (project?.name) document.title = `${project.name} Price List`
  }, [project?.name])

  if (isLoading) {
    return <PrintPageShell title="Project Price List"><div className="p-6 text-sm font-semibold text-slate-600">Loading price list...</div></PrintPageShell>
  }

  if (isError) {
    return <PrintPageShell title="Project Price List"><div className="p-6 text-sm font-semibold text-red-700">{error?.message || 'Failed to load price list.'}</div></PrintPageShell>
  }

  return (
    <PrintPageShell title="Project Unit Price List">
      <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white p-[10mm] text-black shadow-lg print:shadow-none">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.24em]">D&amp;C Prime Realty</p>
            <h1 className="mt-1 text-2xl font-black uppercase">Project Unit Price List</h1>
            <p className="mt-1 text-sm font-bold">{project.name || 'Lot Project'}</p>
            <p className="text-xs font-semibold">{project.location || '-'}</p>
          </div>
          <div className="text-right text-xs font-semibold">
            <p>Printed: {formatDate(payload.printedAt || todayDateOnly())}</p>
            <p>Project Code: {project.locationCode || '-'}</p>
            <p>Total Units: {listings.length}</p>
          </div>
        </div>

        <div className="mt-4 overflow-hidden border border-black">
          <table className="w-full border-collapse text-[8px]">
            <thead>
              <tr className="bg-slate-200 text-left font-black uppercase">
                <th className="border border-black px-1 py-1 text-center">#</th>
                <th className="border border-black px-1 py-1">Unit ID</th>
                <th className="border border-black px-1 py-1">Type</th>
                <th className="border border-black px-1 py-1 text-right">Area SQM</th>
                <th className="border border-black px-1 py-1 text-right">Installment / SQM</th>
                <th className="border border-black px-1 py-1 text-right">Cash / SQM</th>
                <th className="border border-black px-1 py-1 text-right">Installment TCP</th>
                <th className="border border-black px-1 py-1 text-right">Cash TCP</th>
                <th className="border border-black px-1 py-1 text-right">LMF Rate</th>
                <th className="border border-black px-1 py-1 text-right">Reservation</th>
                <th className="border border-black px-1 py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {listings.length ? listings.map((listing, index) => (
                <tr key={listing.id || listing.unitCode}>
                  <td className="border border-black px-1 py-1 text-center font-bold">{index + 1}</td>
                  <td className="border border-black px-1 py-1 font-black">{listing.unitCode || '-'}</td>
                  <td className="border border-black px-1 py-1">{listing.lotType || '-'}</td>
                  <td className="border border-black px-1 py-1 text-right">{numberValue(listing.area)}</td>
                  <td className="border border-black px-1 py-1 text-right">{money(listing.installmentPricePerSqm ?? listing.pricePerSqm)}</td>
                  <td className="border border-black px-1 py-1 text-right">{money(listing.cashPricePerSqm ?? listing.pricePerSqm)}</td>
                  <td className="border border-black px-1 py-1 text-right font-black">{money(listing.installmentTcp ?? listing.tcp)}</td>
                  <td className="border border-black px-1 py-1 text-right font-black">{money(listing.cashTcp ?? listing.tcp)}</td>
                  <td className="border border-black px-1 py-1 text-right">{Number(listing.lmfRate || 0)}%</td>
                  <td className="border border-black px-1 py-1 text-right">{money(listing.reservationFee)}</td>
                  <td className={`border border-black px-1 py-1 font-black ${statusTone(listing.status)}`}>{listing.status || '-'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={11} className="border border-black px-2 py-8 text-center text-sm font-bold">No listings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PrintPageShell>
  )
}

export default ProjectPriceListPrintPage

