export const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

export const moneyNoSymbol = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

export const cleanMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,\s]/g, '')) || 0
}

export const formatDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: '2-digit',
  }).format(date)
}

export const formatLongDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
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
    const saved =
      localStorage.getItem('lot_print_payload') ||
      localStorage.getItem('bailen_print_payload')

    if (!saved) return {}

    return JSON.parse(saved)
  } catch {
    return {}
  }
}

export const CheckBox = ({ label, checked = false }) => (
  <span className="mr-2 inline-flex items-center gap-1 whitespace-nowrap">
    <span className="text-[9px] leading-none">{checked ? '☑' : '☐'}</span>
    {label}
  </span>
)

export const PrintHeaderCell = ({ children, className = '' }) => (
  <div className={`border border-black bg-[#d9d9d9] px-1.5 py-1 text-center text-[10px] font-black ${className}`}>
    {children}
  </div>
)

export const PrintCell = ({ children, className = '' }) => (
  <div className={`border border-black px-1.5 py-1 text-[9px] leading-snug ${className}`}>
    {children}
  </div>
)

export const getNormalizedSoaRows = (soaRows = [], listing = {}) => {
  if (soaRows.length) {
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

  const tcp = cleanMoney(getValue(listing, ['tcp', 'tcpAmount', 'lot_project_listing_tcp'], 0))
  const reservationFee = cleanMoney(getValue(listing, ['reservationFee', 'reservation_fee', 'lot_project_listing_reservation_fee'], 0))

  return [
    {
      id: 1,
      dueDate: '-',
      description: 'Reservation Fee',
      dueAmount: reservationFee,
      penalty: 0,
      datePaid: '-',
      amountPaid: 0,
      referenceId: '-',
      remainingBalance: tcp,
    },
  ]
}

export const numberToWords = (value) => {
  const number = Math.floor(Number(value || 0))
  if (!number) return 'ZERO'

  const ones = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN', 'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN']
  const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY']

  const underThousand = (num) => {
    const words = []
    const hundred = Math.floor(num / 100)
    const rest = num % 100

    if (hundred) words.push(`${ones[hundred]} HUNDRED`)
    if (rest < 20) {
      if (rest) words.push(ones[rest])
    } else {
      const ten = Math.floor(rest / 10)
      const one = rest % 10
      words.push(tens[ten])
      if (one) words.push(ones[one])
    }

    return words.join(' ')
  }

  const groups = [
    { value: 1_000_000_000, label: 'BILLION' },
    { value: 1_000_000, label: 'MILLION' },
    { value: 1_000, label: 'THOUSAND' },
    { value: 1, label: '' },
  ]

  let remaining = number
  const words = []

  for (const group of groups) {
    const amount = Math.floor(remaining / group.value)
    if (amount) {
      words.push(`${underThousand(amount)} ${group.label}`.trim())
      remaining %= group.value
    }
  }

  return words.join(' ')
}
