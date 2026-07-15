import PrintPageShell from './PrintPageShell'

const readProofPayload = () => {
  try {
    const saved = localStorage.getItem('accredited_seller_proof_payload')
    if (!saved) return {}
    return JSON.parse(saved)
  } catch {
    return {}
  }
}

const roleLabels = {
  broker_network_manager: 'BROKER NETWORK MANAGER',
  broker: 'BROKER',
  manager: 'MANAGER',
  agent: 'SALES AGENT',
}

const amountNumber = (value) =>
  new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0))

const formatPercent = (value) => {
  const number = Number(value || 0)
  return Number.isInteger(number) ? String(number) : number.toFixed(2)
}

const formatLongDate = (value) => {
  if (!value || value === '-') return '-'

  const text = String(value).trim()
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})/)

  if (match) {
    const [, year, month, day] = match
    const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const date = new Date(text)
  if (Number.isNaN(date.getTime())) return text

  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const underTwenty = [
  'zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
  'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
  'seventeen', 'eighteen', 'nineteen',
]
const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']

const integerToWords = (value) => {
  const number = Math.floor(Math.abs(Number(value || 0)))
  if (number < 20) return underTwenty[number]
  if (number < 100) return `${tens[Math.floor(number / 10)]}${number % 10 ? `-${underTwenty[number % 10]}` : ''}`
  if (number < 1000) return `${underTwenty[Math.floor(number / 100)]} hundred${number % 100 ? ` ${integerToWords(number % 100)}` : ''}`
  if (number < 1_000_000) return `${integerToWords(Math.floor(number / 1000))} thousand${number % 1000 ? ` ${integerToWords(number % 1000)}` : ''}`
  if (number < 1_000_000_000) return `${integerToWords(Math.floor(number / 1_000_000))} million${number % 1_000_000 ? ` ${integerToWords(number % 1_000_000)}` : ''}`
  return `${integerToWords(Math.floor(number / 1_000_000_000))} billion${number % 1_000_000_000 ? ` ${integerToWords(number % 1_000_000_000)}` : ''}`
}

const amountInWords = (value) => {
  const amount = Math.max(Number(value || 0), 0)
  const pesos = Math.floor(amount)
  const centavos = Math.round((amount - pesos) * 100)
  const centavoWords = centavos ? ` AND ${integerToWords(centavos).toUpperCase()} CENTAVOS` : ''
  return `${integerToWords(pesos).toUpperCase()} PESOS${centavoWords} ONLY`
}

const CommissionReceiptPrint = ({ seller = {}, receipt = {} }) => {
  const totalAmount = Number(receipt.totalAmount || 0)
  const releases = Array.isArray(receipt.releases) ? receipt.releases : []
  const releasePercent = releases.reduce(
    (sum, release) => sum + Number(release.releasePercent || 0),
    0
  )
  const commissionRate = Number(receipt.commissionRate || 0)
  const role = receipt.commissionRole || seller.role
  const amountText = amountNumber(totalAmount)

  return (
    <section
      className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white px-[30mm] py-[18mm] text-[#4b5563] shadow-lg print:shadow-none"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div className="mx-auto w-full text-[12px] leading-[1.25]">
        <p className="text-[13px] font-medium">{formatLongDate(receipt.receiptDate)}</p>

        <h1 className="mt-10 text-[15px] font-bold">
          Acknowledgement Receipt for Fund Release:
        </h1>

        <table className="mt-6 w-full table-fixed border-collapse text-[12px]">
          <colgroup>
            <col className="w-[25%]" />
            <col className="w-[26%]" />
            <col className="w-[25%]" />
            <col className="w-[24%]" />
          </colgroup>
          <thead>
            <tr className="bg-[#d9d9d9] text-[13px] font-bold">
              <th className="border border-[#8a8a8a] px-2 py-2 text-left">PAYEE</th>
              <th className="border border-[#8a8a8a] px-2 py-2 text-left">Description</th>
              <th className="border border-[#8a8a8a] px-2 py-2 text-left">Date</th>
              <th className="border border-[#8a8a8a] px-2 py-2 text-center">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            <tr className="h-[61mm] align-top">
              <td className="border border-[#8a8a8a] px-2 py-3">
                <p className="text-[13px] font-bold uppercase leading-tight">
                  COMMISSION<br />RELEASE
                </p>
                <p className="mt-14 text-[13px] font-medium uppercase">
                  {seller.full_name || seller.fullName || '-'}
                </p>
              </td>

              <td className="border border-[#8a8a8a] px-2 py-3">
                <p className="text-[13px] font-bold underline">TOTAL:</p>
                <p className="text-[13px] font-bold">{amountText}</p>

                <div className="mt-7 text-[13px] font-bold uppercase leading-[1.25]">
                  <p>PHP {amountText}</p>
                  <p>{receipt.unitId || '-'}</p>
                  <p>
                    {receipt.buyerName || '-'}{releasePercent > 0 ? ` ${formatPercent(releasePercent)}%` : ''}
                  </p>
                  {releasePercent > 0 ? (
                    <p>({formatPercent(releasePercent)}% OF 100%)</p>
                  ) : null}
                  <p>{roleLabels[role] || String(role || '-').replaceAll('_', ' ').toUpperCase()}</p>
                  {commissionRate > 0 ? (
                    <p className="mt-1 text-[10px]">COMMISSION RATE: {formatPercent(commissionRate)}%</p>
                  ) : null}
                </div>
              </td>

              <td className="border border-[#8a8a8a] px-2 py-3 text-[13px] font-medium">
                {formatLongDate(receipt.receiptDate)}
              </td>

              <td className="border border-[#8a8a8a] px-2 py-3 text-right text-[13px] font-medium">
                {amountText}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-6 text-[14px] font-medium uppercase leading-6">
          TOTAL AMOUNT: {amountInWords(totalAmount)} ({amountText}).
        </p>

        <div className="mt-12">
          <p className="text-[14px]">Payee:</p>
          <div className="mt-10 w-[78mm] border-b border-[#555]" />
          <p className="mt-1 text-[13px] font-bold uppercase">
            {seller.full_name || seller.fullName || '-'}
          </p>
          <p className="text-[12px]">Signature and Date</p>
        </div>

        <div className="mt-12">
          <p className="text-[14px]">Witness:</p>
          <div className="mt-10 w-[78mm] border-b border-[#555]" />
          <p className="mt-1 text-[13px] font-bold uppercase">
            {receipt.witnessName || '-'}
          </p>
          <p className="text-[12px]">Signature and Date</p>
        </div>

        <div className="mt-12 border-t border-dashed border-slate-300 pt-3 text-[9px] text-slate-500 print:hidden">
          <p>Bank: {receipt.bankName || '-'} · Account No.: {receipt.accountNumber || '-'} · Reference No.: {receipt.referenceNumber || '-'}</p>
        </div>
      </div>
    </section>
  )
}

const AccreditedSellerProofOfIncomePrintPage = () => {
  const { seller = {}, receipt = null } = readProofPayload()

  return (
    <PrintPageShell title="Acknowledgement Receipt for Fund Release">
      {receipt ? (
        <CommissionReceiptPrint seller={seller} receipt={receipt} />
      ) : (
        <section className="print-page mx-auto min-h-[297mm] w-[210mm] bg-white p-[20mm] text-center text-sm text-slate-600 shadow-lg print:shadow-none">
          No commission receipt was selected for printing.
        </section>
      )}
    </PrintPageShell>
  )
}

export default AccreditedSellerProofOfIncomePrintPage

