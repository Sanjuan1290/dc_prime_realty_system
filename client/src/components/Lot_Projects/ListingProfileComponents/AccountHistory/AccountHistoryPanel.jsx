import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FiArrowRight, FiClock, FiRefreshCw, FiShield, FiTrash2, FiUser } from 'react-icons/fi'
import { useNavigate } from 'react-router-dom'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch } from '../../../../utils/useFetch'
import DeleteAccountRecordsModal from './DeleteAccountRecordsModal'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))
const dateText = (value) => value ? new Intl.DateTimeFormat('en-PH', { year: 'numeric', month: 'short', day: '2-digit', timeZone: 'Asia/Manila' }).format(new Date(value)) : '-'
const statusLabel = (value) => String(value || '-').replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
const statusTone = (value) => ({ active: 'bg-emerald-50 text-emerald-700 ring-emerald-100', pending_cancellation: 'bg-amber-50 text-amber-700 ring-amber-100', cancelled: 'bg-red-50 text-red-700 ring-red-100', closed_fully_paid: 'bg-blue-50 text-blue-700 ring-blue-100', deletion_pending: 'bg-violet-50 text-violet-700 ring-violet-100' }[value] || 'bg-slate-100 text-slate-700 ring-slate-200')

const AccountHistoryPanel = ({ projectSlug, listingId, isSuperAdmin = false }) => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [deleteAccount, setDeleteAccount] = useState(null)
  const [notice, setNotice] = useState(null)
  const query = useQuery({
    queryKey: ['lot-listing-accounts', projectSlug, listingId],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings/${listingId}/accounts`),
    enabled: Boolean(projectSlug && listingId),
    retry: false,
  })
  const accounts = query.data?.data || []

  const refresh = async () => {
    setNotice({ type: 'loading', message: 'Refreshing account history...' })
    try { await query.refetch(); setNotice({ type: 'success', message: 'Account history refreshed.' }) }
    catch (error) { setNotice({ type: 'error', message: error?.message || 'Failed to refresh account history.' }) }
  }

  const openAccount = (account) => {
    const basePath = `/lot-projects/${projectSlug}/listings/${listingId}`
    navigate(account.isCurrent ? basePath : `${basePath}/accounts/${account.id}`)
  }

  const handleAccountKeyDown = (event, account) => {
    if (!['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    openAccount(account)
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-4" /> : null}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2"><FiClock className="text-blue-600" /><h2 className="text-xl font-black text-slate-950">Buyer Account History</h2></div>
          <p className="mt-1 text-sm font-semibold text-slate-500">Open an account to view only that buyer's profile, payments, SOA, documents, and commissions.</p>
        </div>
        <button type="button" onClick={refresh} disabled={query.isFetching} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"><FiRefreshCw className={query.isFetching ? 'animate-spin' : ''} /> Refresh</button>
      </div>

      {query.isLoading ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-8 text-center text-sm font-black text-slate-600">Loading buyer account history...</div> : null}
      {query.isError ? <div className="mt-5"><StatusAlert type="error" message={query.error?.message || 'Failed to load account history.'} /></div> : null}
      {query.data?.migrationRequired ? <div className="mt-5"><StatusAlert type="warning" message="Run the buyer account retention migration to activate account history." /></div> : null}

      {!query.isLoading && !query.isError ? (
        <div className="mt-5 space-y-4">
          {accounts.map((account) => (
            <article
              key={account.id}
              role="link"
              tabIndex={0}
              aria-label={`View ${account.accountReference} for ${account.buyerName}`}
              onClick={() => openAccount(account)}
              onKeyDown={(event) => handleAccountKeyDown(event, account)}
              className={`cursor-pointer rounded-2xl border p-4 transition hover:border-blue-300 hover:bg-blue-50/40 focus:outline-none focus:ring-4 focus:ring-blue-100 ${account.isCurrent ? 'border-blue-200 bg-blue-50/40' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-black text-slate-950">{account.accountReference}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusTone(account.status)}`}>{statusLabel(account.status)}</span>
                    {account.isCurrent ? <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-black text-white">Current Account</span> : <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">Read-only Record</span>}
                  </div>
                  <div className="mt-3 flex items-center gap-2"><FiUser className="text-slate-400" /><p className="text-base font-black text-slate-950">{account.buyerName}</p></div>
                  <p className="mt-1 text-sm font-semibold text-slate-500">Reserved {dateText(account.reservationDate)} · Closed {dateText(account.closedAt || account.cancellationDate)}</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {isSuperAdmin && account.status === 'cancelled' && !account.isCurrent ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDeleteAccount(account)
                      }}
                      onKeyDown={(event) => event.stopPropagation()}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100"
                    >
                      <FiTrash2 /> Permanently Delete Records
                    </button>
                  ) : null}
                  <span className="inline-flex h-10 items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700">
                    {account.isCurrent ? 'Open Current Account' : 'View Full Account'} <FiArrowRight />
                  </span>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Verified payments</p><p className="mt-1 text-base font-black text-slate-950">{money(account.verifiedPaymentTotal)}</p><p className="text-xs font-semibold text-slate-500">{account.paymentCount} payment(s)</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Refunded</p><p className="mt-1 text-base font-black text-slate-950">{money(account.refundAmount)}</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Discontinued</p><p className="mt-1 text-base font-black text-slate-950">{money(account.discontinuedAmount)}</p><p className="text-xs font-semibold text-slate-500">{Number(account.commissionableRetainedPercent || 0).toFixed(2)}% commissionable</p></div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-black uppercase text-slate-500">Retained records</p><p className="mt-1 text-base font-black text-slate-950">{account.documentCount} docs · {account.commissionCount} commissions</p></div>
              </div>
            </article>
          ))}

          {!accounts.length ? <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center"><FiShield className="mx-auto h-9 w-9 text-slate-300" /><p className="mt-3 text-sm font-black text-slate-700">No buyer accounts recorded</p></div> : null}
        </div>
      ) : null}

      {deleteAccount ? (
        <DeleteAccountRecordsModal
          projectSlug={projectSlug}
          account={deleteAccount}
          onClose={() => setDeleteAccount(null)}
          onDeleted={async (result) => {
            setDeleteAccount(null)
            setNotice({ type: 'success', message: result?.message || 'Account records permanently deleted.' })
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['lot-listing-accounts', projectSlug, listingId] }),
              queryClient.invalidateQueries({ queryKey: ['lot-listing-profile', projectSlug, listingId] }),
              queryClient.invalidateQueries({ queryKey: ['lot-listings', projectSlug] }),
              queryClient.invalidateQueries({ queryKey: ['lot-dashboard', projectSlug] }),
              queryClient.invalidateQueries({ queryKey: ['lot-payment-logs', projectSlug] }),
              queryClient.invalidateQueries({ queryKey: ['lot-commissions', projectSlug] }),
            ])
          }}
        />
      ) : null}
    </section>
  )
}

export default AccountHistoryPanel
