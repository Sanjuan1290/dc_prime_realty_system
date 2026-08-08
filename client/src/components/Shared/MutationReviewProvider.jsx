import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiArrowLeft,
  FiArrowRight,
  FiCheckCircle,
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

const SECTION_META = {
  listing: {
    title: 'Listing & Pricing',
    helper: 'Verify the project, unit, property details, pricing choice, and reservation amount.',
    header: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'border-l-blue-500',
    step: 'bg-blue-600 text-white ring-blue-100',
  },
  buyerprofile: {
    title: 'Buyer Information',
    helper: 'Verify every buyer field, including fields intentionally left blank.',
    header: 'border-indigo-200 bg-indigo-50',
    badge: 'bg-indigo-100 text-indigo-700',
    accent: 'border-l-indigo-500',
    step: 'bg-indigo-600 text-white ring-indigo-100',
  },
  documentrequirements: {
    title: 'Document Checklist',
    helper: 'Verify every selected document and whether it is Required or Optional.',
    header: 'border-emerald-200 bg-emerald-50',
    badge: 'bg-emerald-100 text-emerald-700',
    accent: 'border-l-emerald-500',
    step: 'bg-emerald-600 text-white ring-emerald-100',
  },
  paymentterms: {
    title: 'Payment Terms & Financials',
    helper: 'Verify every amount, discount, date, rate, penalty, and installment term.',
    header: 'border-amber-200 bg-amber-50',
    badge: 'bg-amber-100 text-amber-800',
    accent: 'border-l-amber-500',
    step: 'bg-amber-500 text-white ring-amber-100',
  },
  sellerassignment: {
    title: 'Seller Assignment',
    helper: 'Verify the seller, group, role, commission preview details, and assignment information.',
    header: 'border-violet-200 bg-violet-50',
    badge: 'bg-violet-100 text-violet-700',
    accent: 'border-l-violet-500',
    step: 'bg-violet-600 text-white ring-violet-100',
  },
  details: {
    title: 'Information Review',
    helper: 'Verify every user-facing field before continuing.',
    header: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'border-l-blue-500',
    step: 'bg-blue-600 text-white ring-blue-100',
  },
  items: {
    title: 'Items Review',
    helper: 'Verify every item and field before continuing.',
    header: 'border-blue-200 bg-blue-50',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'border-l-blue-500',
    step: 'bg-blue-600 text-white ring-blue-100',
  },
}

