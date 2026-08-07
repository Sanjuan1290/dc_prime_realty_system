import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiAlertTriangle,
  FiArrowLeft,
  FiCheckCircle,
  FiChevronDown,
  FiChevronRight,
  FiDatabase,
  FiFileText,
  FiShield,
  FiX,
} from 'react-icons/fi'
import { setMutationReviewHandler } from '../../utils/mutationReview'

const ABBREVIATIONS = new Map([
  ['id', 'ID'], ['ids', 'IDs'], ['soa', 'SOA'], ['tcp', 'TCP'], ['lmf', 'LMF'], ['dp', 'DP'],
  ['sqm', 'SQM'], ['tin', 'TIN'], ['prc', 'PRC'], ['or', 'OR'], ['url', 'URL'], ['api', 'API'],
  ['sms', 'SMS'], ['pdf', 'PDF'], ['ip', 'IP'], ['ofw', 'OFW'],
])

const humanizeKey = (value) => String(value || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .trim()
  .split(/\s+/)
  .map((word) => ABBREVIATIONS.get(word.toLowerCase()) || `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ')

const isSensitiveKey = (key) => /password|secret|token|signature|authorization|cookie/i.test(String(key || ''))
const isTechnicalKey = (key) => /request.?key|cloudinary|asset.?id|public.?id|website$/i.test(String(key || ''))

const formatScalar = (value, key = '') => {
  if (isSensitiveKey(key)) return value ? '••••••••' : '—'
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'

  const keyText = String(key || '').toLowerCase()
  const numeric = typeof value === 'number' ? value : Number.NaN
  if (Number.isFinite(numeric) && /amount|fee|price|tcp|commission|balance|income|salary|cash|payment/.test(keyText)) {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2 }).format(numeric)
  }
  if (Number.isFinite(numeric) && /rate|percentage|percent/.test(keyText)) return `${numeric}%`
  if (typeof value === 'number' && Number.isFinite(value)) return new Intl.NumberFormat('en-PH', { maximumFractionDigits: 4 }).format(value)
  if (/date/.test(keyText) && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
    const [year, month, day] = String(value).split('-').map(Number)
    return new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(Date.UTC(year, month - 1, day)))
  }
  return String(value)
}

const flattenObject = (object = {}, prefix = '') => {
  const rows = []
  Object.entries(object || {}).forEach(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    if (Array.isArray(value) || (value && typeof value === 'object')) return
    rows.push({ key: path, label: humanizeKey(key), value: formatScalar(value, key), technical: isTechnicalKey(key) })
  })
  return rows
}

const ReviewRows = ({ object }) => {
  const rows = useMemo(() => flattenObject(object), [object])
  const normalRows = rows.filter((row) => !row.technical)
  const technicalRows = rows.filter((row) => row.technical)

  if (!rows.length) return null

  return (
    <>
      <dl className="grid gap-2 sm:grid-cols-2">
        {normalRows.map((row) => (
          <div key={row.key} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <dt className="text-[11px] font-black uppercase tracking-wide text-slate-500">{row.label}</dt>
            <dd className="mt-1 break-words text-sm font-bold text-slate-950">{row.value}</dd>
          </div>
        ))}
      </dl>
      {technicalRows.length ? (
        <details className="mt-3 rounded-xl border border-slate-200 bg-slate-50">
          <summary className="cursor-pointer px-4 py-3 text-xs font-black text-slate-600">System references ({technicalRows.length})</summary>
          <dl className="grid gap-2 border-t border-slate-200 p-3 sm:grid-cols-2">
            {technicalRows.map((row) => (
              <div key={row.key} className="rounded-lg bg-white px-3 py-2">
                <dt className="text-[10px] font-black uppercase text-slate-400">{row.label}</dt>
                <dd className="mt-1 break-all text-xs font-semibold text-slate-700">{row.value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
    </>
  )
}

const ArrayReview = ({ label, value }) => (
  <section className="rounded-2xl border border-slate-200 bg-white">
    <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div>
        <h3 className="text-sm font-black text-slate-950">{humanizeKey(label)}</h3>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">{value.length} item{value.length === 1 ? '' : 's'}</p>
      </div>
      <FiFileText className="h-4 w-4 text-blue-600" />
    </header>
    <div className="space-y-2 p-3">
      {value.map((item, index) => (
        <div key={`${label}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-400">Item {index + 1}</p>
          {item && typeof item === 'object' ? <ReviewRows object={item} /> : <p className="text-sm font-bold text-slate-800">{formatScalar(item, label)}</p>}
        </div>
      ))}
    </div>
  </section>
)

