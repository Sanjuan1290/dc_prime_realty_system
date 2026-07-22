import PrintPageShell from './PrintPageShell'
import { cleanMoney, getValue, readPrintPayload } from './printUtils'

const numberFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const wholeNumberFormatter = new Intl.NumberFormat('en-PH', {
  maximumFractionDigits: 2,
})

const ones = [
  'zero',
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
  'eleven',
  'twelve',
  'thirteen',
  'fourteen',
  'fifteen',
  'sixteen',
  'seventeen',
  'eighteen',
  'nineteen',
]

const tens = [
  '',
  '',
  'twenty',
  'thirty',
  'forty',
  'fifty',
  'sixty',
  'seventy',
  'eighty',
  'ninety',
]

const integerToWords = (rawValue) => {
  const value = Math.max(0, Math.trunc(Number(rawValue || 0)))

  if (value < 20) return ones[value]
  if (value < 100) {
    const remainder = value % 10
    return `${tens[Math.floor(value / 10)]}${remainder ? ` ${ones[remainder]}` : ''}`
  }
  if (value < 1000) {
    const remainder = value % 100
    return `${ones[Math.floor(value / 100)]} hundred${remainder ? ` ${integerToWords(remainder)}` : ''}`
  }

  const scales = [
    [1_000_000_000, 'billion'],
    [1_000_000, 'million'],
    [1_000, 'thousand'],
  ]

  for (const [scale, label] of scales) {
    if (value >= scale) {
      const remainder = value % scale
      return `${integerToWords(Math.floor(value / scale))} ${label}${remainder ? ` ${integerToWords(remainder)}` : ''}`
    }
  }

  return String(value)
}

const amountToWords = (rawAmount) => {
  const amount = Math.max(cleanMoney(rawAmount), 0)
  const roundedCentavos = Math.round(amount * 100)
  const pesos = Math.floor(roundedCentavos / 100)
  const centavos = roundedCentavos % 100

  const pesoWords = `${integerToWords(pesos)} peso${pesos === 1 ? '' : 's'}`

  if (!centavos) return pesoWords.toUpperCase()

  return `${pesoWords} and ${integerToWords(centavos)} centavo${centavos === 1 ? '' : 's'}`.toUpperCase()
}

const formatTableDate = (value) => {
  const dateText = String(value || '').slice(0, 10)
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return value || '-'

  return `${match[2]} / ${match[3]} / ${match[1]}`
}

const formatLongDate = (value) => {
  const dateText = String(value || '').slice(0, 10)
  const match = dateText.match(/^(\d{4})-(\d{2})-(\d{2})$/)

  if (!match) return value || '-'

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))

  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date)
}

const cleanDisplay = (value, fallback = '-') => {
  const text = String(value ?? '').trim()
  return text && text !== '-' ? text : fallback
}

const getPaymentPurpose = (payment = {}) => {
  const scheduleDescription = cleanDisplay(
    payment.scheduleDescription || payment.schedule_description,
    ''
  )

  if (scheduleDescription) {
    return scheduleDescription
      .replace(/monthly payment/gi, 'Monthly Amortization')
      .replace(/\s+/g, ' ')
      .trim()
  }

  return cleanDisplay(
    payment.paymentType || payment.type || payment.paymentTypeValue,
    'Payment'
  )
}

const getPaymentBankLabel = (payment = {}) => {
  const explicitBank = cleanDisplay(
    payment.bankName ||
      payment.bank_name ||
      payment.paymentBank ||
      payment.payment_bank,
    ''
  )

  if (explicitBank) return explicitBank

  return cleanDisplay(payment.method, 'Payment')
}

const getPaymentAccountNumber = (payment = {}) =>
  cleanDisplay(
    payment.accountNumber ||
      payment.account_number ||
      payment.accountNo ||
      payment.account_no ||
      payment.bankAccountNumber ||
      payment.bank_account_number,
    '-'
  )

const getBrokerDetails = (listing = {}) => {
  const hierarchy = Array.isArray(listing?.commissionRecalculation?.currentHierarchy)
    ? listing.commissionRecalculation.currentHierarchy
    : []
  const broker = hierarchy.find(
    (entry) => String(entry?.role || '').toLowerCase() === 'broker'
  )
  const assignedRole = String(
    listing.seller_role || listing.sellerRole || ''
  ).toLowerCase()

  return {
    name: cleanDisplay(
      broker?.sellerName ||
        broker?.seller_name ||
        (assignedRole === 'broker'
          ? listing.seller || listing.assigned_user
          : ''),
      'Authorized Realty Representative'
    ),
    prcNo: cleanDisplay(
      broker?.prcNo ||
        broker?.prc_no ||
        (assignedRole === 'broker'
          ? listing.sellerPrcNo || listing.seller_prc_no
          : ''),
      ''
    ),
  }
}

