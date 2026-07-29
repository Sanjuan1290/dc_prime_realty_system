import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiKey, FiLock, FiMail, FiRefreshCw, FiShield, FiX } from 'react-icons/fi'
import StatusAlert from '../components/Shared/StatusAlert'

const apiRequest = async (path, payload) => {
  const response = await fetch(`${import.meta.env.VITE_API_URL}/user${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || 'Request failed.')
  return data
}

const StepIcon = ({ step }) => {
  const Icon = step === 'email' ? FiMail : step === 'code' ? FiShield : FiLock
  return <Icon className="h-5 w-5" />
}

const ForgotPasswordModal = ({ initialEmail = '', onClose, onComplete }) => {
  const [step, setStep] = useState('email')
  const [email, setEmail] = useState(initialEmail)
  const [code, setCode] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [notice, setNotice] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return undefined
    const timer = window.setInterval(() => {
      setCooldown((current) => Math.max(current - 1, 0))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [cooldown])

  const stepTitle = useMemo(() => {
    if (step === 'code') return 'Enter verification code'
    if (step === 'reset') return 'Set a new password'
    return 'Forgot password'
  }, [step])

  const requestCode = async ({ resend = false } = {}) => {
    if (!email.trim()) {
      setNotice({ type: 'warning', message: 'Enter your registered email address.' })
      return
    }

    setIsSaving(true)
    setNotice({ type: 'loading', message: resend ? 'Sending a new code...' : 'Sending verification code...' })
    try {
      const result = await apiRequest('/forgot-password/request', { email })
      setStep('code')
      setCode('')
      setCooldown(Number(result.resendAfterSeconds || 60))
      setNotice({ type: 'success', message: result.message })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const verifyCode = async () => {
    if (!/^\d{6}$/.test(code)) {
      setNotice({ type: 'warning', message: 'Enter the 6-digit verification code.' })
      return
    }

    setIsSaving(true)
    setNotice({ type: 'loading', message: 'Verifying your code...' })
    try {
      const result = await apiRequest('/forgot-password/verify', { email, code })
      setResetToken(result.resetToken)
      setStep('reset')
      setNotice({ type: 'success', message: result.message })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const resetPassword = async () => {
    if (!newPassword || !confirmPassword) {
      setNotice({ type: 'warning', message: 'Enter and confirm your new password.' })
      return
    }

    setIsSaving(true)
    setNotice({ type: 'loading', message: 'Updating your password...' })
    try {
      const result = await apiRequest('/forgot-password/reset', {
        resetToken,
        newPassword,
        confirmPassword,
      })
      onComplete?.({ email, message: result.message })
    } catch (error) {
      setNotice({ type: 'error', message: error.message })
    } finally {
      setIsSaving(false)
    }
  }

  const goBack = () => {
    if (step === 'reset') {
      setStep('code')
      setResetToken('')
    } else {
      setStep('email')
      setCode('')
    }
    setNotice(null)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/65 p-4" role="dialog" aria-modal="true" aria-labelledby="forgot-password-title">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
          <div className="flex min-w-0 items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <StepIcon step={step} />
            </span>
            <div>
              <h2 id="forgot-password-title" className="text-xl font-black text-slate-950">{stepTitle}</h2>
              <p className="mt-1 text-sm font-semibold leading-5 text-slate-500">
                {step === 'email' ? 'A 6-digit code will be sent to your registered Gmail or email address.' : null}
                {step === 'code' ? `Enter the code sent for ${email}.` : null}
                {step === 'reset' ? 'Use at least 8 characters for your new password.' : null}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50" aria-label="Close forgot password">
            <FiX className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 px-5 py-6 sm:px-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}

          {step === 'email' ? (
            <label className="block">
              <span className="mb-2 block text-sm font-black text-slate-700">Registered email</span>
              <div className="relative">
                <FiMail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" placeholder="name@gmail.com" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
              </div>
            </label>
          ) : null}

          {step === 'code' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">6-digit code</span>
                <div className="relative">
                  <FiKey className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" className="h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 pr-4 text-center text-lg font-black tracking-[0.35em] text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
                </div>
              </label>
              <button type="button" onClick={() => requestCode({ resend: true })} disabled={isSaving || cooldown > 0} className="inline-flex items-center gap-2 text-sm font-black text-blue-700 disabled:cursor-not-allowed disabled:text-slate-400">
                <FiRefreshCw className={isSaving ? 'animate-spin' : ''} />
                {cooldown > 0 ? `Send again in ${cooldown}s` : 'Send a new code'}
              </button>
            </div>
          ) : null}

          {step === 'reset' ? (
            <div className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">New password</span>
                <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={8} placeholder="At least 8 characters" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-black text-slate-700">Confirm new password</span>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} autoComplete="new-password" minLength={8} placeholder="Repeat your new password" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100" />
              </label>
            </div>
          ) : null}
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-between sm:px-6">
          {step !== 'email' ? (
            <button type="button" onClick={goBack} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-100 disabled:opacity-50">
              <FiArrowLeft /> Back
            </button>
          ) : <span />}
          <button type="button" onClick={step === 'email' ? () => requestCode() : step === 'code' ? verifyCode : resetPassword} disabled={isSaving} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSaving ? 'Please wait...' : step === 'email' ? 'Send verification code' : step === 'code' ? 'Verify code' : 'Reset password'}
          </button>
        </footer>
      </div>
    </div>
  )
}

export default ForgotPasswordModal
