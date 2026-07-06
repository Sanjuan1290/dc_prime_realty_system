import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import {
  FiAlertTriangle,
  FiCheckCircle,
  FiCreditCard,
  FiEdit2,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPost, useFetchPut } from '../../../../utils/useFetch'
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
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 10)

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

const normalizeRows = (rows = []) => {
  return rows.map((row, index) => ({
    id: row.id || row.lot_project_payment_schedule_id || index + 1,
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
    status: row.status || row.schedule_status || 'Unpaid',
    endingBalance: cleanMoney(
      row.endingBalance ??
        row.remainingBalance ??
        row.runningBalance ??
        row.ending_balance
    ),
  }))
}

const normalizePayments = (payments = [], listing = {}) => {
  const buyerName = getListingValue(listing, ['buyer_name', 'buyerName', 'clientName'], '-')
  const unitCode = getListingValue(listing, ['unit_id', 'unitCode', 'unitNo'], '-')
  const projectName = getListingValue(listing, ['project_name', 'projectName'], '-')

  return payments.map((payment, index) => ({
    id: payment.id || payment.paymentId || index + 1,
    paymentId: payment.paymentId || payment.id,
    soaRowId: payment.soaRowId || payment.lot_project_payment_schedule_id || '',
    client: payment.client || buyerName,
    unit: payment.unit || unitCode,
    project: payment.project || projectName,
    type: payment.type || payment.paymentType || 'Other',
    paymentType: payment.paymentType || payment.type || 'Other',
    amount: cleanMoney(payment.amount ?? payment.lot_project_payment_amount),
    method: payment.method || payment.paymentMethod || payment.lot_project_payment_method || '-',
    referenceId:
      payment.referenceId ||
      payment.reference_id ||
      payment.lot_project_payment_reference_id ||
      '-',
    paymentDate:
      payment.paymentDate ||
      payment.payment_date ||
      payment.lot_project_payment_date ||
      '',
    verifiedBy: payment.verifiedBy || payment.verified_by || '-',
    verifiedAt: payment.verifiedAt || payment.verified_at || '',
    status: payment.status || payment.lot_project_payment_status || 'Verified',
    scheduleDescription: payment.scheduleDescription || payment.schedule_description || '-',
  }))
}

const paymentTypeOptions = [
  'Reservation',
  'Downpayment',
  'Monthly',
  'Advance Payment',
  'Balloon',
  'Full Payment',
  'Other',
]

const StatusPill = ({ status }) => {
  const normalized = String(status || '').toLowerCase()

  const styles = {
    paid: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    advance: 'border-blue-200 bg-blue-50 text-blue-700',
    verified: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    partial: 'border-amber-200 bg-amber-50 text-amber-700',
    overdue: 'border-red-200 bg-red-50 text-red-700',
    unpaid: 'border-slate-200 bg-slate-100 text-slate-600',
    cancelled: 'border-slate-200 bg-slate-100 text-slate-600',
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

const DeletePaymentModal = ({ payment, password, setPassword, alert, isDeleting, onClose, onConfirm }) => {
  if (!payment) return null

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-700">
              <FiAlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950">Delete Payment</h3>
              <p className="text-sm font-semibold text-slate-500">
                Super admin password is required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : null}
              className="mb-4"
            />
          ) : null}

          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
            This will remove the payment record and reverse the amount applied to the SOA.
          </div>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="font-black text-slate-500">Reference ID</p>
                <p className="mt-1 font-semibold text-slate-900">{payment.referenceId}</p>
              </div>
              <div>
                <p className="font-black text-slate-500">Amount</p>
                <p className="mt-1 font-semibold text-slate-900">{money(payment.amount)}</p>
              </div>
              <div>
                <p className="font-black text-slate-500">Type</p>
                <p className="mt-1 font-semibold text-slate-900">{payment.type}</p>
              </div>
              <div>
                <p className="font-black text-slate-500">Date</p>
                <p className="mt-1 font-semibold text-slate-900">{formatDate(payment.paymentDate)}</p>
              </div>
            </div>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-black text-slate-700">
              Super Admin Password <span className="text-red-500">*</span>
            </span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter super admin password"
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-red-400 focus:ring-4 focus:ring-red-50"
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="h-10 rounded-lg bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {isDeleting ? 'Deleting...' : 'Delete Payment'}
          </button>
        </div>
      </div>
    </div>
  )
}