const AcknowledgementReceiptPage = ({
  payment = {},
  project = {},
  listing = {},
  client = {},
}) => {
  const buyerName = cleanDisplay(
    getValue(client, ['buyerName', 'buyer_name'], '') ||
      getValue(listing, ['buyer_name', 'buyerName'], ''),
    'Buyer'
  )
  const unitId = cleanDisplay(
    getValue(listing, ['unit_id', 'unitCode', 'lot_project_listing_unit_id'], ''),
    '-'
  )
  const projectName = cleanDisplay(
    getValue(project, ['name', 'lot_project_name'], '') ||
      getValue(listing, ['projectName', 'project_name'], ''),
    '-'
  )
  const projectLocation = cleanDisplay(
    getValue(project, ['location', 'lot_project_location'], '') ||
      getValue(listing, ['project_location', 'location'], ''),
    '-'
  )
  const lotArea = cleanMoney(
    getValue(listing, ['lotAreaSqm', 'area', 'lot_project_listing_area_sqm'], 0)
  )
  const lotNumber = cleanDisplay(
    getValue(listing, ['cadastral_lot_no', 'cadastralLots'], '') ||
      (Array.isArray(project.cadastralLots) ? project.cadastralLots.join(', ') : ''),
    '-'
  )
  const taxDeclaration = cleanDisplay(
    getValue(project, ['taxDeclarationNo', 'lot_project_tax_declaration_no'], ''),
    '-'
  )
  const pin = cleanDisplay(
    getValue(project, ['pin', 'lot_project_pin'], ''),
    '-'
  )
  const administrator = cleanDisplay(
    getValue(project, ['administrator', 'lot_project_administrator_name'], '') ||
      getValue(listing, ['administrator'], ''),
    '-'
  )
  const paymentAmount = cleanMoney(payment.amount)
  const paymentPurpose = getPaymentPurpose(payment)
  const broker = getBrokerDetails(listing)
  const witness = cleanDisplay(payment.verifiedBy, 'Authorized Representative')
  const paymentDate = payment.paymentDate || payment.payment_date
  const referenceId = cleanDisplay(
    payment.referenceId || payment.reference_id,
    '-'
  )

  const areaWords = lotArea > 0
    ? `${integerToWords(lotArea).toUpperCase()} SQUARE METER${lotArea === 1 ? '' : 'S'}`
    : 'THE STATED LOT AREA'

  return (
    <section
      className="print-page mx-auto h-[297mm] w-[210mm] overflow-hidden bg-white px-[17mm] py-[17mm] text-[#4b5563] shadow-lg print:shadow-none"
      style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}
    >
      <div className="mx-auto flex h-full w-full flex-col text-[11px] leading-[1.45]">
        <h1 className="mt-[17mm] text-center text-[14px] font-bold tracking-wide text-[#4b5563]">
          ACKNOWLEDGEMENT RECEIPT
        </h1>

        <p className="mt-[16mm] text-[12px]">
          This is to acknowledge receiving from{' '}
          <span className="font-bold uppercase">{buyerName}</span>{' '}
          the amount of:
        </p>

        <table className="mt-4 w-full table-fixed border-collapse text-[11px]">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[21%]" />
            <col className="w-[18%]" />
            <col className="w-[27%]" />
            <col className="w-[17%]" />
          </colgroup>

          <thead>
            <tr className="h-12 text-center font-bold">
              <th className="border border-[#6b7280] px-2">BANK</th>
              <th className="border border-[#6b7280] px-2">ACCOUNT NO.</th>
              <th className="border border-[#6b7280] px-2">DATE</th>
              <th className="border border-[#6b7280] px-2">REFERENCE NUMBER</th>
              <th className="border border-[#6b7280] px-2">AMOUNT</th>
            </tr>
          </thead>

          <tbody>
            <tr className="h-12 text-center">
              <td className="border border-[#6b7280] px-2 uppercase">
                {getPaymentBankLabel(payment)}
              </td>
              <td className="border border-[#6b7280] px-2">
                {getPaymentAccountNumber(payment)}
              </td>
              <td className="border border-[#6b7280] px-2">
                {formatTableDate(paymentDate)}
              </td>
              <td className="border border-[#6b7280] px-2 font-semibold">
                {referenceId}
              </td>
              <td className="border border-[#6b7280] px-2 text-right">
                {numberFormatter.format(paymentAmount)}
              </td>
            </tr>

            <tr className="h-11">
              <td className="border border-[#6b7280]" />
              <td className="border border-[#6b7280]" />
              <td className="border border-[#6b7280]" />
              <td className="border border-[#6b7280] px-3 text-right font-semibold">
                TOTAL:
              </td>
              <td className="border border-[#6b7280] px-2 text-right font-bold">
                {numberFormatter.format(paymentAmount)}
              </td>
            </tr>
          </tbody>
        </table>

        <p className="mt-4 text-justify text-[11.5px] leading-[1.6]">
          <span className="font-bold">{amountToWords(paymentAmount)}</span>{' '}
          <span className="font-bold">(Php {numberFormatter.format(paymentAmount)})</span>{' '}
          as payment for{' '}
          <span className="font-bold uppercase">{paymentPurpose}</span>{' '}
          for Unit ID: <span className="font-bold">{unitId}</span> in Project:{' '}
          <span className="font-bold uppercase">{projectName}</span> with the total
          lot area of <span className="font-bold">{areaWords} ({wholeNumberFormatter.format(lotArea)} SQM)</span>{' '}
          that is a portion of the property located at {projectLocation}, Lot No.{' '}
          {lotNumber}, with Tax Declaration No. {taxDeclaration} and PIN {pin},
          represented by <span className="font-semibold uppercase">{administrator}</span>,
          Attorney-in-Fact/Administrator.
        </p>

        <div className="mt-6 ml-auto w-[47%] text-center">
          <p>Broker:</p>
          <div className="mt-7 border-b border-[#4b5563] px-2 pb-1 font-bold uppercase">
            {broker.name}
          </div>
          <p className="mt-2">
            {broker.prcNo ? `PRC No. ${broker.prcNo}` : 'PRC No. __________________'}
          </p>

          <div className="mt-10 border-b border-[#4b5563] px-2 pb-1 font-bold uppercase">
            {witness}
          </div>
          <p className="mt-2">Witness</p>
        </div>

        <div className="mt-auto w-[43%] pb-[9mm]">
          <div className="border-b border-[#4b5563] px-2 pb-1 font-bold uppercase">
            {buyerName}
          </div>
          <p className="mt-2 text-center">Principal Buyer</p>

          <p className="mt-6">Unit ID: {unitId}</p>
          <p className="mt-5">{formatLongDate(paymentDate)}</p>
          <p className="mt-5">{projectLocation}</p>
        </div>
      </div>
    </section>
  )
}

