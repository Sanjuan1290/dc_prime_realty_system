import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiArrowLeft,
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
    helper: 'Confirm the exact project, unit, area, pricing choice, and reservation fee.',
    header: 'border-blue-200 bg-blue-50/80',
    badge: 'bg-blue-100 text-blue-700',
    accent: 'border-l-blue-500',
  },
  buyerprofile: {
    title: 'Buyer Information',
    helper: 'Review the buyer identity and only the contact, employment, and second-buyer details that were actually entered.',
    header: 'border-indigo-200 bg-indigo-50/80',
    badge: 'bg-indigo-100 text-indigo-700',
    accent: 'border-l-indigo-500',
  },
  documentrequirements: {
    title: 'Document Checklist',
    helper: 'Confirm each selected document and whether it is Required or Optional.',
    header: 'border-emerald-200 bg-emerald-50/80',
    badge: 'bg-emerald-100 text-emerald-700',
    accent: 'border-l-emerald-500',
  },
  paymentterms: {
    title: 'Payment Terms & Financials',
    helper: 'Pay special attention to amounts, dates, rates, discounts, and installment terms.',
    header: 'border-amber-200 bg-amber-50/80',
    badge: 'bg-amber-100 text-amber-800',
    accent: 'border-l-amber-500',
  },
  sellerassignment: {
    title: 'Seller Assignment',
    helper: 'Confirm the seller, group, role, and assignment details.',
    header: 'border-violet-200 bg-violet-50/80',
    badge: 'bg-violet-100 text-violet-700',
    accent: 'border-l-violet-500',
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
  helper: 'Review the populated values in this section.',
  header: 'border-slate-200 bg-slate-50',
  badge: 'bg-slate-100 text-slate-700',
  accent: 'border-l-slate-400',
}

const isSensitiveKey = (key) => /password|secret|token|signature|authorization|cookie/i.test(String(key || ''))
const isTechnicalKey = (key) => /request.?key|cloudinary|asset.?id|public.?id|website$|buyer.?form.?submission.?id/i.test(String(key || ''))
const isCriticalKey = (key) => /amount|fee|price|tcp|lmf|downpayment|discount|balance|income|salary|cash|payment|commission|rate|percentage|percent|interest|penalty|date|due|term/i.test(String(key || ''))

const isEmptyScalar = (value) => {
  if (value === null || value === undefined) return true
  if (typeof value !== 'string') return false
  const text = value.trim()
  return text === '' || text === '-' || text === '—'
}

const formatScalar = (value, key = '') => {
  if (isSensitiveKey(key)) return value ? '••••••••' : '—'
  if (isEmptyScalar(value)) return '—'
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
    rows.push({
      key: path,
      sourceKey: key,
      label: humanizeKey(key),
      value: formatScalar(value, key),
      empty: isEmptyScalar(value),
      technical: isTechnicalKey(key),
      critical: isCriticalKey(key),
    })
  })
  return rows
}

const countReviewValues = (value, key = '') => {
  if (isTechnicalKey(key)) return { provided: 0, blank: 0 }
  if (Array.isArray(value)) {
    return value.reduce((total, item) => {
      const next = countReviewValues(item)
      return { provided: total.provided + next.provided, blank: total.blank + next.blank }
    }, { provided: 0, blank: 0 })
  }
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((total, [childKey, childValue]) => {
      const next = countReviewValues(childValue, childKey)
      return { provided: total.provided + next.provided, blank: total.blank + next.blank }
    }, { provided: 0, blank: 0 })
  }
  return isEmptyScalar(value) ? { provided: 0, blank: 1 } : { provided: 1, blank: 0 }
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

const groupRows = (rows, sectionLabel) => {
  const grouped = new Map()
  rows.forEach((row) => {
    const group = getRowGroup(sectionLabel, row)
    if (!grouped.has(group)) grouped.set(group, [])
    grouped.get(group).push(row)
  })
  return Array.from(grouped.entries()).map(([title, items]) => ({ title, rows: items }))
}

const EmptyFieldsDisclosure = ({ rows }) => {
  if (!rows.length) return null
  return (
    <details className="mt-3 rounded-xl border border-dashed border-slate-300 bg-slate-50/70">
      <summary className="cursor-pointer select-none px-4 py-3 text-xs font-black text-slate-500">
        Not provided ({rows.length}) — hidden to keep this review focused
      </summary>
      <div className="flex flex-wrap gap-2 border-t border-dashed border-slate-300 px-4 py-3">
        {rows.map((row) => (
          <span key={row.key} className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-500 ring-1 ring-slate-200">
            {row.label}
          </span>
        ))}
      </div>
    </details>
  )
}

