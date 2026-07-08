import { FiPrinter, FiX } from 'react-icons/fi'

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const cleanMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,\s]/g, '')) || 0
}

const formatDate = (value) => {
  if (!value || value === '-') return '-'

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

const getValue = (source, keys, fallback = '-') => {
  for (const key of keys) {
    if (source?.[key] !== undefined && source?.[key] !== null && source?.[key] !== '') {
      return source[key]
    }
  }

  return fallback
}

const CheckBox = ({ label, checked = false }) => (
  <span className="mr-2 inline-flex items-center gap-1">
    <span className="text-[10px]">{checked ? '☑' : '☐'}</span>
    {label}
  </span>
)

const PrintHeaderCell = ({ children, className = '' }) => (
  <div className={`border border-black bg-[#d9d9d9] px-2 py-1 text-center text-[11px] font-black ${className}`}>
    {children}
  </div>
)

const PrintCell = ({ children, className = '' }) => (
  <div className={`border border-black px-2 py-1 text-[10px] leading-snug ${className}`}>
    {children}
  </div>
)

const getNormalizedSoaRows = (soaRows = []) => {
  if (!soaRows.length) return []

  return soaRows.map((row, index) => ({
    id: row.id || index + 1,
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

const OfferToBuyPreview = ({ listing = {}, client = {} }) => {
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const reservationFee = cleanMoney(getValue(listing, ['reservationFee'], 0))
  const downpayment = cleanMoney(getValue(listing, ['downpayment'], 0))
  const balance = cleanMoney(getValue(listing, ['balanceAmount', 'balance'], tcp - reservationFee - downpayment))
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization'], 0))

  const buyerType = getValue(client, ['buyerType'], 'single')
  const isSpouses = buyerType === 'spouses'
  const isAndAccount = buyerType === 'and_account'

  const buyerName = getValue(client, ['buyerName'], getValue(listing, ['buyer_name'], '-'))
  const secondBuyerName = getValue(client, ['secondBuyerName'], '')
  const seller = getValue(client, ['seller', 'salesOfficer'], getValue(listing, ['seller'], '-'))

  return (
    <div className="mx-auto w-[920px] bg-white text-black shadow-lg print:shadow-none">
      <div className="border border-black text-[10px]">
        <div className="p-2">
          <h1 className="text-[16px] font-black leading-none">
            Offer To Buy &amp; Buyer&apos;s Profile
          </h1>

          <p className="mt-1 font-black">
            Real Estate Sales — For Individual
          </p>

          <div className="mt-1 grid grid-cols-[1fr_180px_180px] gap-2">
            <p>
              Buyer Type{' '}
              <CheckBox label="Single" checked={buyerType === 'single'} />
              <CheckBox label="Spouses" checked={isSpouses} />
              <CheckBox label="and Account" checked={isAndAccount} />
            </p>

            <p>
              Sales Officer:{' '}
              <span className="font-black">{seller}</span>
            </p>

            <p>
              Date Received:{' '}
              <span className="font-black">
                {getValue(client, ['dateReceived'], new Date().toISOString().slice(0, 10))}
              </span>
            </p>
          </div>
        </div>

        <PrintHeaderCell>PROPERTY DESCRIPTION</PrintHeaderCell>

        <div className="grid grid-cols-[1fr]">
          <PrintCell>
            <span className="font-black">Location:</span>{' '}
            {getValue(listing, ['project_location', 'location'], '-')}
          </PrintCell>
        </div>

        <div className="grid grid-cols-4">
          <PrintCell>
            <span className="font-black">Property Type:</span>{' '}
            {getValue(listing, ['lot_type'], 'Inner')}
          </PrintCell>

          <PrintCell>
            <span className="font-black">Lot Area (sqm):</span>{' '}
            {getValue(listing, ['lotAreaSqm', 'lot_area_sqm'], 300)}
          </PrintCell>

          <PrintCell>
            <span className="font-black">Classification:</span>{' '}
            {getValue(listing, ['classification'], getValue(listing, ['lot_type'], 'Inner'))}
          </PrintCell>

          <PrintCell>
            <span className="font-black">Description/Improvements:</span>{' '}
            Unit {getValue(listing, ['unit_id', 'unitCode'], '-')}
          </PrintCell>
        </div>

        <PrintHeaderCell>OFFER TERMS AND CONDITIONS</PrintHeaderCell>

        <div className="border border-black py-1 text-center text-[10px] italic">
          I/We hereby offer to purchase the property described above under the following terms and conditions.
        </div>

        <div className="grid grid-cols-2">
          <div className="grid grid-cols-[230px_1fr]">
            <PrintCell className="col-span-2 font-black">
              <CheckBox label="CASH" />
            </PrintCell>

            {[
              ['Purchase Price:', ''],
              ['Reservation Fee:', ''],
              ['Balance:', ''],
              ['Deferred Cash:', ''],
            ].map(([label, value]) => (
              <>
                <PrintCell className="font-black">{label}</PrintCell>
                <PrintCell>{value}</PrintCell>
              </>
            ))}
          </div>

          <div className="grid grid-cols-[230px_1fr]">
            <PrintCell className="col-span-2 font-black">
              <CheckBox label="INSTALLMENT/In-house Financing" checked />
            </PrintCell>

            <PrintCell className="font-black">Purchase Price:</PrintCell>
            <PrintCell>{money(tcp)}</PrintCell>

            <PrintCell className="font-black">Reservation Fee:</PrintCell>
            <PrintCell>{money(reservationFee)}</PrintCell>

            <PrintCell className="font-black">Downpayment:</PrintCell>
            <PrintCell>{money(downpayment)}</PrintCell>

            <PrintCell className="font-black">Balance:</PrintCell>
            <PrintCell>{money(balance)}</PrintCell>

            <PrintCell className="font-black">Terms (months/years to pay):</PrintCell>
            <PrintCell>{getValue(listing, ['terms'], '36 months')}</PrintCell>

            <PrintCell className="font-black">Interest Rate:</PrintCell>
            <PrintCell>{getValue(listing, ['interestRate'], '0.00%')}</PrintCell>

            <PrintCell className="font-black">Monthly Amortization:</PrintCell>
            <PrintCell>{money(monthly)}</PrintCell>
          </div>
        </div>

        <PrintHeaderCell>INDIVIDUAL BUYER/S INFORMATION</PrintHeaderCell>

        <div className="grid grid-cols-2">
          <div>
            <div className="grid grid-cols-2">
              <PrintCell className="col-span-2">
                <span className="font-black">Principal Full-name:</span> {buyerName}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Date of Birth:</span>{' '}
                {getValue(client, ['birthDate'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Place of Birth:</span>{' '}
                {getValue(client, ['placeOfBirth'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Citizenship:</span>{' '}
                {getValue(client, ['citizenship'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Gender:</span>{' '}
                {getValue(client, ['gender'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Civil Status:</span>{' '}
                <CheckBox label="Single" checked={getValue(client, ['civilStatus'], '') === 'Single'} />
                <CheckBox label="Married" checked={getValue(client, ['civilStatus'], '') === 'Married'} />
                <CheckBox label="Separated" />
                <CheckBox label="Annulled/Divorced" />
                <CheckBox label="Widow/er" />
              </PrintCell>

              <PrintCell>
                <span className="font-black">Present Address:</span>{' '}
                {getValue(client, ['presentAddress'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Zip Code:</span>{' '}
                {getValue(client, ['presentZipCode'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Permanent Address:</span>{' '}
                {getValue(client, ['permanentAddress'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Mobile No.:</span>{' '}
                {getValue(client, ['contactNo'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Residence Phone Number:</span>{' '}
                {getValue(client, ['residencePhoneNumber'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">E-mail Add:</span>{' '}
                {getValue(client, ['email'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">TIN:</span>{' '}
                {getValue(client, ['tin'], '-')}
              </PrintCell>
            </div>
          </div>

          <div>
            <div className="grid grid-cols-2">
              <PrintCell className="col-span-2">
                <span className="font-black">Spouse/Second Buyer&apos;s Name:</span>{' '}
                {secondBuyerName || '-'}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Date of Birth:</span>{' '}
                {getValue(client, ['secondBuyerBirthDate'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Place of Birth:</span>{' '}
                {getValue(client, ['secondBuyerPlaceOfBirth'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Citizenship:</span>{' '}
                {getValue(client, ['secondBuyerCitizenship'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Gender:</span>{' '}
                {getValue(client, ['secondBuyerGender'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Civil Status:</span>{' '}
                <CheckBox label="Single" />
                <CheckBox label="Married" />
                <CheckBox label="Separated" />
                <CheckBox label="Annulled/Divorced" />
                <CheckBox label="Widow/er" />
              </PrintCell>

              <PrintCell>
                <span className="font-black">Present Address:</span>{' '}
                {getValue(client, ['secondBuyerPresentAddress'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Zip Code:</span>{' '}
                {getValue(client, ['secondBuyerPresentZipCode'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Permanent Address:</span>{' '}
                {getValue(client, ['secondBuyerPermanentAddress'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Mobile No.:</span>{' '}
                {getValue(client, ['secondBuyerContactNo'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Residence Phone Number:</span>{' '}
                {getValue(client, ['secondBuyerResidencePhoneNumber'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">E-mail Add:</span>{' '}
                {getValue(client, ['secondBuyerEmail'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">TIN:</span>{' '}
                {getValue(client, ['secondBuyerTin'], '-')}
              </PrintCell>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2">
          <div>
            <PrintHeaderCell>Work/Business Information</PrintHeaderCell>
            <PrintCell>
              <span className="font-black">Employment Status:</span>
              <br />
              <CheckBox label="Employed - Private" />
              <CheckBox label="Self-Employed (With Business)" />
              <br />
              <CheckBox label="Employed Government" />
              <CheckBox label="Self-Employed (Professional)" />
              <br />
              <CheckBox label="Employed - NGO" />
              <CheckBox label="OFW/immigrant" />
              <br />
              Other:
            </PrintCell>

            <PrintCell>
              <span className="font-black">Employer/Business Name:</span>{' '}
              {getValue(client, ['employerBusinessName'], '-')}
            </PrintCell>

            <div className="grid grid-cols-[1fr_115px]">
              <PrintCell>
                <span className="font-black">Employer/Business Address:</span>{' '}
                {getValue(client, ['employerBusinessAddress'], '-')}
              </PrintCell>
              <PrintCell>
                <span className="font-black">Zip Code:</span>{' '}
                {getValue(client, ['employerZipCode'], '-')}
              </PrintCell>
            </div>

            <PrintCell>
              <span className="font-black">Nature of Work/Business:</span>{' '}
              {getValue(client, ['natureOfWorkBusiness'], '-')}
            </PrintCell>

            <PrintCell>
              <span className="font-black">Occupation/Position/Title:</span>{' '}
              {getValue(client, ['occupationPositionTitle'], '-')}
            </PrintCell>
          </div>

          <div>
            <PrintHeaderCell>Work/Business Information</PrintHeaderCell>
            <PrintCell>
              <span className="font-black">Employment Status:</span>
              <br />
              <CheckBox label="Employed - Private" />
              <CheckBox label="Self-Employed (With Business)" />
              <br />
              <CheckBox label="Employed Government" />
              <CheckBox label="Self-Employed (Professional)" />
              <br />
              <CheckBox label="Employed - NGO" />
              <CheckBox label="OFW/immigrant" />
              <br />
              Other:
            </PrintCell>

            <PrintCell>
              <span className="font-black">Employer/Business Name:</span>{' '}
              {getValue(client, ['secondBuyerEmployerBusinessName'], '-')}
            </PrintCell>

            <div className="grid grid-cols-[1fr_115px]">
              <PrintCell>
                <span className="font-black">Employer/Business Address:</span>{' '}
                {getValue(client, ['secondBuyerEmployerBusinessAddress'], '-')}
              </PrintCell>
              <PrintCell>
                <span className="font-black">Zip Code:</span>{' '}
                {getValue(client, ['secondBuyerEmployerZipCode'], '-')}
              </PrintCell>
            </div>

            <PrintCell>
              <span className="font-black">Nature of Work/Business:</span>{' '}
              {getValue(client, ['secondBuyerNatureOfWorkBusiness'], '-')}
            </PrintCell>

            <PrintCell>
              <span className="font-black">Occupation/Position/Title:</span>{' '}
              {getValue(client, ['secondBuyerOccupationPositionTitle'], '-')}
            </PrintCell>
          </div>
        </div>

        <PrintHeaderCell>INCOME DETAILS (MONTHLY)</PrintHeaderCell>

        <div className="grid grid-cols-3">
          <PrintCell className="text-center">
            <span className="font-black">PRINCIPAL</span>
            <br />
            {money(getValue(client, ['monthlyIncome'], 0))}
          </PrintCell>

          <PrintCell className="text-center">
            <span className="font-black">SPOUSE/SECOND BUYER</span>
            <br />
            {money(getValue(client, ['secondBuyerMonthlyIncome'], 0))}
          </PrintCell>

          <PrintCell className="text-center">
            <span className="font-black">TOTAL</span>
            <br />
            {money(
              cleanMoney(getValue(client, ['monthlyIncome'], 0)) +
                cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))
            )}
          </PrintCell>
        </div>

        <div className="bg-[#1f4e79] py-2 text-center text-[11px] font-black text-white">
          SIGNATURES of BUYER/S
        </div>

        <div className="grid grid-cols-2">
          <PrintCell className="h-48 pt-36 text-center font-black">
            Signature over Printed Name of Principal Buyer
          </PrintCell>
          <PrintCell className="h-48 pt-36 text-center font-black">
            Signature over Printed Name of Spouse/Second Buyer
          </PrintCell>
        </div>

        <PrintHeaderCell>SALES AGENT:</PrintHeaderCell>

        <div className="grid grid-cols-[230px_230px_1fr]">
          <PrintCell>
            <span className="font-black">Name:</span> {seller}
          </PrintCell>
          <PrintCell>
            <span className="font-black">TIN No.:</span>
          </PrintCell>
          <PrintCell>
            <span className="font-black">Address:</span>
          </PrintCell>
        </div>
      </div>
    </div>
  )
}

const SOAPreview = ({ listing = {}, client = {}, soaRows = [] }) => {
  const rows = getNormalizedSoaRows(soaRows, listing)
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const legalMisc = cleanMoney(getValue(listing, ['lmfAmount', 'legalMiscAmount'], 0))
  const totalAmount = tcp
  const latestBalance = cleanMoney(rows[rows.length - 1]?.remainingBalance || 0)

  return (
    <div className="mx-auto w-[920px] bg-white p-5 text-black shadow-lg print:shadow-none">
      <div className="border-2 border-black p-4">
        <div className="grid grid-cols-[1fr_345px] gap-5">
          <div>
            <h1 className="text-lg font-black tracking-wide">D&amp;C PRIME REALTY</h1>
            <p className="mt-1 text-[10px] font-semibold leading-tight">
              Magsaysay St., Indang, Cavite.
            </p>
            <p className="text-[10px] font-semibold leading-tight">
              4122 Philippines
            </p>
            <p className="text-[10px] font-semibold leading-tight">
              (046) 866-0616
            </p>
          </div>

          <div className="border-2 border-black">
            <h2 className="border-b-2 border-black py-1 text-center text-lg font-black">
              STATEMENT OF ACCOUNT
            </h2>

            {[
              ['Statement Date:', getValue(listing, ['statementDate'], new Date().toISOString().slice(0, 10))],
              ['Property Address:', getValue(listing, ['project_location', 'location'], '-')],
              ['Buyer’s Name:', getValue(client, ['buyerName'], getValue(listing, ['buyer_name'], '-'))],
              ['Unit No:', getValue(listing, ['unit_id', 'unitCode'], '-')],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[115px_1fr] border-b border-black text-[10px]">
                <div className="border-r border-black px-1.5 py-0.5 font-black">{label}</div>
                <div className="px-1.5 py-0.5 font-bold">{value}</div>
              </div>
            ))}

            <h3 className="border-b-2 border-black py-1 text-center text-base font-black">
              AMOUNT DETAILS
            </h3>

            {[
              ['Total Contract Price:', money(tcp)],
              ['Legal Miscellaneous (included):', money(legalMisc)],
              ['Total Amount:', money(totalAmount)],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[170px_1fr] border-b border-black text-[10px] last:border-b-0">
                <div className="border-r border-black px-1.5 py-0.5 font-black">{label}</div>
                <div className="px-1.5 py-0.5 text-right font-black">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-28">
          <table className="w-full border-collapse text-[9px]">
            <thead>
              <tr>
                {[
                  'Due Date',
                  'Description',
                  'Due Amount',
                  'Penalty',
                  'Date Paid',
                  'Amount Paid',
                  'Reference',
                  'Remaining Balance',
                ].map((head) => (
                  <th
                    key={head}
                    className="border-2 border-black px-2 py-2 text-center font-black"
                  >
                    {head}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-black px-2 py-1 text-center font-bold">
                    {formatDate(row.dueDate)}
                  </td>

                  <td className="border border-black px-2 py-1 font-bold">
                    {row.description}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-black">
                    {money(row.dueAmount)}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-bold">
                    {Number(row.penalty || 0) > 0 ? money(row.penalty) : '0.00'}
                  </td>

                  <td className="border border-black px-2 py-1 text-center font-bold">
                    {formatDate(row.datePaid)}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-bold">
                    {Number(row.amountPaid || 0) > 0 ? money(row.amountPaid) : ''}
                  </td>

                  <td className="border border-black px-2 py-1 text-center font-bold">
                    {row.referenceId || '-'}
                  </td>

                  <td className="border border-black px-2 py-1 text-right font-black">
                    {money(row.remainingBalance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 flex justify-end">
          <div className="grid grid-cols-[300px_150px] text-[12px]">
            <p className="px-2 text-right font-semibold">
              Total amount to fully pay as of statement date
            </p>
            <p className="px-2 text-right font-black">{money(latestBalance)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

const isPrintableDocumentUrl = (url = '') => {
  const clean = String(url || '').trim()
  if (!clean) return false
  if (clean.startsWith('/mock-documents/')) return false
  return clean.startsWith('data:image/') || clean.startsWith('http://') || clean.startsWith('https://')
}

const DocumentsPrintPreview = ({ documents = [] }) => {
  const printableDocuments = documents.flatMap((document) => {
    const urls = document.images?.length ? document.images : [document.fileUrl || document.file_url]
    return urls
      .filter(isPrintableDocumentUrl)
      .map((url) => ({ url, name: document.name || document.document_name || document.fileName || 'Uploaded Document' }))
  })

  return (
    <div className="mx-auto w-[850px] bg-white p-6 shadow-lg print:shadow-none">
      {printableDocuments.length ? (
        <div className="flex flex-col gap-6">
          {printableDocuments.map((document, index) => (
            <div
              key={`${document.url}-${index}`}
              className="flex min-h-[980px] flex-col items-center justify-center border border-slate-300 bg-white p-4 print:min-h-screen print:border-0"
            >
              <p className="mb-3 text-center text-xs font-black text-slate-700 print:hidden">{document.name}</p>
              <img
                src={document.url}
                alt={document.name || `Document ${index + 1}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[720px] items-center justify-center border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <div>
            <p className="text-lg font-black text-slate-800">No printable uploaded documents</p>
            <p className="mt-2 text-sm font-semibold text-slate-500">Upload image documents first. Mock document paths are intentionally ignored.</p>
          </div>
        </div>
      )}
    </div>
  )
}

const PrintPreviewModal = ({
  title,
  type,
  listing = {},
  client = {},
  soaRows = [],
  documents = [],
  onClose,
}) => {
  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b px-6 py-4 print:hidden">
          <div>
            <h2 className="text-xl font-black text-slate-950">{title}</h2>
            <p className="text-sm font-semibold text-slate-500">
              Actual print preview
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 w-10 rounded-2xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"
          >
            <FiX className="mx-auto" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-100 p-6 print:bg-white print:p-0">
          {type === 'offer' ? (
            <OfferToBuyPreview listing={listing} client={client} />
          ) : null}

          {type === 'soa' ? (
            <SOAPreview listing={listing} client={client} soaRows={soaRows} />
          ) : null}

          {type === 'documents' ? (
            <DocumentsPrintPreview documents={documents} />
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t px-6 py-4 print:hidden">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-2xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700"
          >
            <FiPrinter />
            Print
          </button>
        </div>
      </div>
    </div>
  )
}

export default PrintPreviewModal
