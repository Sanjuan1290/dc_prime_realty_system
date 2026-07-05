import PrintPageShell from './PrintPageShell'
import {
  cleanMoney,
  formatDate,
  getNormalizedSoaRows,
  getValue,
  moneyNoSymbol,
  numberToWords,
  readPrintPayload,
} from './printUtils'

const AcknowledgementReceiptPrintPage = () => {
  const { listing = {}, client = {}, soaRows = [], payments = [] } = readPrintPayload()

  const paidRows = getNormalizedSoaRows(soaRows, listing).filter((row) => Number(row.amountPaid || 0) > 0)
  const latestPayment = payments?.length
    ? payments[payments.length - 1]
    : paidRows[paidRows.length - 1]

  const amount = cleanMoney(
    latestPayment?.amount ||
      latestPayment?.amountPaid ||
      latestPayment?.amount_paid ||
      latestPayment?.lot_project_payment_amount ||
      latestPayment?.dueAmount ||
      0
  )

  const buyerName = getValue(client, ['buyerName', 'buyer_full_name'], getValue(listing, ['buyer_name'], '-'))
  const unitId = getValue(listing, ['unit_id', 'unitCode', 'lot_project_listing_unit_id'], '-')
  const area = getValue(listing, ['area', 'lotAreaSqm', 'lot_project_listing_area_sqm'], '-')
  const projectName = getValue(listing, ['project_name', 'lot_project_name'], getValue(listing, ['project'], '-'))
  const location = getValue(listing, ['project_location', 'location'], '-')
  const lotNo = getValue(listing, ['lot_no', 'lotNumber', 'cadastralLots'], '-')
  const taxDeclaration = getValue(listing, ['tax_declaration_no', 'lot_project_tax_declaration_no'], '')
  const pin = getValue(listing, ['pin', 'lot_project_pin'], '')
  const broker = getValue(listing, ['brokerName', 'broker_name'], getValue(client, ['seller', 'salesOfficer'], '-'))
  const witness = getValue(listing, ['witnessName'], 'KIRSTEN JHOYCE A. RIOJA')
  const reference = getValue(latestPayment, ['referenceId', 'reference_id', 'reference', 'lot_project_payment_reference_id'], '-')
  const paymentDate = getValue(latestPayment, ['datePaid', 'date_paid', 'payment_date', 'lot_project_payment_date'], new Date().toISOString())
  const bank = getValue(latestPayment, ['bank', 'payment_bank', 'bank_name'], getValue(latestPayment, ['method', 'payment_method'], ''))
  const accountNo = getValue(latestPayment, ['accountNo', 'account_no', 'payment_account_no'], '')
  const paymentDescription = getValue(latestPayment, ['description', 'payment_type', 'type'], 'payment')

  return (
    <PrintPageShell title="Acknowledgement Receipt">
      <div className="mx-auto w-[794px] bg-white px-10 py-16 text-black shadow-lg print:w-full print:px-10 print:py-12 print:shadow-none">
        <div className="min-h-[980px] text-[12px] leading-relaxed">
          <h1 className="mt-10 text-center text-[13px] font-black tracking-wide">ACKNOWLEDGEMENT RECEIPT</h1>

          <p className="mt-14 text-center">
            This is to acknowledge receiving from <span className="font-black uppercase">{buyerName}</span> the amount of:
          </p>

          <table className="mx-auto mt-5 w-[640px] border-collapse text-[11px]">
            <thead>
              <tr>
                {['BANK', 'ACCOUNT NO.', 'DATE', 'REFERENCE NUMBER', 'AMOUNT'].map((head) => (
                  <th key={head} className="border border-slate-700 bg-slate-50 px-3 py-4 text-center font-black">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-slate-700 px-3 py-4 text-center font-semibold">{bank || '-'}</td>
                <td className="border border-slate-700 px-3 py-4 text-center font-semibold">{accountNo || '-'}</td>
                <td className="border border-slate-700 px-3 py-4 text-center font-semibold">{formatDate(paymentDate)}</td>
                <td className="border border-slate-700 px-3 py-4 text-center font-semibold">{reference}</td>
                <td className="border border-slate-700 px-3 py-4 text-right font-semibold">{moneyNoSymbol(amount)}</td>
              </tr>
              <tr>
                <td className="border border-slate-700 px-3 py-4" />
                <td className="border border-slate-700 px-3 py-4" />
                <td className="border border-slate-700 px-3 py-4" />
                <td className="border border-slate-700 px-3 py-4 text-center font-black">TOTAL:</td>
                <td className="border border-slate-700 px-3 py-4 text-right font-black">{moneyNoSymbol(amount)}</td>
              </tr>
            </tbody>
          </table>

          <p className="mx-auto mt-5 w-[640px] text-justify font-semibold uppercase tracking-wide">
            {numberToWords(amount)} PESOS (Php {moneyNoSymbol(amount)}) as {String(paymentDescription).toUpperCase()} for the Unit ID: {unitId} in Project: {String(projectName).toUpperCase()} with the total lot area of {String(area).toUpperCase()} sqm that is a portion of the property that is located in {location}, Lot No. {lotNo} with Tax Declaration No. {taxDeclaration} with PIN {pin} represented by {getValue(listing, ['administratorName', 'lot_project_administrator_name'], 'ERLINDA B. CAUSAPIN')}, Attorney-in-Fact/Administrator.
          </p>

          <div className="mx-auto mt-8 w-[340px] text-center">
            <p>Broker:</p>
            <p className="mt-5 font-black uppercase tracking-wide">{broker}</p>
            <p className="mt-4">PRC No. {getValue(listing, ['brokerPrcNo', 'broker_prc_no'], '')}</p>
          </div>

          <div className="mx-auto mt-16 w-[260px] text-center">
            <p className="font-black uppercase tracking-wide">{witness}</p>
            <p className="mt-3">Witness</p>
          </div>

          <div className="mt-12 grid grid-cols-[220px_1fr] gap-16">
            <div className="text-center">
              <p className="font-black uppercase tracking-wide">{buyerName}</p>
              <p className="mt-4">Principal Buyer</p>
              <p className="mt-7 text-left">Unit ID: {unitId}</p>
              <p className="mt-5 text-left">{formatDate(new Date().toISOString())}</p>
              <p className="mt-5 text-left">Indang, Cavite</p>
            </div>
            <div />
          </div>
        </div>
      </div>
    </PrintPageShell>
  )
}

export default AcknowledgementReceiptPrintPage