const ReviewRows = ({ object, sectionLabel = '' }) => {
  const rows = useMemo(() => flattenObject(object), [object])
  const visibleRows = rows.filter((row) => !row.technical && !row.empty)
  const emptyRows = rows.filter((row) => !row.technical && row.empty)
  const groups = groupRows(visibleRows, sectionLabel)

  if (!visibleRows.length && !emptyRows.length) return null

  return (
    <div>
      {visibleRows.length ? (
        <div className="space-y-4">
          {groups.map((group, groupIndex) => (
            <div key={`${sectionLabel || 'details'}-${group.title || groupIndex}`}>
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
                    className={row.critical
                      ? 'rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3'
                      : 'rounded-xl border border-slate-200 bg-white px-4 py-3'}
                  >
                    <dt className={row.critical
                      ? 'text-[10px] font-black uppercase tracking-[0.08em] text-amber-700'
                      : 'text-[10px] font-black uppercase tracking-[0.08em] text-slate-500'}
                    >
                      {row.label}
                    </dt>
                    <dd className="mt-1.5 break-words text-sm font-black leading-5 text-slate-950">{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm font-semibold text-slate-500">
          No values were entered in this section.
        </div>
      )}
      <EmptyFieldsDisclosure rows={emptyRows} />
    </div>
  )
}

const getItemTitle = (item, index) => {
  if (!item || typeof item !== 'object') return `Item ${index + 1}`
  return item.name || item.document_name || item.documentName || item.full_name || item.fullName || item.label || `Item ${index + 1}`
}

const ArrayReview = ({ label, value }) => {
  const meta = getSectionMeta(label)
  const counts = countReviewValues(value)
  return (
    <section className={`overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm ${meta.accent}`}>
      <header className={`flex items-start justify-between gap-3 border-b px-4 py-3.5 ${meta.header}`}>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-black text-slate-950">{meta.title}</h3>
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>{value.length} item{value.length === 1 ? '' : 's'}</span>
          </div>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{meta.helper}</p>
        </div>
        <FiFileText className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
      </header>
      <div className="space-y-2.5 p-3 sm:p-4">
        {value.length ? value.map((item, index) => (
          <article key={`${label}-${index}`} className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="min-w-0 truncate text-sm font-black text-slate-900">{getItemTitle(item, index)}</p>
              <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[10px] font-black text-slate-500 ring-1 ring-slate-200">{index + 1}/{value.length}</span>
            </div>
            {item && typeof item === 'object'
              ? <ReviewRows object={item} sectionLabel={label} />
              : <p className="text-sm font-bold text-slate-800">{formatScalar(item, label)}</p>}
          </article>
        )) : (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-500">No items selected.</div>
        )}
        {counts.blank > 0 && counts.provided === 0 && value.length ? (
          <p className="text-xs font-semibold text-slate-500">The selected items do not contain populated review values.</p>
        ) : null}
      </div>
    </section>
  )
}

const ObjectReview = ({ label, value }) => {
  const meta = getSectionMeta(label)
  const nestedEntries = Object.entries(value || {}).filter(([key, child]) => !isTechnicalKey(key) && (Array.isArray(child) || (child && typeof child === 'object')))
  const counts = countReviewValues(value)

  return (
    <section className={`overflow-hidden rounded-2xl border border-l-4 bg-white shadow-sm ${meta.accent}`}>
      <header className={`border-b px-4 py-3.5 ${meta.header}`}>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-black text-slate-950">{meta.title}</h3>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${meta.badge}`}>{counts.provided} entered</span>
        </div>
        <p className="mt-1 text-xs font-semibold leading-5 text-slate-600">{meta.helper}</p>
      </header>
      <div className="space-y-3 p-3 sm:p-4">
        <ReviewRows object={value} sectionLabel={label} />
        {nestedEntries.map(([childKey, childValue]) => (
          Array.isArray(childValue)
            ? <ArrayReview key={childKey} label={childKey} value={childValue} />
            : <ObjectReview key={childKey} label={childKey} value={childValue} />
        ))}
      </div>
    </section>
  )
}

const ReviewOverview = ({ payload }) => {
  const counts = useMemo(() => countReviewValues(payload), [payload])
  const sectionLabels = useMemo(() => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return []
    return Object.entries(payload)
      .filter(([key, value]) => !isTechnicalKey(key) && (Array.isArray(value) || (value && typeof value === 'object')))
      .map(([key]) => getSectionMeta(key).title)
  }, [payload])

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-black text-slate-950">Review what matters most</p>
          <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
            Populated values stay visible. Blank fields are collapsed so important names, amounts, dates, rates, and requirements are easier to spot.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          {sectionLabels.length ? <span className="rounded-full bg-blue-50 px-3 py-1.5 text-xs font-black text-blue-700">{sectionLabels.length} sections</span> : null}
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">{counts.provided} entered</span>
          {counts.blank ? <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-600">{counts.blank} blank hidden</span> : null}
        </div>
      </div>
      {sectionLabels.length ? (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {sectionLabels.map((label) => <span key={label} className="rounded-lg bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 ring-1 ring-slate-200">{label}</span>)}
        </div>
      ) : null}
    </div>
  )
}

const PayloadReview = ({ payload }) => {
  if (payload === null || payload === undefined || payload === '') {
    return <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">This action has no editable information to review.</div>
  }
  if (Array.isArray(payload)) return <><ReviewOverview payload={payload} /><ArrayReview label="Items" value={payload} /></>
  if (typeof payload !== 'object') return <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm font-bold text-slate-900">{formatScalar(payload)}</div>

  const nestedEntries = Object.entries(payload).filter(([key, value]) => !isTechnicalKey(key) && (Array.isArray(value) || (value && typeof value === 'object')))
  return (
    <div>
      <ReviewOverview payload={payload} />
      <div className="space-y-4">
        <ReviewRows object={payload} sectionLabel="details" />
        {nestedEntries.map(([key, value]) => (
          Array.isArray(value)
            ? <ArrayReview key={key} label={key} value={value} />
            : <ObjectReview key={key} label={key} value={value} />
        ))}
      </div>
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

  useEffect(() => setMutationReviewHandler((nextRequest) => new Promise((resolve) => {
    resolverRef.current = resolve
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

  const isDangerous = /delete|purge|remove|cancel/i.test(String(request?.confirmLabel || ''))
  const confirmClass = isDangerous
    ? 'bg-red-600 hover:bg-red-700 focus:ring-red-100'
    : 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-100'

  return (
    <>
      {children}
      {request ? (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-slate-950/70 p-2.5 backdrop-blur-sm sm:p-5">
          <div role="dialog" aria-modal="true" aria-labelledby="mutation-review-title" className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-2xl">
            <div className="h-1.5 shrink-0 bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-500" />
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6 sm:py-5">
              <div className="flex min-w-0 items-start gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100"><FiShield className="h-5 w-5" /></span>
                <div className="min-w-0">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-blue-700">Final double-check</p>
                  <h2 id="mutation-review-title" className="mt-1 text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{request.title}</h2>
                  <p className="mt-1 max-w-3xl text-sm font-semibold leading-6 text-slate-600">{request.description}</p>
                </div>
              </div>
              <button type="button" onClick={() => finish(false)} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" aria-label="Back to edit"><FiX className="h-5 w-5" /></button>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <div className="mb-4 flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3.5 text-blue-950 shadow-sm">
                <FiShield className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <p className="text-sm font-black">Nothing has been saved yet.</p>
                  <p className="mt-1 text-xs font-semibold leading-5 text-blue-800">Scan each colored section, especially the amber financial fields. Use Back to Edit if anything looks wrong.</p>
                </div>
              </div>

              {request.summary ? (
                <div className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm font-black text-indigo-900 shadow-sm">
                  {request.summary}
                </div>
              ) : null}

              <PayloadReview payload={request.payload} />
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-500"><FiShield className="text-blue-600" /> Nothing is saved until you confirm.</div>
              <div className="flex flex-col-reverse gap-2 sm:flex-row">
                <button type="button" onClick={() => finish(false)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"><FiArrowLeft /> Back to Edit</button>
                <button type="button" onClick={() => finish(true)} className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black text-white shadow-sm transition focus:outline-none focus:ring-4 active:scale-[0.99] ${confirmClass}`}><FiCheckCircle /> {request.confirmLabel}</button>
              </div>
            </footer>
          </div>
        </div>
      ) : null}
    </>
  )
}

export default MutationReviewProvider
