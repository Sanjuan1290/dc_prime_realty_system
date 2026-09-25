import { useState } from 'react'
import { FiKey, FiLock, FiMail, FiX } from 'react-icons/fi'
import StatusAlert from './StatusAlert'
import { useFetchPost } from '../../utils/useFetch'

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100'

const SettingsAuthorizationModal = ({
  title = 'Authorize Settings Change',
  description = 'Settings changes require the current Super Admin password and email verification code.',
  codeEndpoint,
  settingsPayload,
  onClose,
  onConfirm,
  isSaving = false,
  authorizationLabel = 'Super Admin',
}) => {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [code, setCode] = useState('')
  const [notice, setNotice] = useState(null)
  const [isSending, setIsSending] = useState(false)

  const sendCode = async () => {
    if (reason.trim().length < 5) {
      setNotice({ type: 'error', message: 'Enter a clear reason for this settings change.' })
      return
    }
    if (!password) {
      setNotice({ type: 'error', message: `${authorizationLabel} password is required.` })
      return
    }
    setIsSending(true)
    setNotice({ type: 'loading', message: 'Verifying password and sending email code...' })
    try {
      const result = await useFetchPost(codeEndpoint, {
        ...settingsPayload,
        reason: reason.trim(),
        password,
      }, { confirmationHandled: 'technical' })
      setVerificationId(result?.data?.verificationId || null)
      setMaskedEmail(result?.data?.maskedEmail || '')
      setPassword('')
      setNotice({ type: 'success', message: result?.message || 'Verification code sent.' })
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Unable to send verification code.' })
    } finally {
      setIsSending(false)
    }
  }

  const confirm = () => {
    if (!verificationId) return
    if (!/^\d{6}$/.test(code.trim())) {
      setNotice({ type: 'error', message: 'Enter the 6-digit email verification code.' })
      return
    }
    onConfirm?.({
      ...settingsPayload,
      reason: reason.trim(),
      verificationId,
      code: code.trim(),
    })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Protected Authorization</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{title}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving || isSending} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close authorization"><FiX /></button>
        </header>

        <div className="grid gap-4 p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-700">Reason for change *</span>
            <textarea value={reason} disabled={Boolean(verificationId)} onChange={(event) => setReason(event.target.value)} placeholder="Explain why these settings are being changed." className="min-h-24 resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
          </label>

          {!verificationId ? (
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiLock /> {authorizationLabel} Password *</span>
              <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder={`Enter ${authorizationLabel.toLowerCase()} password`} />
            </label>
          ) : (
            <label className="grid gap-2">
              <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiMail /> Email Verification Code *</span>
              <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputClass} tracking-[0.35em]`} placeholder="000000" />
              <span className="text-xs font-semibold text-slate-500">Code sent to {maskedEmail || `the ${authorizationLabel.toLowerCase()} email`}.</span>
            </label>
          )}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving || isSending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          {!verificationId ? (
            <button type="button" onClick={sendCode} disabled={isSending || isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"><FiKey />{isSending ? 'Sending Code...' : 'Verify Password & Send Code'}</button>
          ) : (
            <button type="button" onClick={confirm} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"><FiLock />{isSaving ? 'Saving...' : 'Continue to Final Review'}</button>
          )}
        </footer>
      </div>
    </div>
  )
}

export default SettingsAuthorizationModal