const ObjectReview = ({ label, value }) => {
  const nestedEntries = Object.entries(value || {}).filter(([, child]) => Array.isArray(child) || (child && typeof child === 'object'))
  return (
    <section className="rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-black text-slate-950">{humanizeKey(label)}</h3>
      </header>
      <div className="space-y-3 p-3">
        <ReviewRows object={value} />
        {nestedEntries.map(([childKey, childValue]) => (
          Array.isArray(childValue)
            ? <ArrayReview key={childKey} label={childKey} value={childValue} />
            : <ObjectReview key={childKey} label={childKey} value={childValue} />
        ))}
      </div>
    </section>
  )
}

const PayloadReview = ({ payload }) => {
  if (payload === null || payload === undefined || payload === '') {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">This action has no editable request body. Verify the target record and action details above.</div>
  }
  if (Array.isArray(payload)) return <ArrayReview label="Items" value={payload} />
  if (typeof payload !== 'object') return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-900">{formatScalar(payload)}</div>

  const nestedEntries = Object.entries(payload).filter(([, value]) => Array.isArray(value) || (value && typeof value === 'object'))
  return (
    <div className="space-y-3">
      <ReviewRows object={payload} />
      {nestedEntries.map(([key, value]) => (
        Array.isArray(value)
          ? <ArrayReview key={key} label={key} value={value} />
          : <ObjectReview key={key} label={key} value={value} />
      ))}
    </div>
  )
}

const getControlForLabel = (label) => {
  const wrapped = label.querySelector('input, select, textarea')
  if (wrapped) return wrapped
  const htmlFor = label.getAttribute('for')
  if (htmlFor) return document.getElementById(htmlFor)
  return null
}

const cleanLabelText = (label) => {
  const clone = label.cloneNode(true)
  clone.querySelectorAll('input,select,textarea,button,.dc-input-example').forEach((node) => node.remove())
  return String(clone.textContent || '').replace(/\*/g, '').replace(/\s+/g, ' ').trim()
}

const exampleFromPlaceholder = (placeholder) => {
  const clean = String(placeholder || '').trim()
    .replace(/^example\s*:?\s*/i, '')
    .replace(/^ex\.?\s*:?\s*/i, '')
    .replace(/^enter\s+/i, '')
    .replace(/^select\s+/i, '')
    .replace(/^choose\s+/i, '')
  return clean && clean.length <= 70 ? clean : ''
}

