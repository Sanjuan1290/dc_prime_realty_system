import { useMemo, useState } from 'react'
import { FiDollarSign, FiEye, FiRefreshCw, FiSearch } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReleaseDetailsModal from '../../components/Lot_Projects/CommissionComponents/ReleaseDetailsModal/ReleaseDetailsModal'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const commissionRecords = [
  {
    id: 1,
    client: 'robert',
    unit: 'LA-0402',
    project: 'Bailen Project',
    seller: 'Rowena Cortez',
    role: 'Broker Network Manager',
    sellerType: 'Main Seller',
    saleType: 'Distributed',
    hierarchyLevel: 'BNM',
    commissionBase: 360000,
    rate: 8,
    grossCommission: 28800,
    released: 0,
    cashAdvanceDeduction: 0,
    netRemaining: 28800,
    tcp: 396000,
    paid: 200000,
    paymentPercent: 50.51,
    status: 'Eligible',
  },
  {
    id: 2,
    client: 'robert',
    unit: 'LA-0402',
    project: 'Bailen Project',
    seller: 'Leo Santos',
    role: 'Broker',
    sellerType: 'Hierarchy Seller',
    saleType: 'Distributed',
    hierarchyLevel: 'Broker',
    commissionBase: 360000,
    rate: 7,
    grossCommission: 25200,
    released: 0,
    cashAdvanceDeduction: 0,
    netRemaining: 25200,
    tcp: 396000,
    paid: 200000,
    paymentPercent: 50.51,
    status: 'Eligible',
  },
  {
    id: 3,
    client: 'robert',
    unit: 'LA-0402',
    project: 'Bailen Project',
    seller: 'Maria Lopez',
    role: 'Manager',
    sellerType: 'Hierarchy Seller',
    saleType: 'Distributed',
    hierarchyLevel: 'Manager',
    commissionBase: 360000,
    rate: 5,
    grossCommission: 18000,
    released: 0,
    cashAdvanceDeduction: 0,
    netRemaining: 18000,
    tcp: 396000,
    paid: 200000,
    paymentPercent: 50.51,
    status: 'Eligible',
  },
  {
    id: 4,
    client: 'robert',
    unit: 'LA-0402',
    project: 'Bailen Project',
    seller: 'Ana Garcia',
    role: 'Agent',
    sellerType: 'Selling Agent',
    saleType: 'Distributed',
    hierarchyLevel: 'Agent',
    commissionBase: 360000,
    rate: 3,
    grossCommission: 10800,
    released: 0,
    cashAdvanceDeduction: 0,
    netRemaining: 10800,
    tcp: 396000,
    paid: 200000,
    paymentPercent: 50.51,
    status: 'Eligible',
  },
  {
    id: 5,
    client: 'Mika Fernandez',
    unit: 'LA-0501',
    project: 'Bailen Project',
    seller: 'Nico Reyes',
    role: 'Agent',
    sellerType: 'Selling Agent',
    saleType: 'Direct',
    hierarchyLevel: 'Agent',
    commissionBase: 702000,
    rate: 3,
    grossCommission: 21060,
    released: 4212,
    cashAdvanceDeduction: 0,
    netRemaining: 16848,
    tcp: 772200,
    paid: 386100,
    paymentPercent: 50,
    status: 'Partially Released',
  },
]

