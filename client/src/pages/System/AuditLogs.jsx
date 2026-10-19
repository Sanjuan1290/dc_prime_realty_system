import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FiActivity,
  FiArchive,
  FiClock,
  FiDatabase,
  FiDownload,
  FiPlus,
  FiRefreshCw,
  FiTrash2,
} from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import StatusAlert from '../../components/Shared/StatusAlert'
import ArchiveAuditLogsModal from '../../components/System/auditLogsComponents/ArchiveAuditLogsModal'
import AuditLogDetailsModal from '../../components/System/auditLogsComponents/AuditLogDetailsModal'
import AuditLogFilters from '../../components/System/auditLogsComponents/AuditLogFilters'
import AuditLogTable from '../../components/System/auditLogsComponents/AuditLogTable'
import ExportAuditReportModal from '../../components/System/auditLogsComponents/ExportAuditReportModal'
import AuditArchiveWorkspace from '../../components/System/auditLogsComponents/AuditArchiveWorkspace'
import { PERMISSIONS, hasPermission } from '../../config/permissions'
import { useFetch, useFetchPost } from '../../utils/useFetch'
import useCurrentUser from '../../utils/useCurrentUser'

const StatCard = ({ label, value, helper, icon: Icon, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-950',
    blue: 'border-blue-100 bg-blue-50 text-blue-950',
    emerald: 'border-emerald-100 bg-emerald-50 text-emerald-950',
    amber: 'border-amber-100 bg-amber-50 text-amber-950',
    red: 'border-red-100 bg-red-50 text-red-950',
    violet: 'border-violet-100 bg-violet-50 text-violet-950',
  }

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${tones[tone] || tones.slate}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-black">{value}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{helper}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80 text-slate-700 shadow-sm">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  )
}

const downloadArchiveExport = async (exportUrl, fallbackFilename) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}${exportUrl}`, {
    credentials: 'include',
  })

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || ''
    const payload = contentType.includes('application/json') ? await response.json() : null
    throw new Error(payload?.message || 'Failed to download the audit archive export.')
  }

  const blob = await response.blob()
  const disposition = response.headers.get('content-disposition') || ''
  const filenameMatch = disposition.match(/filename="?([^";]+)"?/i)
  const filename = filenameMatch?.[1] || fallbackFilename || 'audit-logs-archive.csv'
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(objectUrl)
}

const formatIsoDate = ({ year, month, day }) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`

const manilaToday = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

const shiftIsoDate = (value, days) => {
  const [year, month, day] = String(value || '').split('-').map(Number)
  if (!year || !month || !day) return ''
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return formatIsoDate({
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  })
}

const resolveAuditDateRange = (range, customFrom = '', customTo = '') => {
  if (range === 'custom') return { from: customFrom, to: customTo }
  if (range === 'all') return { from: '', to: '' }

  const today = manilaToday()
  if (range === 'today') return { from: today, to: today }
  if (range === 'yesterday') {
    const yesterday = shiftIsoDate(today, -1)
    return { from: yesterday, to: yesterday }
  }

  const [year, month] = today.split('-')
  if (range === 'this_month') return { from: `${year}-${month}-01`, to: today }
  if (range === 'this_year') return { from: `${year}-01-01`, to: today }

  return { from: '', to: '' }
}

