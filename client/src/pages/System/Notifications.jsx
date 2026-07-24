import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiAlertTriangle,
  FiBell,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiLoader,
  FiMail,
  FiRefreshCw,
  FiSearch,
  FiUserCheck,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import useCurrentUser from '../../utils/useCurrentUser'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import { PERMISSIONS, hasPermission } from '../../config/permissions'

const money = (value) => new Intl.NumberFormat('en-PH', {
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

const getLastStatusLabel = (value) => ({
  sent: 'Email Sent',
  failed: 'Failed',
  contacted: 'Contacted',
}[value] || 'Not Sent')

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
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-slate-700 shadow-sm"><Icon className="h-5 w-5" /></span>
      </div>
    </div>
  )
}

const Pagination = ({ total, page, pageSize, onPageChange, onPageSizeChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const currentPage = Math.min(page, totalPages)
  const start = total ? ((currentPage - 1) * pageSize) + 1 : 0
  const end = Math.min(currentPage * pageSize, total)

  return (
    <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm font-semibold text-slate-600">Showing {start}-{end} of {total} records</p>
      <div className="flex flex-wrap items-center gap-2">
        <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm font-black text-slate-700">
          {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
        </select>
        <button type="button" onClick={() => onPageChange(Math.max(currentPage - 1, 1))} disabled={currentPage <= 1} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50">Previous</button>
        <span className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm font-black text-slate-700">Page {currentPage} of {totalPages}</span>
        <button type="button" onClick={() => onPageChange(Math.min(currentPage + 1, totalPages))} disabled={currentPage >= totalPages} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 disabled:opacity-50">Next</button>
      </div>
    </div>
  )
}

const Notifications = () => {
  const { data: currentUserData } = useCurrentUser()
  const canManage = hasPermission(currentUserData?.user, PERMISSIONS.SYSTEM_NOTIFICATIONS_MANAGE)
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('payments')
  const [category, setCategory] = useState('all')
  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ category })
    if (search.trim()) params.set('search', search.trim())
    return params.toString()
  }, [category, search])

  const paymentQuery = useQuery({
    queryKey: ['system-payment-notifications', category, search],
    queryFn: () => useFetch(`/notifications/payment-dues?${queryString}`),
    enabled: tab === 'payments',
  })

  const documentQuery = useQuery({
    queryKey: ['system-document-notifications', category, search],
    queryFn: () => useFetch(`/notifications/documents?${queryString}`),
    enabled: tab === 'documents',
  })

  const sendMutation = useMutation({
    mutationFn: ({ scheduleId }) => useFetchPost(`/notifications/payment-dues/${scheduleId}/send`, {}),
    onMutate: () => setAlert({ type: 'loading', message: 'Sending payment notification email...' }),
    onSuccess: (response) => {
      setAlert({ type: 'success', message: response?.message || 'Notification email sent successfully.' })
      queryClient.invalidateQueries({ queryKey: ['system-payment-notifications'] })
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to send notification email.' }),
  })

  const documentSendMutation = useMutation({
    mutationFn: ({ listingId, clientProfileId }) =>
      useFetchPost(`/notifications/documents/${listingId}/${clientProfileId}/send`, {}),
    onMutate: () => setAlert({ type: 'loading', message: 'Sending document requirements email...' }),
    onSuccess: (response) => {
      setAlert({ type: 'success', message: response?.message || 'Document requirements email sent successfully.' })
      queryClient.invalidateQueries({ queryKey: ['system-document-notifications'] })
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to send document requirements email.' }),
  })

  const contactedMutation = useMutation({
    mutationFn: ({ scheduleId }) => useFetchPost(`/notifications/payment-dues/${scheduleId}/contacted`, { message: 'Marked as contacted from System Notifications.' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Marking schedule as contacted...' }),
    onSuccess: (response) => {
      setAlert({ type: 'success', message: response?.message || 'Schedule marked as contacted.' })
      queryClient.invalidateQueries({ queryKey: ['system-payment-notifications'] })
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to mark as contacted.' }),
  })

  const activeQuery = tab === 'payments' ? paymentQuery : documentQuery
  const paymentNotifications = paymentQuery.data?.data?.notifications || []
  const paymentSummary = paymentQuery.data?.data?.summary || { total: 0, dueSoon: 0, overdue: 0, totalPaymentDue: 0, totalPenalty: 0 }
  const documentNotifications = documentQuery.data?.data?.notifications || []
  const documentSummary = documentQuery.data?.data?.summary || { totalUnits: 0, pendingRequired: 0, missingRequired: 0, rejectedRequired: 0, awaitingApproval: 0 }
  const records = tab === 'payments' ? paymentNotifications : documentNotifications
  const totalPages = Math.max(1, Math.ceil(records.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedRecords = records.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const isBusy = sendMutation.isPending || documentSendMutation.isPending || contactedMutation.isPending

  const changeTab = (nextTab) => {
    setTab(nextTab)
    setCategory('all')
    setSearch('')
    setPage(1)
  }

  const handleSend = (item) => {
    const message = item.notificationType === 'overdue'
      ? `Send overdue notice to ${item.buyerEmail || item.buyerName}?`
      : `Send payment reminder to ${item.buyerEmail || item.buyerName}?`
    if (window.confirm(message)) sendMutation.mutate({ scheduleId: item.scheduleId })
  }

  const handleDocumentSend = (item) => {
    const recipient = item.buyerEmail || item.buyerName
    if (window.confirm(`Send the missing document requirements PDF to ${recipient}?`)) {
      documentSendMutation.mutate({
        listingId: item.listingId,
        clientProfileId: item.clientProfileId,
      })
    }
  }

  const handleContacted = (item) => {
    if (window.confirm(`Mark ${item.unitId} - ${item.buyerName} as contacted?`)) contactedMutation.mutate({ scheduleId: item.scheduleId })
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <PageHeader title="Notifications" description="Payment reminders and incomplete required-document records across all lot projects." icon={FiBell} />
        <button type="button" onClick={() => activeQuery.refetch()} disabled={activeQuery.isFetching} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm hover:bg-blue-50 disabled:opacity-60">
          {activeQuery.isFetching ? <FiLoader className="animate-spin" /> : <FiRefreshCw />} {activeQuery.isFetching ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}
      {activeQuery.isError ? <StatusAlert type="error" message={activeQuery.error?.message || 'Failed to load notifications.'} /> : null}

      <section className="inline-flex w-fit rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
        <button type="button" onClick={() => changeTab('payments')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === 'payments' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FiMail /> Payment Notifications</button>
        <button type="button" onClick={() => changeTab('documents')} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === 'documents' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}><FiFileText /> Document Notifications</button>
      </section>

      {tab === 'payments' ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Total Notices" value={paymentSummary.total} icon={FiBell} helper="Due soon + overdue" />
          <SummaryCard label="Due Within 7 Days" value={paymentSummary.dueSoon} icon={FiClock} tone="blue" helper="Unpaid or partial" />
          <SummaryCard label="Overdue" value={paymentSummary.overdue} icon={FiAlertTriangle} tone="red" helper="Past due schedules" />
          <SummaryCard label="Payment Due" value={money(paymentSummary.totalPaymentDue)} icon={FiMail} tone="amber" helper="Unpaid balance" />
          <SummaryCard label="Penalty" value={money(paymentSummary.totalPenalty)} icon={FiAlertTriangle} tone="red" helper="Calculated penalty" />
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <SummaryCard label="Client Units" value={documentSummary.totalUnits} icon={FiFileText} helper="Active, fully paid, or pending cancellation" />
          <SummaryCard label="Pending Required" value={documentSummary.pendingRequired} icon={FiAlertTriangle} tone="red" helper="Missing + rejected" />
          <SummaryCard label="Missing Required" value={documentSummary.missingRequired} icon={FiClock} tone="amber" helper="Not uploaded" />
          <SummaryCard label="Rejected Required" value={documentSummary.rejectedRequired} icon={FiAlertTriangle} tone="red" helper="Needs resubmission" />
          <SummaryCard label="Awaiting Approval" value={documentSummary.awaitingApproval} icon={FiCheckCircle} tone="blue" helper="Submitted but not approved" />
        </section>
      )}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-slate-950">{tab === 'payments' ? 'Payment Notifications' : 'Document Notifications'}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">{tab === 'payments' ? 'Send reminders for dues within 7 days and overdue schedules.' : 'Review pending required documents and submitted files waiting for approval.'}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative min-w-[270px]"><FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search project, unit, buyer, email..." className="h-11 w-full rounded-2xl border border-slate-200 pl-11 pr-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1) }} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              {tab === 'payments' ? <><option value="all">All Notices</option><option value="due_soon">Due Within 7 Days</option><option value="overdue">Overdue</option></> : <><option value="all">All Document Records</option><option value="pending">Pending Required</option><option value="missing">Missing Required</option><option value="rejected">Rejected Required</option><option value="awaiting">Awaiting Approval</option></>}
            </select>
          </div>
        </div>

        {activeQuery.isLoading ? <div className="flex min-h-[280px] items-center justify-center"><StatusAlert type="loading" message={`Loading ${tab === 'payments' ? 'payment' : 'document'} notifications...`} /></div> : records.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center"><div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">{tab === 'payments' ? <FiBell className="h-7 w-7" /> : <FiFileText className="h-7 w-7" />}</div><h3 className="mt-4 text-lg font-black text-slate-900">No {tab === 'payments' ? 'payment' : 'document'} notifications found</h3><p className="mt-2 text-sm font-semibold text-slate-500">Try another category or search.</p></div>
        ) : tab === 'payments' ? (
          <>
            <div className="overflow-x-auto"><table className="min-w-[1250px] w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{['Project', 'Unit ID', 'Buyer', 'Email', 'Due Date', 'Description', 'Payment Due', 'Balance', 'Penalty', 'Status', 'Last Notice', 'Actions'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{paginatedRecords.map((item) => <tr key={item.scheduleId} className="align-top hover:bg-slate-50"><td className="px-4 py-4 font-black">{item.projectName}</td><td className="px-4 py-4">{item.listingPath ? <Link to={item.listingPath} className="font-black text-blue-700 hover:underline">{item.unitId}</Link> : <span className="font-black">{item.unitId}</span>}</td><td className="px-4 py-4 font-semibold text-slate-700">{item.buyerName}</td><td className="px-4 py-4 font-semibold text-slate-600">{item.buyerEmail || '-'}</td><td className="px-4 py-4 font-black">{item.dueDate}</td><td className="px-4 py-4 font-semibold text-slate-700">{item.description}</td><td className="px-4 py-4 font-black">{money(item.paymentDue)}</td><td className="px-4 py-4 font-black">{money(item.balance)}</td><td className="px-4 py-4 font-black text-red-700">{money(item.penaltyAmount)}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.notificationType]}`}>{item.statusLabel}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.lastNotificationStatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{getLastStatusLabel(item.lastNotificationStatus)}</span></td><td className="px-4 py-4"><div className="flex gap-2">{canManage ? <><button type="button" onClick={() => handleSend(item)} disabled={isBusy || !item.buyerEmail} className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-xs font-black text-white disabled:opacity-50"><FiMail /> Send</button><button type="button" onClick={() => handleContacted(item)} disabled={isBusy} className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-black text-slate-700 disabled:opacity-50"><FiUserCheck /> Contacted</button></> : <span className="text-xs font-semibold text-slate-400">View only</span>}</div></td></tr>)}</tbody></table></div>
            <Pagination total={records.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
          </>
        ) : (
          <>
            <div className="overflow-x-auto"><table className="min-w-[1380px] w-full divide-y divide-slate-200 text-sm"><thead className="bg-slate-50"><tr>{['Project', 'Unit', 'Buyer', 'Email / Contact', 'Submitted / Total', 'Approved', 'Awaiting', 'Missing Required', 'Rejected Required', 'Status', 'Last Email', 'Actions'].map((header) => <th key={header} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{paginatedRecords.map((item) => <tr key={item.listingId} className="align-top hover:bg-slate-50"><td className="px-4 py-4 font-black">{item.projectName}</td><td className="px-4 py-4 font-black text-blue-700">{item.unitId}</td><td className="px-4 py-4 font-semibold text-slate-700">{item.buyerName}</td><td className="px-4 py-4 font-semibold text-slate-600"><p>{item.buyerEmail || '-'}</p><p className="text-xs">{item.buyerContactNumber || '-'}</p></td><td className="px-4 py-4 font-black text-blue-700">{item.submittedDocuments} / {item.totalDocuments}</td><td className="px-4 py-4 font-black text-emerald-700">{item.approvedDocuments}</td><td className="px-4 py-4 font-black text-amber-700">{item.awaitingApprovalDocuments}</td><td className="px-4 py-4 font-black text-red-700">{item.missingRequiredDocuments}</td><td className="px-4 py-4 font-black text-red-700">{item.rejectedRequiredDocuments}</td><td className="px-4 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${item.pendingRequiredDocuments > 0 ? 'bg-red-50 text-red-700' : item.awaitingApprovalDocuments > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{item.pendingRequiredDocuments > 0 ? 'Incomplete' : item.awaitingApprovalDocuments > 0 ? 'For Review' : 'Complete'}</span></td><td className="px-4 py-4"><span className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusStyles[item.lastDocumentNotificationStatus] || 'border-slate-200 bg-slate-50 text-slate-600'}`}>{getLastStatusLabel(item.lastDocumentNotificationStatus)}</span>{item.lastDocumentNotificationAt ? <p className="mt-1 text-xs font-semibold text-slate-500">{item.lastDocumentNotificationAt}</p> : null}</td><td className="px-4 py-4"><div className="flex flex-wrap gap-2">{canManage ? <button type="button" onClick={() => handleDocumentSend(item)} disabled={isBusy || !item.buyerEmail || item.pendingRequiredDocuments <= 0} className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-black text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><FiMail /> Send Email</button> : null}<Link to={item.listingPath} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:bg-slate-50"><FiFileText /> Review</Link></div></td></tr>)}</tbody></table></div>
            <Pagination total={records.length} page={currentPage} pageSize={pageSize} onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1) }} />
          </>
        )}
      </section>
    </main>
  )
}

export default Notifications

