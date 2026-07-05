import PrintPageShell from './PrintPageShell'
import {
  cleanMoney,
  formatDate,
  formatLongDate,
  getNormalizedSoaRows,
  getValue,
  money,
  readPrintPayload,
} from './printUtils'

const BoxRow = ({ label, value }) => (
  <div className="grid grid-cols-[145px_1fr] border-b border-black text-[10px] last:border-b-0">
    <div className="border-r border-black px-1 py-0.5 font-black">{label}</div>
    <div className="px-1 py-0.5 text-right font-semibold">{value || '-'}</div>
  </div>
)

const SOAPrintPage = () => {
  const { listing = {}, client = {}, soaRows = [] } = readPrintPayload()

  const rows = getNormalizedSoaRows(soaRows, listing)
  const netSellingPrice = cleanMoney(getValue(listing, ['netSellingPrice', 'net_selling_price', 'lot_project_listing_net_selling_price'], 0))
  const legalMisc = cleanMoney(getValue(listing, ['lmfAmount', 'legalMiscAmount', 'legal_misc_amount', 'lot_project_listing_lmf_amount'], 0))
  const tcp = cleanMoney(getValue(listing, ['tcp', 'tcpAmount', 'lot_project_listing_tcp'], netSellingPrice + legalMisc))
  const latestBalance = cleanMoney(rows[rows.length - 1]?.remainingBalance || tcp)
  const buyerName = getValue(client, ['buyerName', 'buyer_full_name'], getValue(listing, ['buyer_name'], '-'))
  const unitId = getValue(listing, ['unit_id', 'unitCode', 'lot_project_listing_unit_id'], '-')
  const area = getValue(listing, ['area', 'lotAreaSqm', 'lot_area_sqm', 'lot_project_listing_area_sqm'], '-')
  const pricePerSqm = getValue(listing, ['pricePerSqm', 'price_per_sqm', 'lot_project_listing_price_per_sqm'], 0)
  const statementDate = getValue(listing, ['statementDate', 'statement_date'], new Date().toISOString())

  return (
    <PrintPageShell title="Statement of Account">
      <div className="mx-auto w-[960px] bg-white p-4 text-black shadow-lg print:w-full print:p-3 print:shadow-none">
        <div className="text-[10px] leading-tight">
          <div className="grid grid-cols-[1fr_420px] gap-8">
            <div className="pt-2">
              <h1 className="text-[14px] font-black">D&amp;C PRIME REALTY</h1>
              <div className="mt-4 space-y-0.5 text-[10px] leading-tight">
                <p>{getValue(listing, ['project_name', 'lot_project_name'], '')}</p>
                <p>{getValue(listing, ['project_location', 'location'], '')}</p>
                <p>(046) 866-0616</p>
              </div>

              <div className="mt-14 text-[10px]">
                <p>TOTAL AREA: {area} sqm</p>
                <p>PRICE PER SQM: {money(pricePerSqm)} per sqm</p>
              </div>
            </div>

            <div>
              <div className="border-2 border-black">
                <div className="border-b-2 border-black py-2 text-center text-[13px] font-black tracking-[0.15em]">STATEMENT OF ACCOUNT</div>
                <BoxRow label="Statement Date" value={formatLongDate(statementDate)} />
                <BoxRow label="Property Address" value={getValue(listing, ['project_location', 'location'], '-')} />
                <BoxRow label="Buyer's Name" value={buyerName} />
                <BoxRow label="Unit No." value={unitId} />
              </div>

              <div className="mt-5 border-2 border-black">
                <div className="border-b-2 border-black py-2 text-center text-[13px] font-black tracking-[0.08em]">AMOUNT DETAILS</div>
                <BoxRow label="Net Selling Price" value={money(netSellingPrice)} />
                <BoxRow label="Legal Miscellaneous" value={money(legalMisc)} />
                <BoxRow label="Total Contract Price" value={money(tcp)} />
              </div>
            </div>
          </div>

          <table className="mt-12 w-full border-collapse text-[10px]">
            <thead>
              <tr>
                {['Due Date', 'Description', 'Due Amount', 'Date Paid', 'Amount Paid', 'Reference', 'Running Balance'].map((head) => (
                  <th key={head} className="border-2 border-black px-2 py-3 text-center font-black">
                    {head}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="border border-black px-2 py-2 text-center font-semibold">{formatDate(row.dueDate)}</td>
                  <td className="border border-black px-2 py-2 text-center font-semibold uppercase">{row.description}</td>
                  <td className="border border-black px-2 py-2 text-right font-black">{Number(row.dueAmount || 0) > 0 ? money(row.dueAmount) : ''}</td>
                  <td className="border border-black px-2 py-2 text-center font-semibold">{row.datePaid && row.datePaid !== '-' ? formatDate(row.datePaid) : ''}</td>
                  <td className="border border-black px-2 py-2 text-right font-black">{Number(row.amountPaid || 0) > 0 ? money(row.amountPaid) : ''}</td>
                  <td className="border border-black px-2 py-2 text-center font-semibold">{row.referenceId && row.referenceId !== '-' ? row.referenceId : ''}</td>
                  <td className="border border-black px-2 py-2 text-right font-black">{money(row.remainingBalance)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-8 grid grid-cols-[1fr_420px] gap-8">
            <div />
            <div className="grid grid-cols-[1fr_150px] text-[10px]">
              <p className="px-2 text-right font-semibold">Total amount to fully pay as of statement date</p>
              <p className="px-2 text-right font-black">{money(latestBalance)}</p>
            </div>
          </div>

          <div className="mt-10 grid grid-cols-2 gap-20 text-[10px]">
            <div>
              <div className="grid grid-cols-[95px_1fr] gap-2">
                <p>Prepared by:</p>
                <p className="font-semibold">{getValue(listing, ['preparedBy'], 'KIRSTEN JHOYCE A. RIOJA')}</p>
                <p />
                <p className="mt-2 text-center">Administration Head</p>
                <p className="mt-4">Date:</p>
                <p className="mt-4">{formatDate(new Date().toISOString())}</p>
              </div>
            </div>

            <div>
              <div className="grid grid-cols-[125px_1fr] gap-2">
                <p>Acknowledged by:</p>
                <div>
                  <div className="h-5 border-b border-black" />
                  <p className="mt-1 text-center">Client Name and Signature</p>
                </div>
                <p className="mt-4">Date:</p>
                <p className="mt-4" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </PrintPageShell>
  )
}

export default SOAPrintPage
