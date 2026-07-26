import { useEffect, useState } from 'react'
import { FiClipboard, FiLink, FiLoader, FiMail, FiRefreshCw, FiSlash, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const formatDateTime = (value) => {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return new Intl.DateTimeFormat('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Manila',
  }).format(date)
}

const activeStatuses = new Set(['active', 'opened'])

const BuyerFormLinkModal = ({
  listing,
  currentLink,
  generatedUrl,
  notice,
  isSaving = false,
  onGenerate,
  onRevoke,
  onClearNotice,
  onClose,
}) => {
  const [expiresHours, setExpiresHours] = useState('72')
  const [recipientEmail, setRecipientEmail] = useState(currentLink?.recipientEmail || '')
  const [recipientMobileNumber, setRecipientMobileNumber] = useState(currentLink?.recipientMobileNumber || '')
  const [sendEmail, setSendEmail] = useState(false)
  const [copyMessage, setCopyMessage] = useState('')

  useEffect(() => {
    setRecipientEmail(currentLink?.recipientEmail || '')
    setRecipientMobileNumber(currentLink?.recipientMobileNumber || '')
  }, [currentLink])

  const copyLink = async () => {
    if (!generatedUrl) return
    try {
      await navigator.clipboard.writeText(generatedUrl)
      setCopyMessage('Link copied.')
    } catch {
      setCopyMessage('Copy failed. Select the link and copy it manually.')
    }
  }

  const generate = () => {
    onClearNotice?.()
    onGenerate?.({
      expiresHours: Number(expiresHours || 72),
      recipientEmail: recipientEmail.trim(),
      recipientMobileNumber: recipientMobileNumber.trim(),
      sendEmail: Boolean(sendEmail && recipientEmail.trim()),
    })
  }

  const hasActiveLink = activeStatuses.has(String(currentLink?.status || '').toLowerCase())

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-black text-slate-950">Buyer Form Link</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              {listing?.unit_id || listing?.unitCode || 'Unit'} · Client Profile / Offer to Buy information only
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 disabled:opacity-60" aria-label="Close buyer form link modal">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : onClearNotice} /> : null}

          {currentLink ? (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">Latest Link</p>
                  <p className="mt-1 text-sm font-black capitalize text-slate-950">{String(currentLink.status || '-').replace(/_/g, ' ')}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${hasActiveLink ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}>
                  Generation {currentLink.generation || '-'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-xs font-semibold text-slate-600 sm:grid-cols-2">
                <p>Generated: <span className="font-black text-slate-800">{formatDateTime(currentLink.generatedAt)}</span></p>
                <p>Expires: <span className="font-black text-slate-800">{formatDateTime(currentLink.expiresAt)}</span></p>
                <p>First opened: <span className="font-black text-slate-800">{formatDateTime(currentLink.firstOpenedAt)}</span></p>
                <p>Submitted: <span className="font-black text-slate-800">{formatDateTime(currentLink.submittedAt)}</span></p>
              </div>
            </section>
          ) : null}

          {generatedUrl ? (
            <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center gap-2 text-blue-800">
                <FiLink className="h-4 w-4" />
                <h3 className="text-sm font-black">New link</h3>
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-blue-800">
                Copy this link now. The server stores only its hash, so the raw link cannot be displayed again after this modal closes.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input readOnly value={generatedUrl} onFocus={(event) => event.target.select()} className="h-11 min-w-0 flex-1 rounded-xl border border-blue-200 bg-white px-3 text-xs font-semibold text-slate-700 outline-none" />
                <button type="button" onClick={copyLink} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white hover:bg-blue-700">
                  <FiClipboard className="h-4 w-4" /> Copy Link
                </button>
              </div>
              {copyMessage ? <p className="mt-2 text-xs font-black text-blue-800">{copyMessage}</p> : null}
            </section>
          ) : null}

          <section className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-black text-slate-950">Generate a new link</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">Creating a new link immediately replaces any active link for this unit.</p>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-black text-slate-700">Expires after</span>
                <select value={expiresHours} onChange={(event) => setExpiresHours(event.target.value)} className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50">
                  <option value="24">24 hours</option>
                  <option value="48">48 hours</option>
                  <option value="72">72 hours</option>
                  <option value="120">5 days</option>
                  <option value="168">7 days</option>
                </select>
              </label>

              <label className="grid gap-1.5">
                <span className="text-xs font-black text-slate-700">Buyer email</span>
                <input type="email" value={recipientEmail} onChange={(event) => setRecipientEmail(event.target.value)} placeholder="buyer@email.com (optional)" className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
              </label>

              <label className="grid gap-1.5 sm:col-span-2">
                <span className="text-xs font-black text-slate-700">Buyer mobile number</span>
                <input value={recipientMobileNumber} onChange={(event) => setRecipientMobileNumber(event.target.value)} placeholder="09XXXXXXXXX (optional)" className="h-11 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
              </label>
            </div>

            <label className="mt-4 flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <input type="checkbox" checked={sendEmail} onChange={(event) => setSendEmail(event.target.checked)} disabled={!recipientEmail.trim()} className="mt-0.5 h-4 w-4" />
              <span className="text-xs font-semibold text-slate-600">
                Send the generated link by email. SMTP must be configured. You can still copy the link manually.
              </span>
            </label>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-between">
          <div>
            {hasActiveLink ? (
              <button type="button" onClick={() => onRevoke?.(currentLink)} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-60">
                <FiSlash className="h-4 w-4" /> Revoke Active Link
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <button type="button" onClick={onClose} disabled={isSaving} className="h-11 rounded-xl border border-slate-300 px-5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">Close</button>
            <button type="button" onClick={generate} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60">
              {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : hasActiveLink ? <FiRefreshCw className="h-4 w-4" /> : <FiMail className="h-4 w-4" />}
              {isSaving ? 'Generating...' : hasActiveLink ? 'Generate New Link' : 'Generate Link'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default BuyerFormLinkModal