const PaymentAcknowledgementReceiptsPrintPage = () => {
  const {
    project = {},
    listing = {},
    client = {},
    payments = [],
  } = readPrintPayload()

  const verifiedPayments = [...payments]
    .filter(
      (payment) =>
        String(payment?.status || 'Verified').toLowerCase() === 'verified'
    )
    .sort(
      (left, right) =>
        String(left.paymentDate || '').localeCompare(
          String(right.paymentDate || '')
        ) ||
        Number(left.paymentId || left.id || 0) -
          Number(right.paymentId || right.id || 0)
    )

  return (
    <PrintPageShell
      title={`Acknowledgement Receipts${verifiedPayments.length ? ` (${verifiedPayments.length})` : ''}`}
      printDisabled={!verifiedPayments.length}
      printDisabledMessage="No verified payments are available for acknowledgement receipts."
    >
      {verifiedPayments.length ? (
        <div className="mx-auto flex w-[210mm] flex-col bg-white print:w-[210mm]">
          {verifiedPayments.map((payment) => (
            <AcknowledgementReceiptPage
              key={payment.paymentId || payment.id || payment.referenceId}
              payment={payment}
              project={project}
              listing={listing}
              client={client}
            />
          ))}
        </div>
      ) : (
        <section className="print-page mx-auto flex h-[297mm] w-[210mm] items-center justify-center bg-white p-[20mm] text-center text-sm text-slate-600 shadow-lg print:shadow-none">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              No verified payments
            </h2>
            <p className="mt-2 font-semibold">
              Add and verify a payment before generating acknowledgement receipts.
            </p>
          </div>
        </section>
      )}
    </PrintPageShell>
  )
}

export default PaymentAcknowledgementReceiptsPrintPage