const AuditLogs = () => {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [urlParams, setUrlParams] = useSearchParams()
  const linkedReviewId = /^\d+$/.test(urlParams.get('reviewId') || '') ? Number(urlParams.get('reviewId')) : null
  const clearReviewFilter = () => {
    const next = new URLSearchParams(urlParams)
    next.delete('reviewId')
    setUrlParams(next)
    setPage(1)
  }
  const { data: currentUserData } = useCurrentUser()
  const [alert, setAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [action, setAction] = useState('all')
  const [module, setModule] = useState('all')
  const [dateRange, setDateRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)
  const [selectedLog, setSelectedLog] = useState(null)
  const [recordDestination, setRecordDestination] = useState(null)
  const [recordDestinationBusy, setRecordDestinationBusy] = useState(false)
  const [recordDestinationError, setRecordDestinationError] = useState('')
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [auditTab, setAuditTab] = useState('active')
  const [archiveRequest, setArchiveRequest] = useState(null)
  const [archiveError, setArchiveError] = useState('')

  const canArchive = ['super_admin', 'system_admin'].includes(currentUserData?.user?.role)
  const canExport = hasPermission(currentUserData?.user, PERMISSIONS.AUDIT_LOGS_EXPORT)
  const canIncludeArchived = hasPermission(currentUserData?.user, PERMISSIONS.AUDIT_LOGS_ARCHIVE)
  const canBrowseArchive = canArchive && canIncludeArchived
  const canIncludeCaseHistory = hasPermission(currentUserData?.user, PERMISSIONS.WORKFLOW_AUDIT_REVIEW)

  const resolvedDateRange = useMemo(
    () => resolveAuditDateRange(dateRange, from, to),
    [dateRange, from, to]
  )

  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (linkedReviewId) params.set('reviewId', String(linkedReviewId))
    if (search.trim()) params.set('search', search.trim())
    if (action !== 'all') params.set('action', action)
    if (module !== 'all') params.set('module', module)
    if (resolvedDateRange.from) params.set('from', resolvedDateRange.from)
    if (resolvedDateRange.to) params.set('to', resolvedDateRange.to)
    return params.toString()
  }, [action, limit, module, page, resolvedDateRange, search, linkedReviewId])

  const { data, isLoading, isFetching, isPlaceholderData, isError, error, refetch } = useQuery({
    queryKey: ['audit-logs', queryString],
    queryFn: () => useFetch(`/audit-logs?${queryString}`),
    placeholderData: (previousData) => previousData,
  })

  const requestArchiveMutation = useMutation({
    mutationFn: (payload) => useFetchPost('/audit-logs/archive/request', payload, { confirmationHandled: 'technical' }),
    onMutate: () => setArchiveError(''),
    onSuccess: (result) => {
      setArchiveRequest(result?.data || null)
      setArchiveError('')
    },
    onError: (mutationError) => {
      setArchiveError(mutationError?.message || 'Failed to send the verification code.')
    },
  })

  const confirmArchiveMutation = useMutation({
    mutationFn: (code) => useFetchPost('/audit-logs/archive/confirm', {
      verificationId: archiveRequest?.verificationId,
      code,
    }, {
      doubleCheck: {
        type: 'audit-archive',
        data: {
          eligibleCount: archiveRequest?.eligibleCount,
          retentionDays: archiveRequest?.retentionDays,
          cutoffAt: archiveRequest?.cutoffAt,
          maskedEmail: archiveRequest?.maskedEmail,
        },
      },
    }),
    onMutate: () => setArchiveError(''),
    onSuccess: async (result) => {
      setShowArchiveModal(false)
      setArchiveRequest(null)
      setArchiveError('')
      setPage(1)
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })

      try {
        await downloadArchiveExport(result?.data?.exportUrl, result?.data?.exportFilename)
        setAlert({ type: 'success', message: result?.message || 'Old audit logs were exported and archived.' })
      } catch (downloadError) {
        setAlert({
          type: 'warning',
          message: `${result?.message || 'Old audit logs were archived.'} ${downloadError?.message || 'The export download did not start.'}`,
        })
      }
    },
    onError: (mutationError) => {
      setArchiveError(mutationError?.message || 'Failed to archive audit logs.')
    },
  })

  const summary = data?.summary || { total: 0, created: 0, updated: 0, deleted: 0, last24Hours: 0 }
  const archivePolicy = data?.archivePolicy || {
    retentionDays: 365,
    minRetentionDays: 90,
    maxRetentionDays: 3650,
    archivedTotal: 0,
    eligibleTotal: 0,
    lastArchivedAt: null,
  }
  const modules = data?.modules || []
  const logs = data?.data || []
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1 }

  const changeDateRange = (nextRange) => {
    if (nextRange === 'custom' && dateRange !== 'custom') {
      const currentRange = resolveAuditDateRange(dateRange, from, to)
      const fallbackDate = manilaToday()
      setFrom(currentRange.from || fallbackDate)
      setTo(currentRange.to || fallbackDate)
    }
    setDateRange(nextRange)
    setPage(1)
  }

  const resetFilters = () => {
    setSearch('')
    setAction('all')
    setModule('all')
    setDateRange('all')
    setFrom('')
    setTo('')
    setPage(1)
  }

  const openLogDetails = (log) => {
    setSelectedLog(log)
    setRecordDestination(null)
    setRecordDestinationError('')
    setRecordDestinationBusy(false)
  }

  const findOriginalAuditRecord = async (log) => {
    const id = Number(log?.id)
    if (!Number.isSafeInteger(id) || id <= 0) return
    setRecordDestinationBusy(true)
    setRecordDestination(null)
    setRecordDestinationError('')
    try {
      const result = await useFetch(`/audit-logs/records/${id}/location`)
      // Ignore stale results after opening another Audit Log.
      if (Number(selectedLog?.id) === id) setRecordDestination(result.data)
    } catch (error) {
      if (Number(selectedLog?.id) === id) setRecordDestinationError(error?.message || 'Could not verify the live record. Saved Audit Log details are still available.')
    } finally {
      if (Number(selectedLog?.id) === id) setRecordDestinationBusy(false)
    }
  }

  const openArchiveModal = () => {
    setArchiveRequest(null)
    setArchiveError('')
    requestArchiveMutation.reset()
    confirmArchiveMutation.reset()
    setShowArchiveModal(true)
  }

  const closeArchiveModal = () => {
    if (requestArchiveMutation.isPending || confirmArchiveMutation.isPending) return
    setShowArchiveModal(false)
    setArchiveRequest(null)
    setArchiveError('')
    requestArchiveMutation.reset()
    confirmArchiveMutation.reset()
  }

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <PageHeader
          title="Audit Logs"
          description="Track system activity, account actions, settings changes, and security events."
          icon={FiActivity}
        />

        {(auditTab === 'active' || !canBrowseArchive) ? <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {canExport ? <button type="button" onClick={() => setShowExportModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-blue-200 bg-white px-5 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50"><FiDownload className="h-4 w-4" />Export Audit Report</button> : null}

          <button
            type="button"
            onClick={() => canArchive && openArchiveModal()}
            disabled={!canArchive}
            title={!canArchive ? 'Super Admin or System Admin authority is required to archive old audit logs.' : 'Move old records into the archive'}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none disabled:hover:bg-slate-100"
          >
            <FiArchive className="h-4 w-4" />
            Move Old Records
          </button>
        </div> : null}
      </div>

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {isError ? (
        <StatusAlert type="error" message={error?.message || 'Failed to load audit logs.'} />
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <StatCard label="Recent Records" value={summary.total} helper="Records still in daily activity" icon={FiDatabase} />
        <StatCard label="Old Records" value={archivePolicy.archivedTotal} helper={`${archivePolicy.eligibleTotal} ready to move into archive`} icon={FiArchive} tone="violet" />
        <StatCard label="Created" value={summary.created} helper="Create actions" icon={FiPlus} tone="emerald" />
        <StatCard label="Updated" value={summary.updated} helper="Save/edit actions" icon={FiActivity} tone="blue" />
        <StatCard label="Delete Actions" value={summary.deleted} helper="Recorded delete events" icon={FiTrash2} tone="red" />
        <StatCard label="Last 24 Hours" value={summary.last24Hours} helper="Recent activity" icon={FiClock} tone="amber" />
      </section>

      <section className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-4 text-sm font-semibold text-blue-900">
        <p className="font-black">Recent records are kept for at least {archivePolicy.retentionDays} days</p>
        <p className="mt-1">Moving records into the archive keeps a protected copy. Only authorized administrators can move older records after password and email verification. Expired archive files can be deleted only through the separate, protected cleanup process.</p>
      </section>

      {canBrowseArchive ? <nav aria-label="Audit log sections" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        {[["active","Recent Activity"],["archived","Old Records"],["batches","Saved Archive Files"],["settings","Cleanup Settings"]].map(([value,label])=><button key={value} type="button" onClick={()=>setAuditTab(value)} className={`rounded-xl px-4 py-2.5 text-sm font-bold ${auditTab===value?'bg-blue-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>{label}</button>)}
      </nav> : null}
      {auditTab==='active' || !canBrowseArchive ? <>
      <AuditLogFilters
        search={search}
        setSearch={(value) => { setSearch(value); setPage(1) }}
        action={action}
        setAction={(value) => { setAction(value); setPage(1) }}
        module={module}
        setModule={(value) => { setModule(value); setPage(1) }}
        modules={modules}
        dateRange={dateRange}
        setDateRange={changeDateRange}
        from={from}
        setFrom={(value) => { setFrom(value); setPage(1) }}
        to={to}
        setTo={(value) => { setTo(value); setPage(1) }}
        onReset={resetFilters}
        onRefresh={refetch}
        isFetching={isFetching}
      />

      {linkedReviewId ? <div role="status" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-900">
        <span>{isLoading ? 'Finding records linked to' : `Found ${pagination.total} Audit Log ${pagination.total === 1 ? 'entry' : 'entries'} linked to`} Review #{linkedReviewId}<span className="mt-1 block text-xs font-normal text-blue-800">Summary cards above show all recent activity; the table below shows only entries linked to this review.</span></span>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => navigate(`/portal/${currentUserData?.user?.role || 'system_admin'}/review-center/reviews/${linkedReviewId}`)} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5">View Review</button>
          <button type="button" onClick={clearReviewFilter} className="rounded-lg border border-blue-200 bg-white px-3 py-1.5">Show All Activity</button>
        </div>
      </div> : null}
      {linkedReviewId && !isError && !isLoading && data?.reviewHistory?.length ? (
        <section aria-label="Review history" className="mb-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900">Review History</h3>
          <p className="mt-1 text-xs text-slate-600">These are the recorded Review Center events. The Audit Log entries below show linked system actions.</p>
          <ol className="mt-3 space-y-3 border-l-2 border-slate-200 pl-4">
            {data.reviewHistory.map((event, index) => (
              <li key={`${event.eventType}-${index}`} className="text-sm">
                <p className="font-semibold text-slate-800">{event.message || String(event.eventType || 'Review updated').replace(/_/g, ' ')}</p>
                <p className="mt-1 text-xs text-slate-500">{event.actorName || 'System'} · {event.createdAt ? new Date(event.createdAt).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' }) : 'Date unavailable'}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <AuditLogTable
        logs={logs}
        isLoading={isLoading}
        isPageChanging={isFetching && isPlaceholderData}
        pagination={pagination}
        onView={openLogDetails}
        page={page}
        setPage={setPage}
        limit={limit}
        setLimit={setLimit}
        emptyMessage={linkedReviewId ? 'No Audit Log entries are linked to this review under the current filters. Review History still shows the saved review events.' : 'No audit logs found for the selected filters.'}
      />

      {selectedLog ? (
        <AuditLogDetailsModal log={selectedLog} onClose={() => setSelectedLog(null)} onResolveRecord={findOriginalAuditRecord} destination={recordDestination} destinationBusy={recordDestinationBusy} destinationError={recordDestinationError} onViewReview={(reviewId) => navigate(`/portal/${currentUserData?.user?.role || 'system_admin'}/review-center/reviews/${reviewId}`)} />
      ) : null}

      {showExportModal ? (
        <ExportAuditReportModal
          initial={{ dateRange, from, to, action, module, search, reviewId: linkedReviewId }}
          modules={modules}
          actorName={[currentUserData?.user?.first_name,currentUserData?.user?.last_name].filter(Boolean).join(' ') || currentUserData?.user?.email || 'Authorized user'}
          canIncludeArchived={canIncludeArchived}
          canIncludeCaseHistory={canIncludeCaseHistory}
          onClose={() => setShowExportModal(false)}
        />
      ) : null}

      {showArchiveModal ? (
        <ArchiveAuditLogsModal
          actorRole={currentUserData?.user?.role}
          onClose={closeArchiveModal}
          onRequestCode={(payload) => requestArchiveMutation.mutate(payload)}
          onConfirmCode={(code) => confirmArchiveMutation.mutate(code)}
          requestData={archiveRequest}
          errorMessage={archiveError}
          isRequesting={requestArchiveMutation.isPending}
          isArchiving={confirmArchiveMutation.isPending}
          defaultRetentionDays={archivePolicy.retentionDays}
          minRetentionDays={archivePolicy.minRetentionDays}
          maxRetentionDays={archivePolicy.maxRetentionDays}
          eligibleCount={archivePolicy.eligibleTotal}
        />
      ) : null}
      </> : <AuditArchiveWorkspace key={auditTab} section={auditTab} isSuperAdmin={currentUserData?.user?.role==='super_admin'} />}
    </main>
  )
}

export default AuditLogs







