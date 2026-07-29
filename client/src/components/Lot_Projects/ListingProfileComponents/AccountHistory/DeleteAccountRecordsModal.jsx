import { useMemo, useState } from 'react'
import { FiAlertTriangle, FiCheckCircle, FiKey, FiLoader, FiLock, FiMail, FiTrash2, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPost } from '../../../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(Number(value || 0))

const DeleteAccountRecordsModal = ({ projectSlug, account, onClose, onDeleted }) => {
  const [password, setPassword] = useState('')
  const [reason, setReason] = useState('')
  const [confirmationText, setConfirmationText] = useState('')
  const [code, setCode] = useState('')
  const [requestData, setRequestData] = useState(null)
  const [notice, setNotice] = useState(null)
  const [isRequesting, setIsRequesting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const requiredText = `DELETE ${account?.accountReference || ''}`
  const busy = isRequesting || isDeleting
  const preview = requestData?.preview || {}
  const totalRows = useMemo(() => Object.values(preview.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0), [preview.counts])

  const requestCode = async (event) => {
    event.preventDefault()
    setNotice(null)
    if (!password) return setNotice({ type: 'warning', message: 'Enter the administrator password.' })
    if (reason.trim().length < 10) return setNotice({ type: 'warning', message: 'Enter a deletion reason with at least 10 characters.' })
    if (confirmationText.trim() !== requiredText) return setNotice({ type: 'warning', message: `Type ${requiredText} exactly.` })

    setIsRequesting(true)
    setNotice({ type: 'loading', message: 'Verifying password and sending the email code...' })
    try {
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/accounts/${account.id}/purge-code`, {
        password,
        deletionReason: reason.trim(),
        confirmationText: confirmationText.trim(),
      })
      setRequestData(result?.data || null)
      setPassword('')
      setNotice({ type: 'success', message: result?.message || 'Verification code sent.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Failed to request the verification code.' })
    } finally {
      setIsRequesting(false)
    }
  }

  const confirmDeletion = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(code)) return setNotice({ type: 'warning', message: 'Enter the six-digit email code.' })
    setIsDeleting(true)
    setNotice({ type: 'loading', message: 'Deleting protected files and closed account records...' })
    try {
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/accounts/${account.id}/purge`, {
        verificationId: requestData.verificationId,
        code,
      })
      setNotice({ type: 'success', message: result?.message || 'Account records permanently deleted.' })
      await onDeleted?.(result)
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Permanent deletion failed. The retained records were not cleared.' })
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/70 p-4">
      <div className="flex max-h-[95vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-red-200 bg-red-50 px-6 py-5">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-red-700 shadow-sm"><FiAlertTriangle className="h-5 w-5" /></div>
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-red-700">Full-access administrator only</p>
              <h2 className="mt-1 text-xl font-black text-red-950">Permanently Delete Account Records</h2>
              <p className="mt-1 text-sm font-semibold text-red-800">{account?.accountReference} · {account?.buyerName} · {account?.unitId}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="flex h-10 w-10 items-center justify-center rounded-xl text-red-600 transition hover:bg-red-100 disabled:opacity-50" aria-label="Close deletion modal"><FiX /></button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} className="mb-4" /> : null}

          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold leading-6 text-red-900">
            This removes the selected closed buyer account, payments, payment logs, SOA records, documents, commissions, receipts, buyer-form records, and Cloudinary assets. The unit and the permanent deletion audit entry remain.
          </div>

          {!requestData ? (
            <form onSubmit={requestCode} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Verified payments</p><p className="mt-1 text-lg font-black text-slate-950">{money(account?.verifiedPaymentTotal)}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Documents</p><p className="mt-1 text-lg font-black text-slate-950">{account?.documentCount || 0}</p></div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Commissions</p><p className="mt-1 text-lg font-black text-slate-950">{account?.commissionCount || 0}</p></div>
              </div>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-700"><FiLock /> Administrator password</span>
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} disabled={busy} autoComplete="current-password" placeholder="Enter your current password" className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-slate-700">Deletion reason</span>
                <textarea value={reason} onChange={(event) => setReason(event.target.value)} disabled={busy} rows={4} placeholder="Explain why this closed account must be permanently removed" className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50" />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-black text-slate-700">Type <span className="text-red-700">{requiredText}</span></span>
                <input value={confirmationText} onChange={(event) => setConfirmationText(event.target.value)} disabled={busy} placeholder={requiredText} className="h-12 w-full rounded-xl border border-slate-300 px-4 font-mono text-sm font-bold outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50" />
              </label>

              <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={busy || confirmationText.trim() !== requiredText} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300">
                  {isRequesting ? <FiLoader className="animate-spin" /> : <FiMail />} {isRequesting ? 'Sending Code...' : 'Verify Password & Send Code'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={confirmDeletion} className="space-y-5">
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">
                A six-digit code was sent to <strong>{requestData.maskedEmail}</strong>. It expires in {requestData.expiresInMinutes} minutes.
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-black text-slate-500">Rows found</p><p className="mt-1 text-xl font-black">{totalRows}</p></div>
                <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-black text-slate-500">Verified payments</p><p className="mt-1 text-base font-black">{money(preview.verifiedPayments)}</p></div>
                <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-black text-slate-500">Released commission</p><p className="mt-1 text-base font-black">{money(preview.releasedCommission)}</p></div>
                <div className="rounded-xl border border-slate-200 p-3"><p className="text-xs font-black text-slate-500">Unpaid earned stages</p><p className="mt-1 text-xl font-black">{preview.unpaidEarnedStages || 0}</p></div>
              </div>

              <label className="block">
                <span className="mb-1.5 flex items-center gap-2 text-sm font-black text-slate-700"><FiKey /> Email verification code</span>
                <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} disabled={busy} placeholder="000000" className="h-14 w-full rounded-xl border border-slate-300 px-4 text-center font-mono text-2xl font-black tracking-[0.4em] outline-none transition focus:border-red-400 focus:ring-4 focus:ring-red-50" />
              </label>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-black text-red-900"><FiAlertTriangle className="mr-2 inline" />This action cannot be undone.</div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button type="button" onClick={() => { setRequestData(null); setCode(''); setNotice(null) }} disabled={busy} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 disabled:opacity-50">Start Over</button>
                <button type="submit" disabled={busy || code.length !== 6 || Number(preview.unpaidEarnedStages || 0) > 0} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-red-700 px-5 text-sm font-black text-white transition hover:bg-red-800 disabled:cursor-not-allowed disabled:bg-red-300">
                  {isDeleting ? <FiLoader className="animate-spin" /> : <FiTrash2 />} {isDeleting ? 'Deleting Records...' : 'Permanently Delete'}
                </button>
              </div>
            </form>
          )}
        </div>

        {requestData && Number(preview.unpaidEarnedStages || 0) > 0 ? (
          <footer className="border-t border-amber-200 bg-amber-50 px-6 py-4 text-sm font-black text-amber-900"><FiCheckCircle className="mr-2 inline" />Resolve every earned commission stage before permanent deletion.</footer>
        ) : null}
      </div>
    </div>
  )
}

export default DeleteAccountRecordsModal
