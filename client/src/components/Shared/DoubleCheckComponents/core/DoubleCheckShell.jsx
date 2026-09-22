import { useEffect, useMemo, useState } from 'react'
import { FiArrowLeft, FiArrowRight, FiCheckCircle, FiShield, FiX } from 'react-icons/fi'

const DoubleCheckShell = ({
  title,
  description,
  confirmLabel = 'Confirm & Continue',
  steps = [],
  summary = '',
  onConfirm,
  onCancel,
}) => {
  const visibleSteps = useMemo(() => steps.filter((step) => step && step.hidden !== true), [steps])
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => setStepIndex(0), [title, visibleSteps.length])

  const safeIndex = Math.min(stepIndex, Math.max(visibleSteps.length - 1, 0))
  const current = visibleSteps[safeIndex]
  const first = safeIndex === 0
  const last = safeIndex === visibleSteps.length - 1

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5">
      <div role="dialog" aria-modal="true" aria-labelledby="double-check-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
        <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiShield className="h-5 w-5" /></span>
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Final Double-Check · Step {safeIndex + 1} of {Math.max(visibleSteps.length, 1)}</p>
                <h2 id="double-check-title" className="mt-1 text-xl font-black text-slate-950">{title}</h2>
                {description ? <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-600">{description}</p> : null}
              </div>
            </div>
            <button type="button" onClick={onCancel} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Back to edit"><FiX className="h-5 w-5" /></button>
          </div>

          {visibleSteps.length > 1 ? (
            <div className="mt-4 overflow-x-auto pb-1">
              <div className="flex min-w-max items-center gap-2">
                {visibleSteps.map((step, index) => {
                  const active = index === safeIndex
                  const complete = index < safeIndex
                  return (
                    <div key={step.key || step.title} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${active ? 'border-blue-200 bg-blue-50' : complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                      <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ring-4 ${active ? 'bg-slate-700 text-white ring-slate-200' : complete ? 'bg-emerald-600 text-white ring-emerald-100' : 'bg-white text-slate-400 ring-slate-100'}`}>
                        {complete ? <FiCheckCircle className="h-3.5 w-3.5" /> : index + 1}
                      </span>
                      <span className={`text-xs font-black ${active ? 'text-slate-950' : complete ? 'text-emerald-800' : 'text-slate-400'}`}>{step.title}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black">Review the information shown in this step.</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">Only information relevant to this action is shown. Nothing is saved until the final step is confirmed.</p>
            </div>
            {summary ? <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-800 ring-1 ring-blue-200">{summary}</span> : null}
          </div>
          {current?.content || current?.render?.() || null}
        </div>

        <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center justify-between gap-3 sm:justify-start">
            <button type="button" onClick={onCancel} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft /> Back to Edit</button>
            <span className="text-xs font-semibold text-slate-500">Step {safeIndex + 1} of {Math.max(visibleSteps.length, 1)}</span>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            {!first ? <button type="button" onClick={() => setStepIndex((currentIndex) => Math.max(currentIndex - 1, 0))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft /> Previous</button> : null}
            {!last ? (
              <button type="button" onClick={() => setStepIndex((currentIndex) => Math.min(currentIndex + 1, visibleSteps.length - 1))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.99]">Next: {visibleSteps[safeIndex + 1]?.title || 'Review'} <FiArrowRight /></button>
            ) : (
              <button type="button" onClick={onConfirm} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"><FiCheckCircle /> {confirmLabel}</button>
            )}
          </div>
        </footer>
      </div>
    </div>
  )
}

export default DoubleCheckShell
