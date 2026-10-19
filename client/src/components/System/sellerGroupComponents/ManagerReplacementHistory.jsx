import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useQuery } from '@tanstack/react-query'
import { FiClock, FiRepeat, FiChevronLeft, FiChevronRight, FiRefreshCw, FiX } from 'react-icons/fi'
import { useFetch as fetchApi } from '../../../utils/useFetch'

const PAGE_SIZE = 15

const formatDate = (value) => {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

const roleLabel = (role) => ({
  division_manager: 'Division Manager',
  sales_director: 'Sales Director',
  unit_manager: 'Unit Manager',
}[role] || role || '—')

const ManagerReplacementHistory = ({ groupId, networkName, onClose }) => {
  const [page, setPage] = useState(1)
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const query = useQuery({
    queryKey: ['manager-replacement-history', groupId, page],
    queryFn: () => fetchApi(`/seller-groups/${groupId}/managers/replacements?page=${page}`),
    retry: false,
  })
  const records = Array.isArray(query.data?.data) ? query.data.data : []

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
        if (!focusable?.length) return
        const first = focusable[0]
        const last = focusable[focusable.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      if (previousFocus instanceof HTMLElement) previousFocus.focus()
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/55 p-3 sm:p-6"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="replacement-history-title"
        className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="replacement-history-title" className="flex items-center gap-2 text-lg font-bold text-slate-950">
              <FiClock className="shrink-0 text-blue-600" /> Replacement History
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {networkName ? `${networkName} · ` : ''}Previous manager replacements and affected teams
            </p>
          </div>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close replacement history"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <FiX />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">
          {query.isPending ? (
            <p role="status" className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-600">Loading replacement history...</p>
          ) : query.isError ? (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="text-sm font-semibold text-red-800">Unable to load replacement history.</p>
              <p className="mt-1 text-sm text-red-700">{query.error?.message || 'The server could not retrieve the history.'}</p>
              <button type="button" onClick={() => query.refetch()} disabled={query.isFetching} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-800 hover:bg-red-100 disabled:opacity-50">
                <FiRefreshCw /> {query.isFetching ? 'Retrying...' : 'Try again'}
              </button>
            </div>
          ) : records.length === 0 ? (
            <p className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              {page === 1 ? 'No manager replacements have been recorded for this Network.' : 'No more replacement records on this page.'}
            </p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full min-w-[790px] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th scope="col" className="px-4 py-3">Date</th>
                    <th scope="col" className="px-4 py-3">Manager Role</th>
                    <th scope="col" className="px-4 py-3">Previous Manager</th>
                    <th scope="col" className="px-4 py-3">Replacement</th>
                    <th scope="col" className="px-4 py-3">Sellers Moved</th>
                    <th scope="col" className="px-4 py-3">Review</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((item) => (
                    <tr key={item.replacement_id} className="align-top">
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(item.created_at)}</td>
                      <td className="px-4 py-3 text-slate-600">{roleLabel(item.outgoing_role)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900">
                        {item.outgoing_name || '—'}
                        {item.old_account_code ? <p className="mt-1 text-xs font-normal text-slate-500">{item.old_account_code}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {item.replacement_name || '—'}
                        {item.new_account_code ? <p className="mt-1 text-xs text-slate-500">{item.new_account_code}</p> : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700"><span className="inline-flex items-center gap-1"><FiRepeat />{item.direct_reports_moved ?? 0}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{item.operational_review_id ? `Review #${item.operational_review_id}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {records.some((item) => item.reason) ? (
                <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <p className="mb-2 font-bold text-slate-700">Recorded reasons</p>
                  <ul className="space-y-1">
                    {records.filter((item) => item.reason).map((item) => (
                      <li key={item.replacement_id}><strong>#{item.replacement_id}:</strong> {item.reason}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:px-6">
          <p className="text-xs text-slate-500">{query.isSuccess ? `${records.length} record${records.length === 1 ? '' : 's'} on page ${page}` : 'Replacement history'}</p>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1 || query.isPending} aria-label="Previous page" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40"><FiChevronLeft /></button>
            <span className="text-sm font-semibold text-slate-600">Page {page}</span>
            <button type="button" onClick={() => setPage((current) => current + 1)} disabled={!query.isSuccess || records.length < PAGE_SIZE} aria-label="Next page" className="rounded-lg border border-slate-200 bg-white p-2 text-slate-700 hover:bg-slate-100 disabled:opacity-40"><FiChevronRight /></button>
          </div>
        </footer>
      </div>
    </div>,
    document.body
  )
}

export default ManagerReplacementHistory
