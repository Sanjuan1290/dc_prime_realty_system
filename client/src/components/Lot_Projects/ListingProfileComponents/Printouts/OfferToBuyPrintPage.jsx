import PrintPageShell from './PrintPageShell'
import { cleanMoney, formatDate, getNormalizedSoaRows, getValue, money, readPrintPayload } from './printUtils'

const blank = (value) => {
  if (value === undefined || value === null || value === '-') return ''
  return String(value)
}

const valueFrom = (source, keys, fallback = '') => blank(getValue(source, keys, fallback))
const moneyBlank = (value) => (Number(value || 0) > 0 ? money(value) : '')

const getRowAmount = (rows, keyword) => rows
  .filter((row) => String(row.description || '').toLowerCase().includes(keyword))
  .reduce((sum, row) => sum + cleanMoney(row.dueAmount), 0)

const getMonthlyAmount = (rows) => {
  const row = rows.find((item) => String(item.description || '').toLowerCase().includes('monthly'))
  return cleanMoney(row?.dueAmount || 0)
}

const isChecked = (value, target) => String(value || '').toLowerCase().includes(target.toLowerCase())

const Box = ({ checked = false }) => (
  <span className="otb-box" aria-hidden="true">{checked ? '✓' : ''}</span>
)

const SmallCheck = ({ checked = false, label }) => (
  <span className="otb-check"><Box checked={checked} /> {label}</span>
)

const Field = ({ label, value }) => (
  <span><strong>{label}</strong>{value ? ` ${value}` : ''}</span>
)

const buyerField = (client, key) => valueFrom(client, [key], '')
const secondBuyerField = (client, suffix) => valueFrom(client, [`secondBuyer${suffix}`], '')

const civilChecks = (value) => {
  const civil = String(value || '').toLowerCase()
  return (
    <div className="otb-check-grid">
      <SmallCheck label="Single/Married" checked={civil === 'single' || civil === 'married'} />
      <SmallCheck label="Separated" checked={civil.includes('separated')} />
      <SmallCheck label="Annulled/Divorced" checked={civil.includes('annulled') || civil.includes('divorced')} />
      <SmallCheck label="Widow/er" checked={civil.includes('widow')} />
    </div>
  )
}

const employmentChecks = (value) => {
  const status = String(value || '').toLowerCase()
  return (
    <div className="otb-check-grid employment">
      <SmallCheck label="Employed - Private" checked={status.includes('private')} />
      <SmallCheck label="Self-Employed (With Business)" checked={status.includes('business')} />
      <SmallCheck label="Employed Government" checked={status.includes('government')} />
      <SmallCheck label="Self-Employed (Professional)" checked={status.includes('professional')} />
      <SmallCheck label="Employed - NGO" checked={status.includes('ngo')} />
      <SmallCheck label="OFW/immigrant" checked={status.includes('ofw') || status.includes('immigrant')} />
    </div>
  )
}