const StatusPill = ({ status }) => {
  const styles = {
    Eligible: 'border-blue-200 bg-blue-50 text-blue-700',
    Pending: 'border-amber-200 bg-amber-50 text-amber-700',
    Released: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    'Partially Released': 'border-indigo-200 bg-indigo-50 text-indigo-700',
    Cancelled: 'border-red-200 bg-red-50 text-red-700',
    'On Hold': 'border-slate-200 bg-slate-100 text-slate-600',
  }

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${
        styles[status] || styles.Pending
      }`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  )
}

const StatCard = ({ label, value, tone = 'slate', isMoney = true }) => {
  const styles = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  }

  return (
    <div className={`rounded-2xl border border-slate-200 p-5 shadow-sm ${styles[tone]}`}>
      <p className="text-sm font-black text-slate-500">{label}</p>
      <p className="mt-3 text-2xl font-black">
        {isMoney ? money(value) : value}
      </p>
    </div>
  )
}

const Commission = () => {
  const [records, setRecords] = useState(commissionRecords)
  const [selected, setSelected] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [saleTypeFilter, setSaleTypeFilter] = useState('all')
  const [alert, setAlert] = useState(null)

  const filteredRecords = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return records.filter((record) => {
      const matchesSearch =
        !keyword ||
        `${record.client} ${record.unit} ${record.project} ${record.seller} ${record.role} ${record.hierarchyLevel}`
          .toLowerCase()
          .includes(keyword)

      const matchesStatus =
        statusFilter === 'all' || record.status === statusFilter

      const matchesSaleType =
        saleTypeFilter === 'all' || record.saleType === saleTypeFilter

      return matchesSearch && matchesStatus && matchesSaleType
    })
  }, [records, search, statusFilter, saleTypeFilter])

  const stats = useMemo(() => {
    const gross = records.reduce((sum, item) => sum + Number(item.grossCommission || 0), 0)
    const released = records.reduce((sum, item) => sum + Number(item.released || 0), 0)
    const remaining = records.reduce((sum, item) => sum + Number(item.netRemaining || 0), 0)

    return {
      total: records.length,
      gross,
      released,
      remaining,
    }
  }, [records])

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setSaleTypeFilter('all')
    setAlert({
      type: 'info',
      message: 'Commission filters reset.',
    })
  }

  const handleUpdateCommission = (updatedRecord, message, type = 'success') => {
    setRecords((current) =>
      current.map((item) => (item.id === updatedRecord.id ? updatedRecord : item))
    )

    setSelected(updatedRecord)

    setAlert({
      type,
      message,
    })
  }

  return (
    <main className="flex flex-col gap-6">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
        />
      ) : null}

      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Bailen Commissions"
          description="Each seller in the hierarchy has their own commission record per unit."
          icon={FiDollarSign}
        />

        <button
          type="button"
          onClick={resetFilters}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
        >
          <FiRefreshCw className="h-4 w-4" />
          Reset View
        </button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Commission Records" value={stats.total} isMoney={false} />
        <StatCard label="Gross Commission" value={stats.gross} tone="blue" />
        <StatCard label="Released" value={stats.released} tone="emerald" />
        <StatCard label="Net Remaining" value={stats.remaining} tone="amber" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 xl:grid-cols-[1fr_220px_220px_auto]">
          <label className="relative">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search client, unit, seller, role..."
              className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Statuses</option>
            <option value="Eligible">Eligible</option>
            <option value="Pending">Pending</option>
            <option value="Partially Released">Partially Released</option>
            <option value="Released">Released</option>
            <option value="On Hold">On Hold</option>
            <option value="Cancelled">Cancelled</option>
          </select>

          <select
            value={saleTypeFilter}
            onChange={(event) => setSaleTypeFilter(event.target.value)}
            className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Sale Types</option>
            <option value="Distributed">Distributed</option>
            <option value="Direct">Direct</option>
          </select>

          <button
            type="button"
            onClick={resetFilters}
            className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Reset Filters
          </button>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-white px-5 py-4">
          <h2 className="text-lg font-black text-slate-950">Commission Records</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            One unit can appear multiple times because every qualified seller receives a separate commission line.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1300px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Unit',
                  'Client',
                  'Seller',
                  'Role',
                  'Level',
                  'Sale Type',
                  'Commission Base',
                  'Rate',
                  'Gross',
                  'Released',
                  'Net Remaining',
                  'Payment %',
                  'Status',
                  'Actions',
                ].map((head) => (
                  <th
                    key={head}
                    className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filteredRecords.map((record) => (
                <tr key={record.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-blue-700">
                    {record.unit}
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {record.client}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-700">
                    {record.seller}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {record.role}
                  </td>

                  <td className="px-4 py-4">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                      {record.hierarchyLevel}
                    </span>
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {record.saleType}
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {money(record.commissionBase)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {record.rate}%
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {money(record.grossCommission)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-emerald-700">
                    {money(record.released)}
                  </td>

                  <td className="px-4 py-4 font-black text-blue-700">
                    {money(record.netRemaining)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {Number(record.paymentPercent || 0).toFixed(2)}%
                  </td>

                  <td className="px-4 py-4">
                    <StatusPill status={record.status} />
                  </td>

                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(record)
                        setAlert({
                          type: 'info',
                          message: `Opening commission details for ${record.seller} - ${record.unit}.`,
                        })
                      }}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      Details
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredRecords.length ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center">
                    <FiDollarSign className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      No commission records found
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Try changing your search or filters.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing 1-{filteredRecords.length} of {filteredRecords.length} records
          </p>

          <div className="flex items-center gap-2">
            <select className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
              <option>10</option>
              <option>20</option>
              <option>50</option>
            </select>

            <button className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-400">
              Previous
            </button>

            <span className="h-9 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700">
              Page 1 of 1
            </span>

            <button className="h-9 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-400">
              Next
            </button>
          </div>
        </div>
      </section>

      {selected ? (
        <ReleaseDetailsModal
          commission={selected}
          onClose={() => setSelected(null)}
          onUpdate={handleUpdateCommission}
        />
      ) : null}
    </main>
  )
}

export default Commission