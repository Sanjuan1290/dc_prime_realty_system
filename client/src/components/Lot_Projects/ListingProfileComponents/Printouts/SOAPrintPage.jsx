import PrintPageShell from './PrintPageShell'
import {
  cleanMoney,
  formatDate,
  getNormalizedSoaRows,
  getValue,
  money,
  readPrintPayload,
} from './printUtils'

const SOAInfoRow = ({ label, value }) => (
  <div className="grid grid-cols-[115px_1fr] border-b border-black text-[10px]">
    <div className="border-r border-black px-1.5 py-0.5 font-black">{label}</div>
    <div className="px-1.5 py-0.5 font-bold">{value}</div>
  </div>
)

const AmountRow = ({ label, value }) => (
  <div className="grid grid-cols-[170px_1fr] border-b border-black text-[10px] last:border-b-0">
    <div className="border-r border-black px-1.5 py-0.5 font-black">{label}</div>
    <div className="px-1.5 py-0.5 text-right font-black">{value}</div>
  </div>
)

const SOAPrintPage = () => {
  const { listing = {}, client = {}, soaRows = [] } = readPrintPayload()

  const rows = getNormalizedSoaRows(soaRows)
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const legalMisc = cleanMoney(getValue(listing, ['lmfAmount', 'legalMiscAmount'], 0))
  const totalAmount = tcp
  const latestBalance = cleanMoney(rows[rows.length - 1]?.remainingBalance || 0)

  return (
    <PrintPageShell title="Statement of Account">
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

              <SOAInfoRow
                label="Statement Date:"
                value={getValue(listing, ['statementDate'], new Date().toISOString().slice(0, 10))}
              />
              <SOAInfoRow
                label="Property Address:"
                value={getValue(listing, ['project_location', 'location'], '-')}
              />
              <SOAInfoRow
                label="Buyer’s Name:"
                value={getValue(client, ['buyerName'], getValue(listing, ['buyer_name'], '-'))}
              />
              <SOAInfoRow
                label="Unit No:"
                value={getValue(listing, ['unit_id', 'unitCode'], '-')}
              />

              <h3 className="border-b-2 border-black py-1 text-center text-base font-black">
                AMOUNT DETAILS
              </h3>

              <AmountRow label="Total Contract Price:" value={money(tcp)} />
              <AmountRow label="Legal Miscellaneous (included):" value={money(legalMisc)} />
              <AmountRow label="Total Amount:" value={money(totalAmount)} />
            </div>
          </div>

          <div className="mt-28">
            <table className="w-full border-collapse text-[9px]">
              <thead>
                <tr>
                  {[
                    'Due Date',
                    'Description',
                    'Monthly Due',
                    'Penalty',
                    'Date Paid',
                    'Amount Paid',
                    'Reference',
                    'Running Balance',
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
                {rows.length ? rows.map((row) => (
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
                )) : (
                  <tr>
                    <td colSpan={8} className="border border-black px-2 py-8 text-center font-bold">
                      No statement of account rows available yet. Reserve the unit first.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-8 flex justify-end">
            <div className="grid grid-cols-[300px_150px] text-[12px]">
              <p className="px-2 text-right font-semibold">
                Remaining principal balance as of statement date
              </p>
              <p className="px-2 text-right font-black">{money(latestBalance)}</p>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-20 text-[11px] font-semibold">
            <div>
              <div className="grid grid-cols-[90px_1fr] items-end gap-3">
                <p>Prepared by:</p>
                <div className="border-b border-black">&nbsp;</div>
              </div>
              <p className="mt-3 text-center">Administration Head</p>
            </div>

            <div>
              <div className="grid grid-cols-[115px_1fr] items-end gap-3">
                <p>Acknowledged by:</p>
                <div className="border-b border-black">&nbsp;</div>
              </div>
              <p className="mt-3 text-center">Client Name and Signature</p>
            </div>
          </div>
        </div>
      </div>
    </PrintPageShell>
  )
}

export default SOAPrintPage

