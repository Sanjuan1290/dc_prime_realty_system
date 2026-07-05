import { useMemo, useState } from 'react'
import {
  FiCheckCircle,
  FiCreditCard,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSearch,
} from 'react-icons/fi'
import AddSOAPaymentModal from './AddSOAPaymentModal'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const cleanMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,\s]/g, '')) || 0
}

const formatDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const getListingValue = (listing, keys, fallback = '') => {
  for (const key of keys) {
    if (
      listing?.[key] !== undefined &&
      listing?.[key] !== null &&
      listing?.[key] !== ''
    ) {
      return listing[key]
    }
  }

  return fallback
}

const normalizeRows = (rows = [], listing = {}) => {
  if (rows.length) {
    return rows.map((row, index) => ({
      id: row.id || index + 1,
      dueDate: row.dueDate || row.due_date || '',
      description: row.description || row.payment_description || '',
      beginningBalance: cleanMoney(row.beginningBalance ?? row.beginning_balance),
      dueAmount: cleanMoney(row.dueAmount ?? row.due_amount),
      interest: cleanMoney(row.interest ?? row.interestAmount ?? row.interest_amount),
      penalty: cleanMoney(row.penalty ?? row.penaltyAmount ?? row.penalty_amount),
      datePaid: row.datePaid || row.date_paid || '',
      amountPaid: cleanMoney(row.amountPaid ?? row.amount_paid),
      referenceId: row.referenceId || row.reference_id || row.reference || '-',
      paymentMethod: row.paymentMethod || row.payment_method || '-',
      verifiedBy: row.verifiedBy || row.verified_by || '-',
      status: row.status || 'Unpaid',
      endingBalance: cleanMoney(
        row.endingBalance ??
          row.remainingBalance ??
          row.runningBalance ??
          row.ending_balance
      ),
    }))
  }

  const tcp = cleanMoney(listing?.tcp || listing?.tcpAmount || 396000)
  const reservationFee = cleanMoney(listing?.reservationFee || 50000)
  const downpayment = cleanMoney(listing?.downpayment || 118800)
  const monthly = cleanMoney(listing?.monthlyAmortization || 6311)

  return [
    {
      id: 1,
      dueDate: '2026-07-01',
      description: 'Reservation Fee',
      beginningBalance: tcp,
      dueAmount: reservationFee,
      interest: 0,
      penalty: 0,
      datePaid: '',
      amountPaid: 0,
      referenceId: '-',
      paymentMethod: '-',
      verifiedBy: '-',
      status: 'Unpaid',
      endingBalance: tcp,
    },
    {
      id: 2,
      dueDate: '2026-07-15',
      description: 'Downpayment',
      beginningBalance: tcp - reservationFee,
      dueAmount: downpayment,
      interest: 0,
      penalty: 0,
      datePaid: '',
      amountPaid: 0,
      referenceId: '-',
      paymentMethod: '-',
      verifiedBy: '-',
      status: 'Unpaid',
      endingBalance: tcp - reservationFee,
    },
    {
      id: 3,
      dueDate: '2026-08-15',
      description: 'Monthly Amortization 1',
      beginningBalance: tcp - reservationFee - downpayment,
      dueAmount: monthly,
      interest: 0,
      penalty: 0,
      datePaid: '',
      amountPaid: 0,
      referenceId: '-',
      paymentMethod: '-',
      verifiedBy: '-',
      status: 'Unpaid',
      endingBalance: tcp - reservationFee - downpayment,
    },
    {
      id: 4,
      dueDate: '2026-09-15',
      description: 'Monthly Amortization 2',
      beginningBalance: tcp - reservationFee - downpayment - monthly,
      dueAmount: monthly,
      interest: 0,
      penalty: 0,
      datePaid: '',
      amountPaid: 0,
      referenceId: '-',
      paymentMethod: '-',
      verifiedBy: '-',
      status: 'Unpaid',
      endingBalance: tcp - reservationFee - downpayment - monthly,
    },
  ]
}

const StatusPill = ({ status }) => {
  const normalized = String(status || '').toLowerCase()

  const styles = {
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    rejected: 'border-red-200 bg-red-50 text-red-700',
    unpaid: 'border-slate-200 bg-slate-100 text-slate-600',
  }

  const color = styles[normalized] || styles.unpaid

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-black ${color}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status || 'Unpaid'}
    </span>
  )
}