const inferExample = (labelText, control) => {
  const label = String(labelText || '').toLowerCase()
  const type = String(control?.getAttribute('type') || control?.tagName || '').toLowerCase()
  const placeholder = exampleFromPlaceholder(control?.getAttribute('placeholder'))

  if (type === 'checkbox' || type === 'radio') return 'check if applicable'
  if (/password|pin/.test(label) || type === 'password') return '8+ characters'
  if (/email/.test(label) || type === 'email') return 'juan@email.com'
  if (/contact|mobile|phone|telephone/.test(label) || type === 'tel') return '0917 123 4567'
  if (/first name/.test(label)) return 'Juan'
  if (/middle name/.test(label)) return 'Santos'
  if (/last name|surname/.test(label)) return 'Dela Cruz'
  if (/full name|buyer name|client name|seller name|employee name|witness name|representative name/.test(label)) return 'Juan Dela Cruz'
  if (/address/.test(label)) return '123 Aguinaldo Hwy, Cavite'
  if (/tin/.test(label)) return '123-456-789-000'
  if (/prc/.test(label)) return '0123456'
  if (/bank/.test(label) && !/account/.test(label)) return 'BDO'
  if (/account.*(no|number)|wallet/.test(label)) return '001234567890'
  if (/reference|transaction|\bor no\b|receipt no/.test(label)) return 'OR-20260807-0001'
  if (/unit.*(id|no|number)|unit code/.test(label)) return '0208'
  if (/cadastral|lot.*(no|number)/.test(label)) return '1306'
  if (/sqm|area/.test(label)) return '300'
  if (/month|term/.test(label) && !/payment term/.test(label)) return '36 months'
  if (/date|birthday|birth date|due date/.test(label) || type === 'date') return 'Aug 7, 2026'
  if (/time/.test(label) || type === 'time') return '9:00 AM'
  if (/rate|percentage|percent|\(%\)|\b%\b/.test(label)) return '0.05%'
  if (/amount|fee|price|tcp|commission|salary|payment|cash|balance|income|advance/.test(label)) return '₱50,000'
  if (/status/.test(label)) return 'Active'
  if (/role/.test(label)) return 'Sales Agent'
  if (/type/.test(label)) return 'Installment'
  if (/method/.test(label)) return 'Bank Transfer'
  if (/description|notes|remarks|reason|purpose/.test(label)) return 'Short clear description'
  if (type === 'file') return 'PDF, JPG, or PNG'
  if (placeholder) return placeholder

  if (control?.tagName === 'SELECT') {
    const option = Array.from(control.options || []).find((item) => item.value && !/select|choose/i.test(item.textContent || ''))
    if (option?.textContent?.trim()) return option.textContent.trim()
  }

  if (type === 'number') return '100'
  return 'sample value'
}

const findLabelAnchor = (label, control) => {
  const directLabelNodes = Array.from(label.children || []).filter((child) =>
    ['SPAN', 'P'].includes(child.tagName) &&
    !child.classList.contains('dc-input-example') &&
    !child.querySelector('input,select,textarea')
  )
  if (directLabelNodes.length) return directLabelNodes[0]

  const allSpans = Array.from(label.querySelectorAll('span')).filter((span) => !span.closest('button') && !span.classList.contains('dc-input-example'))
  if (allSpans.length) return allSpans[0]

  if (control && control.parentNode === label) return null
  return label
}

const decorateInputs = () => {
  if (typeof document === 'undefined') return
  const pathname = window.location.pathname
  const isAuthRoute = ['/portal/login', '/portal/change-password'].includes(pathname)
  const shouldUseProceed = !isAuthRoute

  document.querySelectorAll('label').forEach((label) => {
    if (label.querySelector('.dc-input-example')) return
    const control = getControlForLabel(label)
    if (!control || control.type === 'hidden') return
    const labelText = cleanLabelText(label)
    if (!labelText || /search|filter|rows per page|page size/i.test(labelText)) return

    const example = inferExample(labelText, control)
    if (!example) return
    const span = document.createElement('span')
    span.className = 'dc-input-example ml-2 text-[11px] font-medium italic text-slate-400'
    span.textContent = `ex. ${example}`
    span.setAttribute('aria-hidden', 'true')

    const anchor = findLabelAnchor(label, control)
    if (anchor && anchor !== label) {
      anchor.appendChild(span)
    } else if (control && control.parentNode === label) {
      label.insertBefore(span, control)
    } else {
      label.appendChild(span)
    }
  })

  document.querySelectorAll('input, select, textarea').forEach((control) => {
    if (control.type === 'hidden') return
    const placeholderText = String(control.getAttribute('placeholder') || '').toLowerCase()
    if (/search|filter/.test(placeholderText)) return
    const wrappedLabel = control.closest('label')
    const explicitLabel = control.id ? document.querySelector(`label[for="${CSS.escape(control.id)}"]`) : null
    if (wrappedLabel?.querySelector('.dc-input-example') || explicitLabel?.querySelector('.dc-input-example')) return

    let candidate = null
    let node = control.parentElement
    for (let depth = 0; node && depth < 3 && !candidate; depth += 1, node = node.parentElement) {
      const siblings = Array.from(node.children || [])
      const controlIndex = siblings.findIndex((child) => child === control || child.contains?.(control))
      const prior = controlIndex > 0 ? siblings.slice(0, controlIndex).reverse() : []
      candidate = prior.find((child) => {
        if (!['SPAN', 'P', 'DIV'].includes(child.tagName)) return false
        if (child.querySelector('input,select,textarea,button')) return false
        const text = String(child.textContent || '').replace(/\*/g, '').trim()
        return text && text.length <= 80 && !/search|filter|page|showing/i.test(text)
      }) || null
    }

    if (!candidate || candidate.querySelector('.dc-input-example')) return
    const labelText = String(candidate.textContent || '').replace(/\*/g, '').trim()
    if (!labelText) return
    const example = inferExample(labelText, control)
    if (!example) return
    const span = document.createElement('span')
    span.className = 'dc-input-example ml-2 text-[11px] font-medium italic text-slate-400'
    span.textContent = `ex. ${example}`
    span.setAttribute('aria-hidden', 'true')
    candidate.appendChild(span)
  })

  document.querySelectorAll('form button[type="submit"], form input[type="submit"]').forEach((button) => {
    if (!shouldUseProceed) return
    if (button.dataset.dcKeepActionLabel === 'true') return
    const originalLabel = String(button.dataset.dcOriginalLabel || button.textContent || button.value || 'Submit').trim()
    if (/print|prepare email|review tripping request/i.test(originalLabel)) return
    if (!button.dataset.dcOriginalLabel) button.dataset.dcOriginalLabel = originalLabel
    button.classList.add('dc-proceed-submit')
    if (button.tagName === 'INPUT' && !button.disabled) button.value = 'Proceed'
  })
}

