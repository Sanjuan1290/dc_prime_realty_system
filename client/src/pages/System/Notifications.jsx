import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiLoader,
  FiMail,
  FiRefreshCw,
  FiSearch,
  FiUserCheck,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ReadOnlyNotice from '../../components/Shared/ReadOnlyNotice'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchPost } from '../../utils/useFetch'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const statusStyles = {
  due_soon: 'border-blue-200 bg-blue-50 text-blue-700',
  overdue: 'border-red-200 bg-red-50 text-red-700',
  sent: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  failed: 'border-red-200 bg-red-50 text-red-700',
  contacted: 'border-amber-200 bg-amber-50 text-amber-700',
}

const getLastStatusLabel = (value) => {
  const labels = {
    sent: 'Email Sent',
    failed: 'Failed',
    contacted: 'Contacted',
  }

  return labels[value] || 'Not Sent'
}

const pageSizeOptions = [10, 25, 50]

const SummaryCard = ({ label, value, icon: Icon, tone = 'slate', helper }) => {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    blue: 'border-blue-100 bg-blue-50 text-blue-900',
    red: 'border-red-100 bg-red-50 text-red-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-900',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          {helper ? <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p> : null}
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-slate-700 shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}

const EmptyState = ({ category }) => (
  <div className="flex min-h-[280px] flex-col items-center justify-center px-5 py-10 text-center">
    <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
      <FiBell className="h-7 w-7" />
    </div>
    <h3 className="mt-4 text-lg font-black text-slate-900">No payment notifications found</h3>
    <p className="mt-2 max-w-xl text-sm font-semibold text-slate-500">
      {category === 'overdue'
        ? 'There are no overdue unpaid schedules right now.'
        : category === 'due_soon'
          ? 'There are no unpaid schedules due within the next 7 days.'
          : 'Due soon and overdue schedules will appear here once they exist.'}
    </p>
  </div>
)