const PaymentsSOA = ({ listing = {}, soaRows = [], payments = [] }) => {
  const { projectSlug, listingId } = useParams()
  const queryClient = useQueryClient()

  const rows = useMemo(() => normalizeRows(soaRows), [soaRows])
  const paymentRecords = useMemo(() => normalizePayments(payments, listing), [payments, listing])

  const [alert, setAlert] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [deletePayment, setDeletePayment] = useState(null)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteAlert, setDeleteAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  const profileKey = ['lot-listing-profile', projectSlug, listingId]

  const invalidateProfile = () => {
    queryClient.invalidateQueries({ queryKey: profileKey })
    queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] })
    queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] })
  }

  const createPaymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPost(`/projects/lot-projects/${projectSlug}/listings/${listingId}/payments`, payload),
    onSuccess: (result) => {
      setShowPaymentModal(false)
      setEditingPayment(null)
      setAlert({ type: 'success', message: result?.message || 'Payment saved successfully.' })
      invalidateProfile()
    },
  })

  const updatePaymentMutation = useMutation({
    mutationFn: (payload) =>
      useFetchPut(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${payload.paymentId}`,
        payload
      ),
    onSuccess: (result) => {
      setShowPaymentModal(false)
      setEditingPayment(null)
      setAlert({ type: 'success', message: result?.message || 'Payment updated successfully.' })
      invalidateProfile()
    },
  })

  const deletePaymentMutation = useMutation({
    mutationFn: ({ paymentId, superAdminPassword }) =>
      useFetchPost(
        `/projects/lot-projects/${projectSlug}/listings/${listingId}/payments/${paymentId}/delete`,
        { superAdminPassword }
      ),
    onSuccess: (result) => {
      setDeletePayment(null)
      setDeletePassword('')
      setDeleteAlert(null)
      setAlert({ type: 'success', message: result?.message || 'Payment deleted successfully.' })
      invalidateProfile()
    },
    onError: (error) => {
      setDeleteAlert({ type: 'error', message: error?.message || 'Failed to delete payment.' })
    },
  })

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase()

    return paymentRecords.filter((payment) => {
      const matchesSearch =
        !keyword ||
        `${payment.client} ${payment.unit} ${payment.project} ${payment.type} ${payment.referenceId}`
          .toLowerCase()
          .includes(keyword)

      const matchesType = typeFilter === 'all' || payment.type === typeFilter
      const matchesStatus = statusFilter === 'all' || payment.status === statusFilter

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
    () => paymentRecords.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    [paymentRecords]
  )

  const remainingBalance = useMemo(() => {
    if (!rows.length) return cleanMoney(listing?.balanceAmount ?? listing?.balance)
    return Number(rows[rows.length - 1]?.endingBalance || 0)
  }, [rows, listing])

  const resetFilters = () => {
    setSearch('')
    setTypeFilter('all')
    setStatusFilter('all')
  }

  const openAddModal = () => {
    setEditingPayment(null)
    setShowPaymentModal(true)
  }

  const openEditModal = (payment) => {
    setEditingPayment(payment)
    setShowPaymentModal(true)
  }

  const handleSavePayment = async (payload) => {
    if (payload.paymentId) {
      await updatePaymentMutation.mutateAsync(payload)
      return
    }

    await createPaymentMutation.mutateAsync(payload)
  }

  const handleDeleteClick = (payment) => {
    setDeletePayment(payment)
    setDeletePassword('')
    setDeleteAlert(null)
  }

  const handleConfirmDelete = () => {
    if (!deletePassword.trim()) {
      setDeleteAlert({ type: 'error', message: 'Super admin password is required.' })
      return
    }

    deletePaymentMutation.mutate({
      paymentId: deletePayment.paymentId || deletePayment.id,
      superAdminPassword: deletePassword,
    })
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={() => setAlert(null)}
          className="mb-4"
        />
      ) : null}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-black text-slate-950">Payments & SOA</h2>
          <p className="mt-1 text-sm font-semibold text-slate-500">
            Record verified payments and view the complete computed statement of account.
          </p>
        </div>

        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
        >
          <FiPlus className="h-4 w-4" />
          Add Payment
        </button>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Payment Records" value={paymentRecords.length} isMoney={false} />
        <SummaryCard label="Verified Collections" value={totalPaid} tone="emerald" />
        <SummaryCard label="Total Due" value={totalDue + totalInterest + totalPenalty} tone="blue" />
        <SummaryCard label="Remaining Balance" value={remainingBalance} tone="amber" />
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
          {paymentTypeOptions.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        >
          <option value="all">All Statuses</option>
          <option value="Verified">Verified</option>
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
                <tr key={payment.paymentId || payment.id} className="transition hover:bg-slate-50">
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
                    {payment.verifiedAt && payment.verifiedAt !== '-' ? (
                      <p className="text-xs font-semibold text-slate-500">
                        {payment.verifiedAt}
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
                        onClick={() => openEditModal(payment)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteClick(payment)}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-black text-red-700 transition hover:bg-red-100"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                        Delete
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
                      Add a payment to create a verified collection record.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-slate-600">
            Showing {filteredPayments.length ? 1 : 0}-{filteredPayments.length} of {filteredPayments.length} records
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
                Complete SOA schedule with due amount, interest, penalty, payment, and ending balance.
              </p>
            </div>

            <div className="text-sm font-black text-slate-700">
              Balance: {money(remainingBalance)}
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
                    {money(row.amountPaid)}
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

              {!rows.length ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center">
                    <FiCheckCircle className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-3 text-sm font-black text-slate-700">
                      No SOA schedule yet
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-500">
                      Create the reservation/payment schedule first.
                    </p>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-end">
            <span className="font-semibold text-slate-500">
              Total amount to fully pay as of statement date:
            </span>
            <span className="text-lg font-black text-slate-950">
              {money(remainingBalance)}
            </span>
          </div>
        </div>
      </section>

      {showPaymentModal ? (
        <AddSOAPaymentModal
          listing={listing}
          rows={rows}
          initialPayment={editingPayment}
          mode={editingPayment ? 'edit' : 'add'}
          isSaving={createPaymentMutation.isPending || updatePaymentMutation.isPending}
          onClose={() => {
            setShowPaymentModal(false)
            setEditingPayment(null)
          }}
          onSave={handleSavePayment}
        />
      ) : null}

      <DeletePaymentModal
        payment={deletePayment}
        password={deletePassword}
        setPassword={setDeletePassword}
        alert={deleteAlert}
        isDeleting={deletePaymentMutation.isPending}
        onClose={() => {
          setDeletePayment(null)
          setDeletePassword('')
          setDeleteAlert(null)
        }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  )
}

export default PaymentsSOA
