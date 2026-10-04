import { useState } from 'react'
import { FiCheckCircle, FiClock, FiKey, FiLock, FiMail, FiShield, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPost } from '../../../utils/useFetch'

const inputClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100'

const roleLabel = (role = '') => ({
  operations_staff: 'Operations Staff',
  operations_head: 'Operations Head',
  system_admin: 'System Admin',
  super_admin: 'Super Admin',
}[role] || role || 'Current Account')

const ProjectSettingsAuthorizationModal = ({
  projectSlug,
  settingsPayload,
  actorRole = '',
  auditCaseId = null,
  onClose,
  onConfirm,
  isSaving = false,
}) => {
  const [reason, setReason] = useState('')
  const [password, setPassword] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [code, setCode] = useState('')
  const [approvalRequestId, setApprovalRequestId] = useState(null)
  const [requestNumber, setRequestNumber] = useState('')
  const [authorized, setAuthorized] = useState(false)
  const [notice, setNotice] = useState(null)
  const [busy, setBusy] = useState(false)

  const isSuperAdmin = actorRole === 'super_admin'
  const isStaff = actorRole === 'operations_staff'
  const isHead = actorRole === 'operations_head'
  const isSystemAdmin = actorRole === 'system_admin'

  const requestAuthorization = async () => {
    const cleanReason = reason.trim()
    if (cleanReason.length < 5) return setNotice({ type: 'error', message: 'Enter a clear reason for this settings change.' })
    if (isSuperAdmin && !password) return setNotice({ type: 'error', message: 'Super Admin password is required for emergency override.' })
    if (isSystemAdmin && !Number(auditCaseId || 0)) return setNotice({ type: 'error', message: 'Open this correction from a valid Auditor case in Review Center.' })

    setBusy(true)
    setNotice({
      type: 'loading',
      message: isStaff ? 'Requesting / checking Operations Head approval...' : isSuperAdmin ? 'Verifying emergency access...' : 'Checking authorization...',
    })
    try {
      const result = await useFetchPost(`/projects/lot-projects/${projectSlug}/settings/code`, {
        ...settingsPayload,
        reason: cleanReason,
        password: isSuperAdmin ? password : undefined,
        auditCaseId: isSystemAdmin ? Number(auditCaseId) : undefined,
      }, { confirmationHandled: 'technical' })
      const data = result?.data || {}

      if (data.verificationId) {
        setVerificationId(data.verificationId)
        setMaskedEmail(data.maskedEmail || '')
        setPassword('')
        setNotice({ type: 'success', message: result?.message || 'Emergency verification code sent.' })
        return
      }

      if (data.approvalRequestId) {
        setApprovalRequestId(data.approvalRequestId)
        setRequestNumber(data.requestNumber || '')
      }

      if (data.approved) {
        setAuthorized(true)
        setNotice({ type: 'success', message: result?.message || 'Authorization approved. Continue to Final Review.' })
      } else {
        setAuthorized(false)
        setNotice({ type: 'warning', message: result?.message || 'Waiting for Operations Head approval.' })
      }
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Unable to authorize this settings change.' })
    } finally {
      setBusy(false)
    }
  }

  const confirm = () => {
    const cleanReason = reason.trim()
    if (verificationId) {
      if (!/^\d{6}$/.test(code.trim())) return setNotice({ type: 'error', message: 'Enter the 6-digit email verification code.' })
      return onConfirm?.({ ...settingsPayload, reason: cleanReason, verificationId, code: code.trim() })
    }
    if (!authorized) return
    onConfirm?.({
      ...settingsPayload,
      reason: cleanReason,
      approvalRequestId: isStaff ? approvalRequestId : undefined,
      auditCaseId: isSystemAdmin ? Number(auditCaseId || 0) || undefined : undefined,
    })
  }

  const statusTitle = isStaff
    ? 'Operations Head Approval'
    : isSystemAdmin
      ? 'Auditor Case Correction'
      : isHead
        ? 'Operations Head Authority'
        : 'Super Admin Emergency Override'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
      <div className="w-full max-w-xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-blue-600"><FiShield /> Protected Project Settings</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">{statusTitle}</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-slate-500">
              {isStaff ? 'The exact proposed settings must be approved by an Operations Head before they can be saved.' :
                isHead ? 'Your Operations Head role satisfies the department approval. The saved change will still go to Auditor review.' :
                  isSystemAdmin ? `Audit Case #${auditCaseId || '—'} must authorize this exact Project Settings correction.` :
                    'Emergency owner access requires your password and email code. System Admin and Auditor will be notified.'}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving || busy} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close authorization"><FiX /></button>
        </header>

        <div className="grid gap-4 p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-700">Reason for change *</span>
            <textarea value={reason} disabled={Boolean(verificationId) || authorized} onChange={(event) => setReason(event.target.value)} placeholder="Explain why these Project Settings are being changed." className="min-h-24 resize-none rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" />
          </label>

          {isSuperAdmin && !verificationId ? <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiLock /> Super Admin Password *</span>
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} placeholder="Enter Super Admin password" />
          </label> : null}

          {verificationId ? <label className="grid gap-2">
            <span className="flex items-center gap-2 text-sm font-black text-slate-700"><FiMail /> Email Verification Code *</span>
            <input inputMode="numeric" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} className={`${inputClass} tracking-[0.35em]`} placeholder="000000" />
            <span className="text-xs font-semibold text-slate-500">Code sent to {maskedEmail || 'your Super Admin email'}.</span>
          </label> : null}

          {isStaff && approvalRequestId && !authorized ? <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <p className="flex items-center gap-2 font-black"><FiClock /> {requestNumber || `Approval #${approvalRequestId}`} is pending</p>
            <p className="mt-1">After an Operations Head reviews it in Review Center, click <strong>Check Head Approval</strong>. If any setting changes, a new exact-payload approval is required.</p>
          </div> : null}

          {authorized ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900"><p className="flex items-center gap-2 font-black"><FiCheckCircle /> Authorization ready</p><p className="mt-1">Continue to Final Review. The exact proposed settings will be revalidated by the server when saved.</p></div> : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={isSaving || busy} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 disabled:opacity-50">Cancel</button>
          {!verificationId && !authorized ? <button type="button" onClick={requestAuthorization} disabled={busy || isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"><FiKey />{busy ? 'Checking...' : isStaff && approvalRequestId ? 'Check Head Approval' : isStaff ? 'Request Head Approval' : 'Authorize Change'}</button> : null}
          {(verificationId || authorized) ? <button type="button" onClick={confirm} disabled={isSaving || (verificationId && !/^\d{6}$/.test(code.trim()))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white disabled:opacity-50"><FiCheckCircle />{isSaving ? 'Saving...' : 'Continue to Final Review'}</button> : null}
        </footer>
      </div>
    </div>
  )
}

export default ProjectSettingsAuthorizationModal