const MutationReviewProvider = ({ children }) => {
  const [request, setRequest] = useState(null)
  const resolverRef = useRef(null)
  const [showEndpoint, setShowEndpoint] = useState(false)

  useEffect(() => setMutationReviewHandler((nextRequest) => new Promise((resolve) => {
    resolverRef.current = resolve
    setShowEndpoint(false)
    setRequest(nextRequest)
  })), [])

  useEffect(() => {
    let frame = 0
    const schedule = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(decorateInputs)
    }
    schedule()
    const observer = new MutationObserver(schedule)
    observer.observe(document.documentElement, { childList: true, subtree: true })
    window.addEventListener('popstate', schedule)
    return () => {
      observer.disconnect()
      window.cancelAnimationFrame(frame)
      window.removeEventListener('popstate', schedule)
    }
  }, [])

  const finish = (confirmed) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    resolve?.(confirmed)
  }

  return (
    <>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="mutation-review-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiShield className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Final double-check</p>
                  <h2 id="mutation-review-title" className="mt-1 text-xl font-black text-slate-950">{request.title}</h2>
                  <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-600">{request.description}</p>
                </div>
              </div>
              <button type="button" onClick={() => finish(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Back to edit"><FiX className="h-5 w-5" /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900">
                <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                <div>
                  <p className="text-sm font-black">Nothing has been saved yet.</p>
                  <p className="mt-1 text-xs font-semibold leading-5">Review every value below. Choose Back to Edit if anything is wrong. The database request will run only after you confirm.</p>
                </div>
              </div>

              {request.summary ? <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-900">{request.summary}</div> : null}
              <PayloadReview payload={request.payload} />

              <button type="button" onClick={() => setShowEndpoint((current) => !current)} className="mt-4 inline-flex items-center gap-2 text-xs font-black text-slate-500 hover:text-slate-800">
                {showEndpoint ? <FiChevronDown /> : <FiChevronRight />}
                System action details
              </button>
              {showEndpoint ? (
                <div className="mt-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600">
                  <p><span className="font-black text-slate-800">Method:</span> {request.method}</p>
                  <p className="mt-1 break-all"><span className="font-black text-slate-800">Endpoint:</span> {request.path}</p>
                </div>
              ) : null}
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500"><FiDatabase /> Final confirmation writes to the database.</div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => finish(false)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft /> Back to Edit</button>
                <button type="button" onClick={() => finish(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.99]"><FiCheckCircle /> {request.confirmLabel}</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default MutationReviewProvider
