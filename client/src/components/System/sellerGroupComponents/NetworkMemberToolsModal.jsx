import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { FiDownload, FiFileText, FiRotateCcw, FiUpload, FiX } from 'react-icons/fi'

const NetworkMemberToolsModal = ({
  networkName,
  canImportMembers,
  canExportMembers,
  isExportingMembers,
  onClose,
  onImport,
  onUndo,
  onExport,
}) => {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const previouslyFocused = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeRef.current?.focus()
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
      if (event.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')
        if (!focusable?.length) return
        if (event.shiftKey && document.activeElement === focusable[0]) {
          event.preventDefault()
          focusable[focusable.length - 1].focus()
        } else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) {
          event.preventDefault()
          focusable[0].focus()
        }
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
    }
  }, [onClose])

  const actionClass = 'flex w-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50'

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-950/55 p-4"
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="network-member-tools-title"
        className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="network-member-tools-title" className="flex items-center gap-2 text-lg font-bold text-slate-950"><FiFileText className="text-emerald-600" /> Member Tools</h2>
            <p className="mt-1 text-sm text-slate-500">{networkName} · Import, export, or undo an import</p>
          </div>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close member tools" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"><FiX /></button>
        </header>
        <div className="grid gap-3 p-5">
          {canImportMembers ? (
            <button type="button" onClick={onImport} className={actionClass}>
              <FiUpload className="mt-0.5 shrink-0 text-emerald-600" />
              <span><span className="block font-semibold text-slate-900">Import Members</span><span className="mt-1 block text-sm text-slate-500">Upload and review an Excel workbook before committing members.</span></span>
            </button>
          ) : null}
          {canExportMembers ? (
            <button type="button" onClick={onExport} disabled={isExportingMembers} className={actionClass}>
              <FiDownload className="mt-0.5 shrink-0 text-blue-600" />
              <span><span className="block font-semibold text-slate-900">Export Members</span><span className="mt-1 block text-sm text-slate-500">Download the Network's current members as an Excel workbook.</span></span>
            </button>
          ) : null}
          {canImportMembers ? (
            <button type="button" onClick={onUndo} className={actionClass}>
              <FiRotateCcw className="mt-0.5 shrink-0 text-amber-700" />
              <span><span className="block font-semibold text-slate-900">Undo Import</span><span className="mt-1 block text-sm text-slate-500">Review saved import batches and their undo eligibility. Confirmation is required.</span></span>
            </button>
          ) : null}
          <p className="pt-1 text-xs text-slate-500">All actions retain their existing access restrictions and verification steps.</p>
        </div>
      </section>
    </div>,
    document.body
  )
}

export default NetworkMemberToolsModal