const BuyerColumn = ({ title, name, client, second = false }) => {
  const get = (key) => second ? secondBuyerField(client, key) : buyerField(client, key.charAt(0).toLowerCase() + key.slice(1))
  const civil = second ? secondBuyerField(client, 'CivilStatus') : buyerField(client, 'civilStatus')
  const lastName = second ? secondBuyerField(client, 'LastName') : buyerField(client, 'buyerLastName')
  const firstName = second ? secondBuyerField(client, 'FirstName') : buyerField(client, 'buyerFirstName')
  const middleName = second ? secondBuyerField(client, 'MiddleName') : buyerField(client, 'buyerMiddleName')
  const suffix = second ? secondBuyerField(client, 'Suffix') : buyerField(client, 'buyerSuffix')
  const hasSplitName = Boolean(lastName || firstName || middleName || suffix)

  return (
    <td colSpan="6" className="otb-nested-cell">
      <table className="otb-inner-table">
        <tbody>
          <tr><td colSpan="4" className="otb-field-line strong">{title}</td></tr>
          <tr>
            <td><Field label="Last Name:" value={lastName} /></td>
            <td><Field label="First Name:" value={firstName} /></td>
            <td><Field label="Middle Name:" value={middleName} /></td>
            <td><Field label="Suffix:" value={suffix} /></td>
          </tr>
          {!hasSplitName && name ? <tr><td colSpan="4"><Field label="Existing Full Name:" value={name} /></td></tr> : null}
          <tr>
            <td colSpan="2"><Field label="Date of Birth:" value={formatDate(get('BirthDate'))} /></td>
            <td colSpan="2"><Field label="Place of Birth:" value={get('PlaceOfBirth')} /></td>
          </tr>
          <tr>
            <td colSpan="2"><Field label="Citizenship:" value={get('Citizenship')} /></td>
            <td colSpan="2"><Field label="Gender:" value={get('Gender')} /></td>
          </tr>
          <tr><td colSpan="4" className="otb-civil"><strong>Civil Status</strong>{civilChecks(civil)}</td></tr>
          <tr>
            <td colSpan="3"><Field label="Present Address:" value={get('PresentAddress')} /></td>
            <td><Field label="Zip Code" value={get('PresentZipCode')} /></td>
          </tr>
          <tr><td colSpan="4"><Field label="Permanent Address:" value={get('PermanentAddress')} /></td></tr>
          <tr><td colSpan="4"><Field label="Mobile No.:" value={get('ContactNo')} /></td></tr>
          <tr><td colSpan="4"><Field label="Residence Phone Number:" value={get('ResidencePhoneNumber')} /></td></tr>
          <tr><td colSpan="4"><Field label="E-mail Add:" value={get('Email')} /></td></tr>
          <tr><td colSpan="4"><Field label="TIN:" value={get('Tin')} /></td></tr>
        </tbody>
      </table>
    </td>
  )
}

const WorkColumn = ({ client, second = false }) => {
  const get = (key) => second ? secondBuyerField(client, key) : buyerField(client, key.charAt(0).toLowerCase() + key.slice(1))

  return (
    <td colSpan="6" className="otb-nested-cell">
      <table className="otb-inner-table">
        <tbody>
          <tr><th className="otb-subhead" colSpan="4">Work/Business Information</th></tr>
          <tr>
            <td colSpan="4" className="otb-employment">
              <strong>Employment Status: (Please check)</strong>
              {employmentChecks(get('EmploymentStatus'))}
              <div><strong>Other:</strong> {get('EmploymentStatus')}</div>
            </td>
          </tr>
          <tr><td colSpan="4"><Field label="Employer/Business Name:" value={get('EmployerBusinessName')} /></td></tr>
          <tr>
            <td colSpan="3"><Field label="Employer/Business Address:" value={get('EmployerBusinessAddress')} /></td>
            <td><Field label="Zip Code:" value={get('EmployerZipCode')} /></td>
          </tr>
          <tr><td colSpan="4"><Field label="Nature of Work/Business:" value={get('NatureOfWorkBusiness')} /></td></tr>
          <tr><td colSpan="4"><Field label="Occupation/Position/Title:" value={get('OccupationPositionTitle')} /></td></tr>
        </tbody>
      </table>
    </td>
  )
}