const SummaryCard = ({ label, value, tone = 'slate', isMoney = true }) => {
  const styles = {
    slate: 'bg-white text-slate-950',
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
    red: 'bg-red-50 text-red-700',
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

const PaymentsSOA = ({ listing = {}, soaRows = [] }) => {
  const [rows, setRows] = useState(() => normalizeRows(soaRows, listing))
  const [showAdd, setShowAdd] = useState(false)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const buyerName = getListingValue(
    listing,
    ['buyer_name', 'buyerName', 'clientName'],
    'robert'
  )

  const unitCode = getListingValue(
    listing,
    ['unit_id', 'unitCode', 'unitNo'],
    'LA-0402'
  )

  const projectName = getListingValue(
    listing,
    ['project_name', 'projectName'],
    'Bailen Project'
  )

  const tcp = cleanMoney(
    getListingValue(listing, ['tcp', 'tcpAmount', 'totalContractPrice'], 0)
  )

  const paymentRecords = useMemo(() => {
    return rows
      .filter((row) => Number(row.amountPaid || 0) > 0)
      .map((row) => ({
        ...row,
        client: buyerName,
        unit: unitCode,
        project: projectName,
        type: row.description,
        amount: row.amountPaid,
        method: row.paymentMethod || '-',
        paymentDate: row.datePaid,
      }))
  }, [rows, buyerName, unitCode, projectName])

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return paymentRecords.filter((payment) => {
      const matchesSearch =
        !keyword ||
        `${payment.client} ${payment.unit} ${payment.project} ${payment.type} ${payment.referenceId}`
          .toLowerCase()
          .includes(keyword)

      const matchesType =
        typeFilter === 'all' ||
        payment.type.toLowerCase().includes(typeFilter.toLowerCase())

      const matchesStatus =
        statusFilter === 'all' ||
        payment.status.toLowerCase() === statusFilter.toLowerCase()

      return matchesSearch && matchesType && matchesStatus
    })
  }, [paymentRecords, search, typeFilter, statusFilter])

  const totalDue = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.dueAmount || 0), 0),
    [rows]
  )

  const totalInterest = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.interest || 0), 0),
    [rows]
  )

  const totalPenalty = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.penalty || 0), 0),
    [rows]
  )

  const totalPaid = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.amountPaid || 0), 0),
    [rows]
  )

  const pendingAmount = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const status = String(row.status || '').toLowerCase()
        return status === 'pending' ? sum + Number(row.amountPaid || 0) : sum
      }, 0),
    [rows]
  )

  const rejectedAmount = useMemo(
    () =>
      rows.reduce((sum, row) => {
        const status = String(row.status || '').toLowerCase()
        return status === 'rejected' ? sum + Number(row.amountPaid || 0) : sum
      }, 0),
    [rows]
  )

  const resetFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const handleSavePayment = (payment) => {
    setRows((current) =>
      current.map((row) => {
        if (String(row.id) !== String(payment.soaRowId)) return row

        const totalRowDue =
          Number(row.dueAmount || 0) +
          Number(payment.interest || 0) +
          Number(payment.penalty || 0)

        const paidAmount = Number(payment.amount || 0)
        const isFullyPaid = paidAmount >= totalRowDue

        return {
          ...row,
          interest: Number(payment.interest || 0),
          penalty: Number(payment.penalty || 0),
          datePaid: payment.paymentDate,
          amountPaid: paidAmount,
          referenceId: payment.referenceId,
          paymentMethod: payment.method,
          verifiedBy: payment.status === 'Verified' ? 'Super Admin' : '-',
          status: payment.status === 'Verified' && isFullyPaid ? 'Paid' : payment.status,
          endingBalance: Math.max(Number(row.beginningBalance || 0) - paidAmount, 0),
        }
      })
    )

    setShowAdd(false)
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Payments & SOA</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Record payments and view the statement of account with interest and penalties.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <FiPlus className="h-4 w-4" />
          Add Payment
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Payment Records" value={paymentRecords.length} isMoney={false} />
        <SummaryCard label="Verified Collections" value={totalPaid} />
        <SummaryCard label="Pending" value={pendingAmount} tone="amber" />
        <SummaryCard label="Rejected" value={rejectedAmount} tone="red" />
      </div>

      <div className="mt-6 grid gap-3 xl:grid-cols-[1fr_220px_220px_auto]">
        <label className="relative">
          <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search client, unit, project, reference..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </label>

        <select
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Types</option>
          <option value="Reservation">Reservation</option>
          <option value="Downpayment">Downpayment</option>
          <option value="Monthly">Monthly</option>
          <option value="Legal">Legal / Misc</option>
          <option value="Full">Full Payment</option>
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Statuses</option>
          <option value="Paid">Paid</option>
          <option value="Verified">Verified</option>
          <option value="Pending">Pending</option>
          <option value="Rejected">Rejected</option>
        </select>

        <button
          type="button"
          onClick={resetFilters}
          className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
        >
          Reset Filters
        </button>
      </div>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
        <div className="overflow-x-auto">
          <table className="min-w-[1150px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                {[
                  'Client',
                  'Unit',
                  'Project',
                  'Amount',
                  'Type',
                  'Method',
                  'Reference ID',
                  'Payment Date',
                  'Verified By',
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
              {filteredPayments.map((payment) => (
                <tr key={payment.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-4 font-black text-slate-950">
                    {payment.client}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.unit}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.project}
                  </td>

                  <td className="px-4 py-4 font-black text-slate-950">
                    {money(payment.amount)}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.type}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.method}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {payment.referenceId}
                  </td>

                  <td className="px-4 py-4 font-semibold text-slate-600">
                    {formatDate(payment.paymentDate)}
                  </td>

                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-700">
                      {payment.verifiedBy}
                    </p>
                    {payment.verifiedBy !== '-' ? (
                      <p className="text-xs font-semibold text-slate-500">
                        {formatDate(payment.paymentDate)}
                      </p>
                    ) : null}
                  </td>

                  <td className="px-4 py-4">
                    <StatusPill status={payment.status} />
                  </td>

                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiRefreshCw className="h-3.5 w-3.5" />
                        Status
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredPayments.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center">
                    <FiCreditCard className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      No payment records yet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Add a payment to create a collection record.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing 1-{filteredPayments.length} of {filteredPayments.length} records
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

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-950">
                Statement of Account
              </h3>
              <p className="text-sm font-semibold text-slate-500">
                SOA schedule with due amount, interest, penalty, payment, and ending balance.
              </p>
            </div>

            <div className="text-sm font-black text-slate-700">
              Balance: {money(rows[rows.length - 1]?.endingBalance || 0)}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-[1250px] w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white">
              <tr>
                {[
                  'Due Date',
                  'Description',
                  'Beginning Balance',
                  'Due Amount',
                  'Interest',
                  'Penalty',
                  'Date Paid',
                  'Amount Paid',
                  'Reference ID',
                  'Status',
                  'Ending Balance',
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
              {rows.map((row) => (
                <tr key={row.id} className="transition hover:bg-slate-50">
                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatDate(row.dueDate)}
                  </td>

                  <td className="px-4 py-3 font-black text-slate-950">
                    {row.description}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {money(row.beginningBalance)}
                  </td>

                  <td className="px-4 py-3 font-black text-slate-950">
                    {money(row.dueAmount)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-amber-700">
                    {money(row.interest)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-red-700">
                    {money(row.penalty)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {formatDate(row.datePaid)}
                  </td>

                  <td className="px-4 py-3 font-black text-emerald-700">
                    {Number(row.amountPaid || 0) > 0 ? money(row.amountPaid) : money(0)}
                  </td>

                  <td className="px-4 py-3 font-semibold text-slate-600">
                    {row.referenceId || '-'}
                  </td>

                  <td className="px-4 py-3">
                    <StatusPill status={row.status} />
                  </td>

                  <td className="px-4 py-3 font-black text-slate-950">
                    {money(row.endingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-end">
            <span className="font-semibold text-slate-500">
              Total amount to fully pay as of statement date:
            </span>
            <span className="text-lg font-black text-slate-950">
              {money(rows[rows.length - 1]?.endingBalance || 0)}
            </span>
          </div>
        </div>
      </section>

      {showAdd ? (
        <AddSOAPaymentModal
          listing={listing}
          rows={rows}
          onClose={() => setShowAdd(false)}
          onSave={handleSavePayment}
        />
      ) : null}
    </section>
  )
}

export default PaymentsSOA