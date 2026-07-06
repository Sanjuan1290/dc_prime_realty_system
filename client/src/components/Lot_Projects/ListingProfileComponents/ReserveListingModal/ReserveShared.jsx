import { FiCheckCircle } from 'react-icons/fi'

export const TextInput = ({
  label,
  value,
  onChange,
  type = 'text',
  placeholder = '',
  helper,
  required = false,
  disabled = false,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className={`h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
          : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
      }`}
    />

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

export const SelectInput = ({
  label,
  value,
  onChange,
  children,
  helper,
  required = false,
  disabled = false,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <select
      value={value || ''}
      onChange={(event) => onChange?.(event.target.value)}
      disabled={disabled}
      className={`h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
          : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
      }`}
    >
      {children}
    </select>

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

export const SectionCard = ({ title, description, children, right }) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h3 className="text-base font-black text-slate-950">{title}</h3>
        {description ? (
          <p className="mt-1 text-sm font-semibold text-slate-500">{description}</p>
        ) : null}
      </div>

      {right}
    </div>

    {children}
  </section>
)

export const StepPill = ({ step, activeStep, completed }) => {
  const isActive = step.id === activeStep

  return (
    <div
      className={`flex min-w-[220px] items-center gap-3 rounded-xl border p-3 transition ${
        isActive
          ? 'border-blue-300 bg-blue-50 ring-2 ring-blue-100'
          : completed
            ? 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-white'
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          isActive
            ? 'bg-blue-600 text-white'
            : completed
              ? 'bg-emerald-600 text-white'
              : 'bg-slate-100 text-slate-600'
        }`}
      >
        {completed ? <FiCheckCircle className="h-4 w-4" /> : step.id}
      </span>

      <div>
        <p className="text-sm font-black text-slate-950">{step.title}</p>
        <p className="text-xs font-semibold text-slate-500">{step.description}</p>
      </div>
    </div>
  )
}