const Notifications = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = currentUserData?.user?.role === 'super_admin'
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const queryClient = useQueryClient()

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    params.set('category', category)
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [category, search])

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['system-payment-notifications', category, search],
    queryFn: () => useFetch(`/notifications/payment-dues?${queryString}`),
  })

  const sendMutation = useMutation({
    mutationFn: ({ scheduleId }) =>
      useFetchPost(`/notifications/payment-dues/${scheduleId}/send`, {}),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Sending payment notification email...' })
    },
    onSuccess: (res) => {
      setAlert({ type: 'success', message: res?.message || 'Notification email sent successfully.' })
      queryClient.invalidateQueries({ queryKey: ['system-payment-notifications'] })
    },
    onError: (err) => {
      setAlert({ type: 'error', message: err?.message || 'Failed to send notification email.' })
    },
  })

  const contactedMutation = useMutation({
    mutationFn: ({ scheduleId }) =>
      useFetchPost(`/notifications/payment-dues/${scheduleId}/contacted`, {
        message: 'Marked as contacted from System Notifications.',
      }),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Marking schedule as contacted...' })
    },
    onSuccess: (res) => {
      setAlert({ type: 'success', message: res?.message || 'Schedule marked as contacted.' })
      queryClient.invalidateQueries({ queryKey: ['system-payment-notifications'] })
    },
    onError: (err) => {
      setAlert({ type: 'error', message: err?.message || 'Failed to mark as contacted.' })
    },
  })

  const notifications = data?.data?.notifications || []
  const summary = data?.data?.summary || {
    total: 0,
    dueSoon: 0,
    overdue: 0,
    totalPaymentDue: 0,
    totalPenalty: 0,
  }

  const totalPages = Math.max(1, Math.ceil(notifications.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const startIndex = notifications.length ? (currentPage - 1) * pageSize : 0
  const endIndex = Math.min(startIndex + pageSize, notifications.length)
  const paginatedNotifications = notifications.slice(startIndex, endIndex)

  const isBusy = sendMutation.isPending || contactedMutation.isPending

  const handleSend = (item) => {
    const confirmMessage = item.notificationType === 'overdue'
      ? `Send overdue notice to ${item.buyerEmail || item.buyerName}?`
      : `Send payment reminder to ${item.buyerEmail || item.buyerName}?`

    if (!window.confirm(confirmMessage)) return
    sendMutation.mutate({ scheduleId: item.scheduleId })
  }

  const handleContacted = (item) => {
    if (!window.confirm(`Mark ${item.unitId} - ${item.buyerName} as contacted?`)) return
    contactedMutation.mutate({ scheduleId: item.scheduleId })
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader
          title="Notifications"
          description="Due soon and overdue payment schedules for all lot projects."
          icon={FiBell}
        />

        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isFetching ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiRefreshCw className="h-4 w-4" />}
          {isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {!canManage ? <ReadOnlyNotice message="Admin can review due and overdue notices. Only a Super Admin can send reminders or mark buyers as contacted." /> : null}

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {isError ? (
        <StatusAlert
          type="error"
          message={error?.message || 'Failed to load payment notifications.'}
        />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <SummaryCard label="Total Notices" value={summary.total} icon={FiBell} helper="Due soon + overdue" />
        <SummaryCard label="Due Within 7 Days" value={summary.dueSoon} icon={FiClock} tone="blue" helper="Unpaid or partial" />
        <SummaryCard label="Overdue" value={summary.overdue} icon={FiAlertTriangle} tone="red" helper="Past due schedules" />
        <SummaryCard label="Payment Due" value={money(summary.totalPaymentDue)} icon={FiMail} tone="amber" helper="Unpaid balance" />
        <SummaryCard label="Penalty" value={money(summary.totalPenalty)} icon={FiAlertTriangle} tone="red" helper="Auto-calculated daily penalty" />
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">Payment Notifications</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Send reminder emails for dues within 7 days and overdue schedules.
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative min-w-[260px]">
              <FiSearch className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder="Search project, unit, buyer, email..."
                className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <select
              value={category}
              onChange={(event) => {
                setCategory(event.target.value)
                setPage(1)
              }}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Notices</option>
              <option value="due_soon">Due Within 7 Days</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="flex min-h-[280px] items-center justify-center p-8">
            <StatusAlert type="loading" message="Loading payment notifications..." />
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState category={category} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-[1250px] divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Project',
                    'Unit ID',
                    'Buyer',
                    'Email',
                    'Due Date',
                    'Description',
                    'Payment Due',
                    'Balance',
                    'Penalty',
                    'Status',
                    'Last Notice',
                    'Actions',
                  ].map((header) => (
                    <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {paginatedNotifications.map((item) => (
                  <tr key={item.scheduleId} className="align-top transition hover:bg-slate-50">
                    <td className="px-4 py-4 font-black text-slate-900">{item.projectName}</td>
                    <td className="px-4 py-4">
                      {item.listingPath ? (
                        <a href={item.listingPath} className="font-black text-blue-700 hover:underline">
                          {item.unitId}
                        </a>
                      ) : (
                        <span className="font-black text-slate-900">{item.unitId}</span>
                      )}
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{item.buyerName}</td>
                    <td className="px-4 py-4 font-semibold text-slate-600">{item.buyerEmail || '-'}</td>
                    <td className="px-4 py-4 font-black text-slate-900">{item.dueDate}</td>
                    <td className="px-4 py-4 font-semibold text-slate-700">{item.description}</td>
                    <td className="px-4 py-4 font-black text-slate-950">{money(item.paymentDue)}</td>
                    <td className="px-4 py-4 font-black text-slate-950">{money(item.balance)}</td>
                    <td className="px-4 py-4 font-black text-red-700">{money(item.penaltyAmount)}</td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.notificationType]}`}>
                        {item.statusLabel}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.lastNotificationStatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>
                          {getLastStatusLabel(item.lastNotificationStatus)}
                        </span>
                        {item.lastNotificationAt ? (
                          <span className="text-xs font-semibold text-slate-500">{item.lastNotificationAt}</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">{canManage ? <><button type="button" onClick={() => handleSend(item)} disabled={isBusy || !item.buyerEmail} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white hover:bg-blue-700 disabled:opacity-50">{sendMutation.isPending ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiMail className="h-4 w-4" />}{item.notificationType === 'overdue' ? 'Send Overdue' : 'Send Reminder'}</button><button type="button" onClick={() => handleContacted(item)} disabled={isBusy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-black text-slate-700 hover:bg-emerald-50 disabled:opacity-50">{contactedMutation.isPending ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiUserCheck className="h-4 w-4" />}Contacted</button></> : <span className="text-xs font-semibold text-slate-400">View only</span>}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-slate-600">
                Showing {notifications.length ? `${startIndex + 1}-${endIndex}` : '0'} of {notifications.length} notices
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={pageSize}
                  onChange={(event) => {
                    setPageSize(Number(event.target.value))
                    setPage(1)
                  }}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700 outline-none"
                >
                  {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(current - 1, 1))}
                  disabled={currentPage <= 1}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
                  disabled={currentPage >= totalPages}
                  className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </main>
  )
}

export default Notifications