const humanizeKey = (value) => String(value || '')
  .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
  .replace(/[_-]+/g, ' ')
  .trim()
  .split(/\s+/)
  .map((word) => ABBREVIATIONS.get(word.toLowerCase()) || `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
  .join(' ')

const normalizeSectionKey = (value) => String(value || '').replace(/[^a-z0-9]/gi, '').toLowerCase()
const getSectionMeta = (label) => SECTION_META[normalizeSectionKey(label)] || {
  title: humanizeKey(label),
  helper: 'Verify every user-facing field in this section.',
  header: 'border-slate-200 bg-slate-50',
  badge: 'bg-slate-100 text-slate-700',
  accent: 'border-l-slate-400',
  step: 'bg-slate-700 text-white ring-slate-200',
}

const isSensitiveKey = (key) => /password|secret|token|signature|authorization|cookie/i.test(String(key || ''))
const isTechnicalKey = (key) => {
  const value = String(key || '')
  return /request.?key|cloudinary|asset.?id|public.?id|website$|buyer.?form.?submission.?id/i.test(value)
    || /(^|[._-])(id|ids)$/i.test(value)
    || /(?:_id|Id)$/.test(value)
}
const isCriticalKey = (key) => /amount|fee|price|tcp|lmf|downpayment|discount|balance|income|salary|cash|payment|commission|rate|percentage|percent|interest|penalty|date|due|term/i.test(String(key || ''))

const isEmptyScalar = (value) => {
  if (value === null || value === undefined) return true
  if (typeof value !== 'string') return false
  const text = value.trim()
  return text === '' || text === '-' || text === '—'
}

const formatScalar = (value, key = '') => {
  if (isSensitiveKey(key)) return value ? '••••••••' : 'Not provided'
  if (isEmptyScalar(value)) return 'Not provided'
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
    if (isTechnicalKey(key) || Array.isArray(value) || (value && typeof value === 'object')) return
    rows.push({
      key: path,
      sourceKey: key,
      label: humanizeKey(key),
      value: formatScalar(value, key),
      empty: isEmptyScalar(value),
      critical: isCriticalKey(key),
    })
  })
  return rows
}

const countReviewValues = (value, key = '') => {
  if (isTechnicalKey(key)) return { provided: 0, blank: 0, total: 0 }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => {
      const next = countReviewValues(item)
      return { provided: total.provided + next.provided, blank: total.blank + next.blank, total: total.total + next.total }
    }, { provided: 0, blank: 0, total: 0 })
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((total, [childKey, childValue]) => {
      const next = countReviewValues(childValue, childKey)
      return { provided: total.provided + next.provided, blank: total.blank + next.blank, total: total.total + next.total }
    }, { provided: 0, blank: 0, total: 0 })
  }
  return isEmptyScalar(value)
    ? { provided: 0, blank: 1, total: 1 }
    : { provided: 1, blank: 0, total: 1 }
}

const getRowGroup = (sectionLabel, row) => {
  const section = normalizeSectionKey(sectionLabel)
  const key = String(row.sourceKey || row.key || '').replace(/[^a-z0-9]/gi, '').toLowerCase()

  if (section === 'buyerprofile') {
    if (/secondbuyer/.test(key)) return 'Second Buyer'
    if (/employer|occupation|natureofwork|monthlyincome|employment|business/.test(key)) return 'Employment & Income'
    if (/contact|phone|email|address|zipcode|postal|residence/.test(key)) return 'Contact & Address'
    return 'Primary Buyer'
  }

  if (section === 'paymentterms') {
    if (/rate|interest|penalty|percentage|percent|grace/.test(key)) return 'Rates & Penalties'
    if (/date|due|term|month|schedule/.test(key)) return 'Schedule & Dates'
    if (/amount|fee|price|discount|downpayment|tcp|lmf|balance|cash/.test(key)) return 'Amounts & Pricing'
    return 'Other Terms'
  }

  return ''
}

const GROUP_ORDER = {
  buyerprofile: ['Primary Buyer', 'Contact & Address', 'Employment & Income', 'Second Buyer'],
  paymentterms: ['Amounts & Pricing', 'Schedule & Dates', 'Rates & Penalties', 'Other Terms'],
}

const groupRows = (rows, sectionLabel) => {
  const grouped = new Map()
  rows.forEach((row) => {
    const group = getRowGroup(sectionLabel, row)
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group).push(row)
  })
  const groups = Array.from(grouped.entries()).map(([title, items]) => ({ title, rows: items }))
  const order = GROUP_ORDER[normalizeSectionKey(sectionLabel)] || []
  return groups.sort((a, b) => {
    const ai = order.indexOf(a.title)
    const bi = order.indexOf(b.title)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
}

const ReviewRows = ({ object, sectionLabel = '' }) => {
  const rows = useMemo(() => flattenObject(object), [object])
  const groups = groupRows(rows, sectionLabel)

  if (!rows.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-500">No user-facing fields are available in this section.</div>
  }

  return (
    <div className="space-y-5">
      {groups.map((group, groupIndex) => (
        <section key={`${sectionLabel || 'details'}-${group.title || groupIndex}`}>
          {group.title ? (
            <div className="mb-2 flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
              <h4 className="text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">{group.title}</h4>
            </div>
          ) : null}
          <dl className="grid gap-2 md:grid-cols-2">
            {group.rows.map((row) => (
              <div
                key={row.key}
                className={row.empty
                  ? 'rounded-xl border border-slate-200 bg-slate-50 px-4 py-3'
                  : row.critical
                    ? 'rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3'
                    : 'rounded-xl border border-slate-200 bg-white px-4 py-3'}
              >
                <dt className={row.empty
                  ? 'text-[10px] font-black uppercase tracking-[0.08em] text-slate-400'
                  : row.critical
                    ? 'text-[10px] font-black uppercase tracking-[0.08em] text-amber-700'
                    : 'text-[10px] font-black uppercase tracking-[0.08em] text-slate-500'}
                >
                  {row.label}
                </dt>
                <dd className={row.empty
                  ? 'mt-1.5 break-words text-sm font-bold italic leading-5 text-slate-400'
                  : 'mt-1.5 break-words text-sm font-black leading-5 text-slate-950'}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  )
}

const getItemTitle = (item, index) => {
  if (!item || typeof item !== 'object') return `Item ${index + 1}`
  return item.name || item.document_name || item.documentName || item.full_name || item.fullName || item.label || `Item ${index + 1}`
}

const ArrayReview = ({ label, value }) => (
  <div className="space-y-3">
    {value.length ? value.map((item, index) => (
      <article key={`${label}-${index}`} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex min-w-0 items-center gap-2">
            <FiFileText className="h-4 w-4 shrink-0 text-blue-600" />
            <p className="truncate text-sm font-black text-slate-950">{getItemTitle(item, index)}</p>
          </div>
          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-500">{index + 1}/{value.length}</span>
        </div>
        {item && typeof item === 'object'
          ? <ReviewRows object={item} sectionLabel={label} />
          : <p className="text-sm font-bold text-slate-800">{formatScalar(item, label)}</p>}
      </article>
    )) : (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm font-semibold text-slate-500">No items selected.</div>
    )}
  </div>
)

const NestedObjectReview = ({ label, value }) => {
  const nestedEntries = Object.entries(value || {}).filter(([key, child]) => !isTechnicalKey(key) && (Array.isArray(child) || (child && typeof child === 'object')))
  return (
    <div className="space-y-4">
      <ReviewRows object={value} sectionLabel={label} />
      {nestedEntries.map(([childKey, childValue]) => (
        <section key={childKey} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
          <h4 className="mb-3 text-xs font-black uppercase tracking-[0.1em] text-slate-500">{humanizeKey(childKey)}</h4>
          {Array.isArray(childValue)
            ? <ArrayReview label={childKey} value={childValue} />
            : <NestedObjectReview label={childKey} value={childValue} />}
        </section>
      ))}
    </div>
  )
}

const buildReviewSections = (payload) => {
  if (payload === null || payload === undefined || payload === '') {
    return [{ key: 'details', label: 'details', value: {}, kind: 'object', ...getSectionMeta('details') }]
  }
  if (Array.isArray(payload)) {
    return [{ key: 'items', label: 'items', value: payload, kind: 'array', ...getSectionMeta('items') }]
  }
  if (typeof payload !== 'object') {
    return [{ key: 'details', label: 'details', value: { value: payload }, kind: 'object', ...getSectionMeta('details') }]
  }

  const sections = []
  const scalarEntries = Object.entries(payload).filter(([key, value]) => !isTechnicalKey(key) && !Array.isArray(value) && !(value && typeof value === 'object'))
  if (scalarEntries.length) {
    sections.push({ key: 'details', label: 'details', value: Object.fromEntries(scalarEntries), kind: 'object', ...getSectionMeta('details') })
  }

  Object.entries(payload).forEach(([key, value]) => {
    if (isTechnicalKey(key) || (!Array.isArray(value) && !(value && typeof value === 'object'))) return
    sections.push({
      key,
      label: key,
      value,
      kind: Array.isArray(value) ? 'array' : 'object',
      ...getSectionMeta(key),
    })
  })

  return sections.length
    ? sections
    : [{ key: 'details', label: 'details', value: payload, kind: 'object', ...getSectionMeta('details') }]
}

const ReviewSection = ({ section }) => {
  const counts = useMemo(() => countReviewValues(section.value), [section.value])
  return (
    <section className={`overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm ${section.accent}`}>
      <header className={`border-b px-5 py-4 ${section.header}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-lg font-black text-slate-950">{section.title}</h3>
            <p className="mt-1 max-w-3xl text-xs font-semibold leading-5 text-slate-600">{section.helper}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${section.badge}`}>{counts.total} fields</span>
            {counts.blank ? <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-black text-slate-600 ring-1 ring-slate-200">{counts.blank} not provided</span> : null}
          </div>
        </div>
      </header>
      <div className="p-4 sm:p-5">
        {section.kind === 'array'
          ? <ArrayReview label={section.label} value={section.value} />
          : <NestedObjectReview label={section.label} value={section.value} />}
      </div>
    </section>
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

const getExampleControlKind = (control) => {
  if (!control) return ''
  const tagName = String(control.tagName || '').toUpperCase()
  if (tagName === 'TEXTAREA') return 'textarea'
  if (tagName !== 'INPUT') return ''
  return String(control.type || control.getAttribute?.('type') || 'text').toLowerCase()
}

const canShowInputExample = (control) => {
  if (!control || control.disabled || control.readOnly) return false
  const inputType = getExampleControlKind(control)
  return inputType === 'textarea' || ['text', 'number'].includes(inputType)
}

const inferExample = (labelText, control) => {
  const label = String(labelText || '').toLowerCase()
  const type = getExampleControlKind(control)
  const placeholder = exampleFromPlaceholder(control?.getAttribute('placeholder'))

  // Custom follow-up inputs should demonstrate values outside the normal preset choices.
  if (/custom.*daily.*penalty.*rate/.test(label)) return '0.15%'
  if (/custom.*downpayment.*percentage/.test(label)) return '20%'
  if (/actual.*downpayment.*amount/.test(label)) return '₱400,000'
  if (/custom.*downpayment.*term/.test(label)) return '18 months'
  if (/custom.*monthly.*term/.test(label)) return '30 months'
  if (/custom/.test(label) && /month|term/.test(label)) return '18 months'
  if (/custom/.test(label) && /rate|percentage|percent|\(%\)|\b%\b/.test(label)) return '12.5%'

  if (/first name/.test(label)) return 'Juan'
  if (/middle name/.test(label)) return 'Santos'
  if (/last name|surname/.test(label)) return 'Dela Cruz'
  if (/full name|buyer name|client name|seller name|employee name|witness name|representative name/.test(label)) return 'Juan Dela Cruz'
  if (/email/.test(label)) return 'juan@email.com'
  if (/contact|mobile|phone|telephone/.test(label)) return '0917 123 4567'
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
  if (/date|birthday|birth date|due date/.test(label)) return 'Aug 7, 2026'
  if (/time/.test(label)) return '9:00 AM'
  if (/rate|percentage|percent|\(%\)|\b%\b/.test(label)) return '0.05%'
  if (/amount|fee|price|tcp|commission|salary|payment|cash|balance|income|advance/.test(label)) return '₱50,000'
  if (/status/.test(label)) return 'Active'
  if (/role/.test(label)) return 'Sales Agent'
  if (/type/.test(label)) return 'Installment'
  if (/method/.test(label)) return 'Bank Transfer'
  if (/description|notes|remarks|reason|purpose/.test(label)) return 'Short clear description'
  if (placeholder) return placeholder
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
    const control = getControlForLabel(label)
    const existingExamples = Array.from(label.querySelectorAll('.dc-input-example'))
    if (!canShowInputExample(control)) {
      existingExamples.forEach((node) => node.remove())
      return
    }
    if (existingExamples.length) return
    const labelText = cleanLabelText(label)
    if (!labelText || /search|filter|rows per page|page size/i.test(labelText)) return

    const example = inferExample(labelText, control)
    if (!example) return
    const span = document.createElement('span')
    span.className = 'dc-input-example ml-2'
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

  document.querySelectorAll('input, textarea').forEach((control) => {
    if (!canShowInputExample(control)) return
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
    span.className = 'dc-input-example ml-2'
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
  const [reviewStep, setReviewStep] = useState(0)
  const resolverRef = useRef(null)

  useEffect(() => setMutationReviewHandler((nextRequest) => new Promise((resolve) => {
    resolverRef.current = resolve
    setReviewStep(0)
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

  const reviewSections = useMemo(() => buildReviewSections(request?.payload), [request?.payload])
  const safeStep = Math.min(reviewStep, Math.max(reviewSections.length - 1, 0))
  const currentSection = reviewSections[safeStep]
  const isFirstStep = safeStep === 0
  const isLastStep = safeStep === reviewSections.length - 1

  const finish = (confirmed) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    setReviewStep(0)
    resolve?.(confirmed)
  }

  return (
    <>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="mutation-review-title" className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-2xl">
            <header className="shrink-0 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiShield className="h-5 w-5" /></span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-700">Final double-check · Step {safeStep + 1} of {reviewSections.length}</p>
                    <h2 id="mutation-review-title" className="mt-1 text-xl font-black text-slate-950">{request.title}</h2>
                    <p className="mt-1 max-w-4xl text-sm font-semibold leading-6 text-slate-600">{request.description}</p>
                  </div>
                </div>
                <button type="button" onClick={() => finish(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Back to edit"><FiX className="h-5 w-5" /></button>
              </div>

              <div className="mt-4 overflow-x-auto pb-1">
                <div className="flex min-w-max items-center gap-2">
                  {reviewSections.map((section, index) => {
                    const active = index === safeStep
                    const complete = index < safeStep
                    return (
                      <div key={section.key} className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${active ? 'border-blue-200 bg-blue-50' : complete ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
                        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-black ring-4 ${active ? section.step : complete ? 'bg-emerald-600 text-white ring-emerald-100' : 'bg-white text-slate-400 ring-slate-100'}`}>
                          {complete ? <FiCheckCircle className="h-3.5 w-3.5" /> : index + 1}
                        </span>
                        <span className={`text-xs font-black ${active ? 'text-slate-950' : complete ? 'text-emerald-800' : 'text-slate-400'}`}>{section.title}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-black">Every user-facing field in this step is shown.</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">Blank values stay visible as “Not provided.” Nothing is saved until the last step is confirmed.</p>
                </div>
                {request.summary ? <span className="shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-blue-800 ring-1 ring-blue-200">{request.summary}</span> : null}
              </div>

              {currentSection ? <ReviewSection section={currentSection} /> : null}
            </div>

            <footer className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center justify-between gap-3 sm:justify-start">
                <button type="button" onClick={() => finish(false)} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft /> Back to Edit</button>
                <span className="text-xs font-semibold text-slate-500">All fields shown · Step {safeStep + 1} of {reviewSections.length}</span>
              </div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                {!isFirstStep ? (
                  <button type="button" onClick={() => setReviewStep((current) => Math.max(current - 1, 0))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft /> Previous</button>
                ) : null}
                {!isLastStep ? (
                  <button type="button" onClick={() => setReviewStep((current) => Math.min(current + 1, reviewSections.length - 1))} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 text-sm font-black text-white transition hover:bg-blue-700 active:scale-[0.99]">Next: {reviewSections[safeStep + 1]?.title || 'Review'} <FiArrowRight /></button>
                ) : (
                  <button type="button" onClick={() => finish(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 text-sm font-black text-white shadow-sm transition hover:bg-emerald-700 active:scale-[0.99]"><FiCheckCircle /> {request.confirmLabel}</button>
                )}
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default MutationReviewProvider
