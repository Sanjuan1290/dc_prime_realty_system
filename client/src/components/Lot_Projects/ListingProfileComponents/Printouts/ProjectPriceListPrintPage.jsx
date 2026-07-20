import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import PrintPageShell from './PrintPageShell'
import { money, formatDate } from './printUtils'
import { useFetch as fetchJson } from '../../../../utils/useFetch'

const DEFAULT_STRAIGHT_PAYMENT_MONTHS = 20

const normalizeStraightPaymentMonths = (value) => {
  const months = Number(value || DEFAULT_STRAIGHT_PAYMENT_MONTHS)
  return Number.isInteger(months) && months >= 1 && months <= 120
    ? months
    : DEFAULT_STRAIGHT_PAYMENT_MONTHS
}

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
  if (value.includes('pending')) return 'text-orange-700'
  if (value.includes('cancel')) return 'text-red-700'
  if (value.includes('fully paid')) return 'text-violet-700'
  if (value.includes('sold')) return 'text-blue-700'
  return 'text-slate-700'
}

const getPriceListValues = (listing = {}, straightPaymentMonths = DEFAULT_STRAIGHT_PAYMENT_MONTHS) => {
  const area = Number(listing.area || 0)
  const cashPricePerSqm = Number(listing.cashPricePerSqm ?? listing.pricePerSqm ?? 0)
  const installmentPricePerSqm = Number(
    listing.installmentPricePerSqm ?? listing.pricePerSqm ?? 0
  )
  const cashSellingPrice = Number(
    listing.cashNetSellingPrice ?? area * cashPricePerSqm
  )
  const installmentSellingPrice = Number(
    listing.installmentNetSellingPrice ?? area * installmentPricePerSqm
  )
  const reservationFee = Number(listing.reservationFee || 0)
  const netAfterReservation = Math.max(installmentSellingPrice - reservationFee, 0)
  const straightPaymentMonthly =
    straightPaymentMonths > 0
      ? netAfterReservation / straightPaymentMonths
      : 0

  return {
    area,
    cashPricePerSqm,
    cashSellingPrice,
    installmentPricePerSqm,
    installmentSellingPrice,
    reservationFee,
    netAfterReservation,
    straightPaymentMonthly,
  }
}