const OfferToBuyPrintPage = () => {
  const { listing = {}, client = {}, soaRows = [] } = readPrintPayload()
  const rows = getNormalizedSoaRows(soaRows)

  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const reservationFee = getRowAmount(rows, 'reservation') || cleanMoney(getValue(listing, ['reservationFee'], 0))
  const downpayment = getRowAmount(rows, 'downpayment') || cleanMoney(getValue(listing, ['downpayment'], 0))
  const balance = cleanMoney(getValue(listing, ['balanceAmount', 'balance'], Math.max(tcp - reservationFee - downpayment, 0)))
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization'], getMonthlyAmount(rows)))

  const buyerType = valueFrom(client, ['buyerType'], 'single')
  const modeOfPayment = valueFrom(listing, ['soaModeOfPayment', 'modeOfPayment'], 'installment').toLowerCase()
  const isCash = modeOfPayment === 'cash'
  const isInstallment = !isCash
  const monthlyTerms = isInstallment
    ? Number(getValue(listing, ['soaMonthlyTerms', 'monthlyTerms'], 0)) || rows.filter((row) => String(row.description || '').toLowerCase().includes('monthly')).length || 36
    : 0
  const buyerName = valueFrom(client, ['buyerName'], valueFrom(listing, ['buyer_name'], ''))
  const secondBuyerName = valueFrom(client, ['secondBuyerName'], '')
  const seller = valueFrom(listing, ['mainSeller', 'seller'], valueFrom(client, ['seller', 'salesOfficer'], ''))
  const sellerTinNo = valueFrom(listing, ['sellerTinNo', 'seller_tin_no'], '')
  const sellerLastName = valueFrom(listing, ['sellerLastName', 'seller_last_name'], '')
  const sellerFirstName = valueFrom(listing, ['sellerFirstName', 'seller_first_name'], '')
  const sellerMiddleName = valueFrom(listing, ['sellerMiddleName', 'seller_middle_name'], '')
  const sellerAddress = valueFrom(listing, ['sellerAddress', 'seller_address'], '')
  const dateReceived = formatDate(valueFrom(client, ['dateReceived'], valueFrom(listing, ['client_unit_created'], new Date().toISOString())))
  const monthlyIncome = cleanMoney(getValue(client, ['monthlyIncome'], 0))
  const secondMonthlyIncome = cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))
  const totalIncome = monthlyIncome + secondMonthlyIncome

  return (
    <PrintPageShell title="Offer To Buy & Buyer&apos;s Profile">
      <section className="print-page otb-page mx-auto bg-white text-black shadow-lg print:shadow-none ">
        <style>{`
          .otb-page {
            width: 210mm;
            min-height: 297mm;
            padding: 8mm 9mm;
            font-family: Arial, Helvetica, sans-serif;
          }

          .otb-form {
            width: 100%;
            min-height: fit;
            border: 1.4px solid #4b5563;
            font-size: 8.7px;
            line-height: 1.08;
            color: #111827;
            background: #ffffff;
          }

          .otb-form table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          .otb-form td,
          .otb-form th {
            border: 1px solid #7b7f86;
            padding: 2.2px 4px;
            vertical-align: top;
          }

          .otb-title-cell {
            border-left: 0 !important;
            border-right: 0 !important;
            border-top: 0 !important;
            padding: 5px 7px 4px !important;
          }

          .otb-title {
            margin: 0;
            font-size: 13px;
            font-weight: 800;
            line-height: 1;
          }

          .otb-subtitle {
            margin-top: 1px;
            font-size: 11px;
            font-weight: 700;
          }

          .otb-header-grid {
            display: grid;
            grid-template-columns: 1fr 210px 150px;
            align-items: center;
            gap: 7px;
            margin-top: 2px;
          }

          .otb-sales-box {
            display: grid;
            grid-template-columns: 72px 1fr;
            align-items: center;
            gap: 2px;
          }

          .otb-line-box {
            min-height: 15px;
            border: 1px solid #7b7f86;
            padding: 1px 4px;
            font-weight: 700;
          }

          .otb-section {
            background: #d9d9d9;
            text-align: center;
            font-weight: 800;
            text-transform: uppercase;
            letter-spacing: .2px;
          }

          .otb-main-section {
            font-size: 17px;
            letter-spacing: .7px;
            padding: 3px 4px !important;
          }

          .otb-subhead {
            background: #d9d9d9;
            text-align: center;
            font-weight: 800;
          }

          .otb-location {
            height: 24px;
            font-size: 14px;
            padding-top: 6px !important;
          }

          .otb-note {
            text-align: center;
            font-size: 8px;
            font-style: italic;
            height: 13px;
            padding: 2px !important;
          }

          .otb-box {
            display: inline-flex;
            width: 9px;
            height: 9px;
            align-items: center;
            justify-content: center;
            border: 1px solid #6b7280;
            font-size: 8px;
            font-weight: 800;
            line-height: 1;
            vertical-align: middle;
          }

          .otb-check {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            white-space: nowrap;
          }

          .otb-check-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 3px 10px;
            margin-top: 5px;
          }

          .otb-check-grid.employment {
            margin-top: 4px;
            gap: 3px 12px;
          }

          .otb-term-title {
            height: 20px;
            font-weight: 800;
            vertical-align: middle !important;
          }

          .otb-term-label {
            width: 18%;
            background: #f3f4f6;
            font-weight: 800;
          }

          .otb-term-value {
            font-weight: 700;
          }

          .otb-field-tall {
            height: 34px;
          }

          .otb-buyer-title {
            height: 21px;
            font-weight: 800;
          }

          .otb-nested-cell {
            padding: 0 !important;
            border: 0 !important;
          }

          .otb-inner-table td,
          .otb-inner-table th {
            height: 17px;
          }

          .otb-inner-table .otb-civil {
            height: 48px;
          }

          .otb-employment {
            height: 69px;
          }

          .otb-income-cell {
            height: 28px;
            text-align: center;
            font-weight: 800;
          }

          .otb-blue {
            background: #1f4e79;
            color: #ffffff;
            text-align: center;
            font-weight: 800;
            text-transform: uppercase;
          }

          .otb-signature-space {
            height: 43px;
          }

          .otb-signature-label {
            height: 23px;
            text-align: center;
            font-weight: 800;
            vertical-align: middle !important;
          }

          .otb-footer-blank {
            height: 20mm;
          }

          .otb-remarks-line {
            display: inline-block;
            min-width: 136mm;
            border-bottom: 1px solid #7b7f86;
            height: 10px;
          }

          .otb-approval-cell {
            height: 26px;
            text-align: center;
            vertical-align: bottom !important;
            font-weight: 800;
          }

          @media print {
            .otb-page {
              width: 210mm !important;
              min-height: 297mm !important;
              padding: 7mm 8mm !important;
              margin: 0 !important;
              box-shadow: none !important;
            }
            .otb-form {
              min-height: 276mm !important;
            }
          }
        `}</style>

        <div className="otb-form">
          <table>
            <tbody>
              <tr>
                <td colSpan="12" className="otb-title-cell">
                  <h1 className="otb-title">Offer To Buy &amp; Buyer&apos;s Profile</h1>
                  <div className="otb-subtitle">Real Estate Sales - For Individual</div>
                  <div className="otb-header-grid">
                    <div>
                      <strong>Buyer Type</strong>{' '}
                      <SmallCheck label="Single" checked={buyerType === 'single'} />{' '}
                      <SmallCheck label="Spouses" checked={buyerType === 'spouses'} />{' '}
                      <SmallCheck label="and Account" checked={buyerType === 'and_account'} />
                    </div>
                    <div className="otb-sales-box"><strong>Sales Officer:</strong><span className="otb-line-box">{seller}</span></div>
                    <div><strong>Date Received:</strong> {dateReceived}</div>
                  </div>
                </td>
              </tr>

              <tr><th colSpan="12" className="otb-section otb-main-section">PROPERTY DESCRIPTION</th></tr>
              <tr><td colSpan="12" className="otb-location"><strong>Location:</strong> {valueFrom(listing, ['project_location', 'location'], '')}</td></tr>
              <tr>
                <td colSpan="3"><Field label="Property Type:" value={valueFrom(listing, ['lot_type'], '')} /></td>
                <td colSpan="3"><Field label="Lot Area (sqm):" value={valueFrom(listing, ['lotAreaSqm', 'area'], '')} /></td>
                <td colSpan="2"><Field label="Classification:" value={valueFrom(listing, ['classification', 'lot_type'], '')} /></td>
                <td colSpan="4"><Field label="Description/Improvements:" value={`Unit ${valueFrom(listing, ['unit_id', 'unitCode'], '')}`} /></td>
              </tr>

              <tr><th colSpan="12" className="otb-section">OFFER TERMS AND CONDITIONS</th></tr>
              <tr><td colSpan="12" className="otb-note">I/We, hereby offer to purchase the property described above under the following terms and conditions.</td></tr>
              <tr>
                <td colSpan="6" className="otb-term-title"><SmallCheck label="CASH" checked={isCash} /></td>
                <td colSpan="6" className="otb-term-title"><SmallCheck label="INSTALLMENT/In-house Financing" checked={isInstallment} /></td>
              </tr>
              <tr>
                <td colSpan="2" className="otb-term-label">Purchase Price:</td>
                <td colSpan="4" className="otb-term-value">{isCash ? `Php ${moneyBlank(tcp)}` : ''}</td>
                <td colSpan="2" className="otb-term-label">Purchase Price:</td>
                <td colSpan="4" className="otb-term-value">{isInstallment ? `Php ${moneyBlank(tcp)}` : ''}</td>
              </tr>
              <tr>
                <td colSpan="2" className="otb-term-label">Reservation Fee:</td>
                <td colSpan="4" className="otb-term-value">{isCash ? moneyBlank(reservationFee) : ''}</td>
                <td colSpan="2" className="otb-term-label">Reservation Fee:</td>
                <td colSpan="4" className="otb-term-value">{isInstallment ? moneyBlank(reservationFee) : ''}</td>
              </tr>
              <tr>
                <td colSpan="2" className="otb-term-label">Balance:</td>
                <td colSpan="4" className="otb-term-value">{isCash ? moneyBlank(Math.max(tcp - reservationFee, 0)) : ''}</td>
                <td colSpan="2" className="otb-term-label">Downpayment:</td>
                <td colSpan="4" className="otb-term-value">{isInstallment ? moneyBlank(downpayment) : ''}</td>
              </tr>
              <tr>
                <td colSpan="2" className="otb-term-label otb-field-tall">Deferred Cash:</td>
                <td colSpan="4" className="otb-field-tall"></td>
                <td colSpan="2" className="otb-term-label">Balance:</td>
                <td colSpan="4" className="otb-term-value">{isInstallment ? moneyBlank(balance) : ''}</td>
              </tr>
              <tr>
                <td colSpan="6" className="otb-field-tall"></td>
                <td colSpan="2" className="otb-term-label">Terms (months/years to pay):</td>
                <td colSpan="4" className="otb-term-value">{isInstallment && monthlyTerms > 0 ? `${monthlyTerms} months` : ''}</td>
              </tr>
              <tr>
                <td colSpan="6" className="otb-field-tall"></td>
                <td colSpan="2" className="otb-term-label">Interest Rate:</td>
                <td colSpan="4" className="otb-term-value">{isInstallment ? valueFrom(listing, ['interestRate'], '0.00%') : ''}</td>
              </tr>
              <tr>
                <td colSpan="6" className="otb-field-tall"></td>
                <td colSpan="2" className="otb-term-label">Monthly Amortization:</td>
                <td colSpan="4" className="otb-term-value">{isInstallment ? moneyBlank(monthly) : ''}</td>
              </tr>

              <tr><th colSpan="12" className="otb-section">INDIVIDUAL BUYER/S INFORMATION</th></tr>
              <tr>
                <BuyerColumn title="Principal Full-name (Last Name, First Name, Middle Name)" name={buyerName} client={client} />
                <BuyerColumn title="Spouse/Second Buyer's Name (Last Name, First Name, Middle Name)" name={secondBuyerName} client={client} second />
              </tr>
              <tr>
                <WorkColumn client={client} />
                <WorkColumn client={client} second />
              </tr>

              <tr><th colSpan="12" className="otb-section">INCOME DETAILS (MONTHLY)</th></tr>
              <tr>
                <td colSpan="4" className="otb-income-cell">PRINCIPAL<br />{moneyBlank(monthlyIncome)}</td>
                <td colSpan="4" className="otb-income-cell">SPOUSE/SECOND BUYER<br />{moneyBlank(secondMonthlyIncome)}</td>
                <td colSpan="4" className="otb-income-cell">TOTAL<br />{moneyBlank(totalIncome)}</td>
              </tr>
              <tr><th colSpan="12" className="otb-blue">SIGNATURES OF BUYER/S</th></tr>
              <tr>
                <td colSpan="6" className="otb-signature-space"></td>
                <td colSpan="6" className="otb-signature-space"></td>
              </tr>
              <tr>
                <td colSpan="6" className="otb-signature-label">Signature over Printed Name of Principal Buyer</td>
                <td colSpan="6" className="otb-signature-label">Signature over Printed Name of Spouse/Second Buyer</td>
              </tr>
              <tr><th colSpan="12" className="otb-section">SALES AGENT:</th></tr>
              <tr>
                <td colSpan="1"><strong>Name:</strong></td>
                <td colSpan="3" className="otb-field-line strong">{sellerLastName || (!sellerFirstName && !sellerMiddleName ? seller : '')}</td>
                <td colSpan="3" className="otb-field-line strong">{sellerFirstName}</td>
                <td colSpan="2" className="otb-field-line strong">{sellerMiddleName}</td>
                <td colSpan="3"><Field label="TIN No.:" value={sellerTinNo} /></td>
              </tr> 
              <tr>
                <td colSpan="1"></td>
                <td colSpan="3" className="text-center"><strong>Last Name</strong></td>
                <td colSpan="3" className="text-center"><strong>First Name</strong></td>
                <td colSpan="2" className="text-center"><strong>Middle Name</strong></td>
                <td colSpan="3"><Field label="Address:" value={sellerAddress} /></td>
              </tr>
              
            </tbody>
          </table>
        </div>
      </section>
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage
