import { useEffect, useRef, useState } from 'react'
import { FiArrowUpRight, FiGrid, FiX } from 'react-icons/fi'
import './actionPanelMotion.css'

// Shared presentation component. Permissions remain enforced by callers and APIs.
const ActionPanelModal = ({ title, subtitle, ariaLabel, onClose, children }) => {
  const [closing, setClosing] = useState(false)
  const closingRef = useRef(false)
  const closeTimer = useRef(null)
  const dialogRef = useRef(null)
  const closeButton = useRef(null)
  const closeCallback = useRef(onClose)
  closeCallback.current = onClose

  const requestClose = () => {
    if (closingRef.current) return
    closingRef.current = true
    setClosing(true)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      closeCallback.current?.()
      return
    }
    closeTimer.current = window.setTimeout(() => closeCallback.current?.(), 170)
  }

  useEffect(() => {
    const previousFocus = document.activeElement
    closeButton.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeButton.current?.click()
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll('button:not([disabled]), a[href], input:not([disabled])')]
      if (!focusable.length) return
      if (event.shiftKey && document.activeElement === focusable[0]) {
        event.preventDefault()
        focusable[focusable.length - 1].focus()
      } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
        event.preventDefault()
        focusable[0].focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      window.clearTimeout(closeTimer.current)
      previousFocus?.focus?.()
    }
  }, [])

  return (
    <div role="presentation" className={`dc-action-overlay fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/65 px-3 py-5 backdrop-blur-[3px] sm:p-6 ${closing ? 'dc-action-overlay--out' : 'dc-action-overlay--in'}`} onMouseDown={(event) => { if (event.target === event.currentTarget) requestClose() }}>
      <section ref={dialogRef} role="dialog" aria-modal="true" aria-label={ariaLabel || title} className={`dc-action-panel my-auto w-full max-w-[540px] overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_-25px_rgba(15,23,42,0.55)] ${closing ? 'dc-action-panel--out' : 'dc-action-panel--in'}`}>
        <header className="flex items-start gap-3 border-b border-slate-100 bg-gradient-to-br from-slate-50 via-white to-blue-50/50 px-5 py-5 sm:px-6 sm:py-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-600"><FiGrid size={20} /></div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-extrabold uppercase tracking-[0.14em] text-blue-600">Quick Actions</p>
            <h2 className="text-lg font-extrabold leading-tight text-slate-900 sm:text-xl">{title}</h2>
            {subtitle ? <p className="mt-1 truncate text-xs font-medium text-slate-500 sm:text-sm" title={subtitle}>{subtitle}</p> : null}
          </div>
          <button ref={closeButton} type="button" aria-label={`Close ${title.toLowerCase()}`} onClick={requestClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-slate-300 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"><FiX size={17} /></button>
        </header>
        <div className="px-5 py-5 sm:px-6">
          <p className="mb-3 text-xs font-semibold text-slate-500">Choose an action.</p>
          <div className="grid gap-2.5 sm:grid-cols-2">{children}</div>
        </div>
        <footer className="flex items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/70 px-5 py-3.5 sm:px-6">
          <span className="text-xs text-slate-400">Press Esc to close</span>
          <button type="button" onClick={requestClose} className="h-9 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">Close</button>
        </footer>
      </section>
    </div>
  )
}

export const ActionPanelButton = ({ icon: Icon, title, description, onClick, tone = 'blue', disabled = false }) => {
  const tones = {
    blue: 'border-blue-100 bg-blue-50 text-blue-600',
    green: 'border-emerald-100 bg-emerald-50 text-emerald-700',
    violet: 'border-violet-100 bg-violet-50 text-violet-700',
    amber: 'border-amber-100 bg-amber-50 text-amber-700',
    slate: 'border-slate-200 bg-slate-100 text-slate-600',
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="dc-action-choice group flex min-h-[82px] w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition-[transform,border-color,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/40 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transform-none motion-reduce:transition-none sm:p-3.5">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border ${tones[tone] || tones.blue}`}>{Icon ? <Icon aria-hidden="true" size={20} /> : <FiGrid aria-hidden="true" size={20} />}</span>
      <span className="min-w-0 flex-1"><span className="block text-sm font-bold leading-snug text-slate-900">{title}</span>{description ? <span className="mt-0.5 block text-xs leading-snug text-slate-500">{description}</span> : null}</span>
      <FiArrowUpRight aria-hidden="true" className="dc-action-choice__arrow shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-blue-600 motion-reduce:transform-none motion-reduce:transition-none" size={16} />
    </button>
  )
}
export default ActionPanelModal