const ProjectPriceListPrintPage = () => {
  const { projectSlug } = useParams()

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['lot-project-price-list', projectSlug],
    queryFn: () => fetchJson(`/projects/lot-projects/${projectSlug}/price-list`),
    enabled: Boolean(projectSlug),
  })

  const payload = data?.data || {}
  const project = payload.project || {}
  const listings = payload.listings || []
  const priceListDate = payload.printedAt || todayDateOnly()
  const straightPaymentMonths = normalizeStraightPaymentMonths(
    new URLSearchParams(window.location.search).get('straightPaymentMonths')
  )

  useEffect(() => {
    if (project?.name) document.title = `${project.name} Price Inventory`
  }, [project?.name])

  if (isLoading) {
    return <PrintPageShell title="Project Unit Price List" pageOrientation="landscape"><div className="p-6 text-sm font-semibold text-slate-600">Loading price list...</div></PrintPageShell>
  }

  if (isError) {
    return <PrintPageShell title="Project Unit Price List" pageOrientation="landscape"><div className="p-6 text-sm font-semibold text-red-700">{error?.message || 'Failed to load price list.'}</div></PrintPageShell>
  }

  return (
    <PrintPageShell title="Project Unit Price List" pageOrientation="landscape">
      <style>{`
        @media print {
          .project-price-list-table thead {
            display: table-header-group;
          }

          .project-price-list-table tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>

      <section className="print-page mx-auto min-h-[210mm] w-[297mm] bg-white p-[8mm] text-black shadow-lg print:shadow-none">
        <div className="border-b-2 border-black pb-3 text-center">
          <p className="text-[10px] font-black uppercase tracking-[0.22em]">D&amp;C Prime Realty</p>
          <h1 className="mt-1 text-xl font-black uppercase">
            {project.name || 'Lot Project'} Price Inventory
          </h1>
          <p className="mt-1 text-xs font-bold">
            As of {formatDate(priceListDate)}
          </p>
          <p className="text-[10px] font-semibold">
            {project.location || '-'} · Project Code: {project.locationCode || '-'} · Total Units: {listings.length}
          </p>
        </div>

        <div className="mt-4 overflow-hidden border border-black">
          <table className="project-price-list-table w-full table-fixed border-collapse text-[7px] leading-tight">
            <colgroup>
              <col className="w-[3%]" />
              <col className="w-[7%]" />
              <col className="w-[6%]" />
              <col className="w-[5%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
              <col className="w-[8%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
              <col className="w-[7%]" />
              <col className="w-[8%]" />
              <col className="w-[10%]" />
            </colgroup>
            <thead>
              <tr className="bg-slate-200 text-center font-black uppercase">
                <th className="border border-black px-1 py-1">No.</th>
                <th className="border border-black px-1 py-1">ID</th>
                <th className="border border-black px-1 py-1">Orientation</th>
                <th className="border border-black px-1 py-1">Lot Area</th>
                <th className="border border-black px-1 py-1">Cash Price per SQM</th>
                <th className="border border-black px-1 py-1">Cash Selling Price (w/o LMF)</th>
                <th className="border border-black px-1 py-1">Installment Price per SQM</th>
                <th className="border border-black px-1 py-1">Installment Selling Price (w/o LMF)</th>
                <th className="border border-black px-1 py-1">Reservation Fee</th>
                <th className="border border-black px-1 py-1">Net After Reservation</th>
                <th className="border border-black px-1 py-1">Straight Payment (Months)</th>
                <th className="border border-black px-1 py-1">Straight Payment (Monthly)</th>
                <th className="border border-black px-1 py-1">Listing Status</th>
              </tr>
            </thead>
            <tbody>
              {listings.length ? listings.map((listing, index) => {
                const values = getPriceListValues(listing, straightPaymentMonths)

                return (
                  <tr key={listing.id || listing.unitCode}>
                    <td className="border border-black px-1 py-1 text-center font-bold">{index + 1}</td>
                    <td className="border border-black px-1 py-1 text-center font-black">{listing.unitCode || '-'}</td>
                    <td className="border border-black px-1 py-1 text-center uppercase">{listing.lotType || '-'}</td>
                    <td className="border border-black px-1 py-1 text-right">{numberValue(values.area)}</td>
                    <td className="border border-black px-1 py-1 text-right font-bold">{money(values.cashPricePerSqm)}</td>
                    <td className="border border-black px-1 py-1 text-right">{money(values.cashSellingPrice)}</td>
                    <td className="border border-black px-1 py-1 text-right font-bold">{money(values.installmentPricePerSqm)}</td>
                    <td className="border border-black px-1 py-1 text-right">{money(values.installmentSellingPrice)}</td>
                    <td className="border border-black px-1 py-1 text-right font-bold">{money(values.reservationFee)}</td>
                    <td className="border border-black px-1 py-1 text-right">{money(values.netAfterReservation)}</td>
                    <td className="border border-black px-1 py-1 text-center">{straightPaymentMonths}</td>
                    <td className="border border-black px-1 py-1 text-right font-black">{money(values.straightPaymentMonthly)}</td>
                    <td className={`border border-black px-1 py-1 text-center font-black uppercase ${statusTone(listing.status)}`}>
                      {listing.status || '-'}
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td colSpan={13} className="border border-black px-2 py-8 text-center text-sm font-bold">No listings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="mt-2 text-[9px] font-semibold italic">
          Note: Prices are subject to change without prior notice. Straight-payment figures use the installment selling price without LMF, less the reservation fee, divided into {straightPaymentMonths} months.
        </p>
      </section>
    </PrintPageShell>
  )
}

export default ProjectPriceListPrintPage
