export const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

export const cleanMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,\s]/g, '')) || 0
}

export const formatDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

export const getValue = (source, keys, fallback = '-') => {
  for (const key of keys) {
    if (
      source?.[key] !== undefined &&
      source?.[key] !== null &&
      source?.[key] !== ''
    ) {
      return source[key]
    }
  }

  return fallback
}

export const readPrintPayload = () => {
  try {
    const saved = localStorage.getItem('lot_project_print_payload')
    if (!saved) return {}

    return JSON.parse(saved)
  } catch {
    return {}
  }
}

export const CheckBox = ({ label, checked = false }) => (
  <span className="mr-2 inline-flex items-center gap-1">
    <span className="text-[10px]">{checked ? '☑' : '☐'}</span>
    {label}
  </span>
)

export const PrintHeaderCell = ({ children, className = '' }) => (
  <div
    className={`border border-black bg-[#d9d9d9] px-2 py-1 text-center text-[11px] font-black ${className}`}
  >
    {children}
  </div>
)

export const PrintCell = ({ children, className = '' }) => (
  <div
    className={`border border-black px-2 py-1 text-[10px] leading-snug ${className}`}
  >
    {children}
  </div>
)

export const getNormalizedSoaRows = (soaRows = []) => {
  if (!soaRows.length) return []

  return soaRows.map((row, index) => ({
    id: row.id || row.lot_project_payment_schedule_id || index + 1,
    dueDate: row.dueDate || row.due_date || '-',
    description: row.description || row.payment_description || '-',
    dueAmount: cleanMoney(row.dueAmount ?? row.due_amount),
    penalty: cleanMoney(row.penalty ?? row.penaltyAmount ?? row.penalty_amount),
    datePaid: row.datePaid || row.date_paid || '-',
    amountPaid: cleanMoney(row.amountPaid ?? row.amount_paid),
    referenceId: row.referenceId || row.reference_id || row.reference || '-',
    remainingBalance: cleanMoney(
      row.remainingBalance ??
        row.endingBalance ??
        row.runningBalance ??
        row.ending_balance
    ),
  }))
}

