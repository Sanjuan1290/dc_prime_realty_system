import {
  getEmploymentStatusOtherText,
  isEmploymentStatusChecked,
} from '../../../../utils/employmentStatus'
import {
  cleanMoney,
  formatDate,
  getNormalizedSoaRows,
  getValue,
} from './printUtils'

const blank = (value) => {
  if (value === undefined || value === null || value === '-') return ''
  return String(value)
}

const valueFrom = (source, keys, fallback = '') => blank(getValue(source, keys, fallback))

const plainMoney = (value) => {
  const amount = Number(value || 0)
  if (!(amount > 0)) return ''

  return new Intl.NumberFormat('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

const getRowAmount = (rows, keyword) => rows
  .filter((row) => String(row.description || '').toLowerCase().includes(keyword))
  .reduce((sum, row) => sum + cleanMoney(row.dueAmount), 0)

const getMonthlyAmount = (rows) => {
  const row = rows.find((item) => String(item.description || '').toLowerCase().includes('monthly'))
  return cleanMoney(row?.dueAmount || 0)
}

const Box = ({ checked = false }) => (
  <span className="otb-box" aria-hidden="true">{checked ? '✓' : ''}</span>
)

const SmallCheck = ({ checked = false, label }) => (
  <span className="otb-check"><Box checked={checked} /> <span>{label}</span></span>
)

const Field = ({ label, value }) => (
  <span><strong>{label}</strong>{value ? ` ${value}` : ''}</span>
)

const buyerField = (client, key) => valueFrom(client, [key], '')
const secondBuyerField = (client, suffix) => valueFrom(client, [`secondBuyer${suffix}`], '')

const civilChecks = (value) => {
  const civil = String(value || '').toLowerCase()

  return (
    <div className="otb-check-grid otb-civil-grid">
      <SmallCheck label="Single/Married" checked={civil === 'single' || civil === 'married'} />
      <SmallCheck label="Separated" checked={civil.includes('separated')} />
      <SmallCheck label="Annulled/Divorced" checked={civil.includes('annulled') || civil.includes('divorced')} />
      <SmallCheck label="Widow/er" checked={civil.includes('widow')} />
    </div>
  )
}

const employmentChecks = (value) => (
  <div className="otb-check-grid otb-employment-grid">
    <SmallCheck label="Employed - Private" checked={isEmploymentStatusChecked(value, 'private')} />
    <SmallCheck label="Self-Employed (With Business)" checked={isEmploymentStatusChecked(value, 'business')} />
    <SmallCheck label="Employed Government" checked={isEmploymentStatusChecked(value, 'government')} />
    <SmallCheck label="Self-Employed (Professional)" checked={isEmploymentStatusChecked(value, 'professional')} />
    <SmallCheck label="Employed - NGO" checked={isEmploymentStatusChecked(value, 'ngo')} />
    <SmallCheck label="OFW/immigrant" checked={isEmploymentStatusChecked(value, 'ofw')} />
  </div>
)

const formatBuyerName = ({ lastName, firstName, middleName, suffix, fallback }) => {
  const familyName = [lastName, suffix].filter(Boolean).join(' ')
  const givenNames = [firstName, middleName].filter(Boolean).join(' ')

  if (familyName && givenNames) return `${familyName}, ${givenNames}`
  if (familyName || givenNames) return familyName || givenNames
  return fallback || ''
}

const BuyerColumn = ({ title, name, client, second = false }) => {
  const get = (key) => second
    ? secondBuyerField(client, key)
    : buyerField(client, key.charAt(0).toLowerCase() + key.slice(1))

  const civil = second ? secondBuyerField(client, 'CivilStatus') : buyerField(client, 'civilStatus')
  const lastName = second ? secondBuyerField(client, 'LastName') : buyerField(client, 'buyerLastName')
  const firstName = second ? secondBuyerField(client, 'FirstName') : buyerField(client, 'buyerFirstName')
  const middleName = second ? secondBuyerField(client, 'MiddleName') : buyerField(client, 'buyerMiddleName')
  const suffix = second ? secondBuyerField(client, 'Suffix') : buyerField(client, 'buyerSuffix')
  const fullName = formatBuyerName({ lastName, firstName, middleName, suffix, fallback: name })

  return (
    <td colSpan="6" className="otb-nested-cell">
      <table className="otb-inner-table">
        <tbody>
          <tr>
            <td colSpan="4" className="otb-buyer-name-row">
              <strong>{title}</strong>{fullName ? <span className="otb-inline-value">{fullName}</span> : null}
            </td>
          </tr>
          <tr>
            <td colSpan="2"><Field label="Date of Birth:" value={formatDate(get('BirthDate')) === '-' ? '' : formatDate(get('BirthDate'))} /></td>
            <td colSpan="2"><Field label="Place of Birth:" value={get('PlaceOfBirth')} /></td>
          </tr>
          <tr>
            <td colSpan="2"><Field label="Citizenship:" value={get('Citizenship')} /></td>
            <td colSpan="2"><Field label="Gender:" value={get('Gender')} /></td>
          </tr>
          <tr>
            <td colSpan="4" className="otb-civil">
              <strong>Civil Status:</strong>
              {civilChecks(civil)}
            </td>
          </tr>
          <tr>
            <td colSpan="3"><Field label="Present Address:" value={get('PresentAddress')} /></td>
            <td><Field label="Zip Code" value={get('PresentZipCode')} /></td>
          </tr>
          <tr>
            <td colSpan="3"><Field label="Permanent Address:" value={get('PermanentAddress')} /></td>
            <td><Field label="Zip Code" value={get('PermanentZipCode')} /></td>
          </tr>
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
  const get = (key) => second
    ? secondBuyerField(client, key)
    : buyerField(client, key.charAt(0).toLowerCase() + key.slice(1))

  const employmentStatus = get('EmploymentStatus')
  const otherEmploymentStatus = getEmploymentStatusOtherText(employmentStatus)

  return (
    <td colSpan="6" className="otb-nested-cell">
      <table className="otb-inner-table">
        <tbody>
          <tr><th className="otb-subhead" colSpan="4">Work/Business Information</th></tr>
          <tr>
            <td colSpan="4" className="otb-employment">
              <strong>Employment Status: (Please check)</strong>
              {employmentChecks(employmentStatus)}
              <div className="otb-other-line"><strong>Other</strong><span>{otherEmploymentStatus}</span></div>
            </td>
          </tr>
          <tr><td colSpan="4"><Field label="Employer/Business Name:" value={get('EmployerBusinessName')} /></td></tr>
          <tr>
            <td colSpan="3"><Field label="Employer/Business Address:" value={get('EmployerBusinessAddress')} /></td>
            <td><Field label="Zip Code" value={get('EmployerZipCode')} /></td>
          </tr>
          <tr><td colSpan="4"><Field label="Nature of Work/Business:" value={get('NatureOfWorkBusiness')} /></td></tr>
          <tr><td colSpan="4"><Field label="Occupation/Position/Title:" value={get('OccupationPositionTitle')} /></td></tr>
        </tbody>
      </table>
    </td>
  )
}

const OfferToBuyForm = ({ listing = {}, client = {}, soaRows = [] }) => {
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
  const dateReceivedValue = valueFrom(client, ['dateReceived'], valueFrom(listing, ['client_unit_created'], ''))
  const dateReceived = dateReceivedValue ? formatDate(dateReceivedValue) : ''
  const monthlyIncome = cleanMoney(getValue(client, ['monthlyIncome'], 0))
  const secondMonthlyIncome = cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))
  const totalIncome = monthlyIncome + secondMonthlyIncome
  const interestRate = valueFrom(listing, ['interestRate', 'soaAnnualInterestRate'], '')

  return (
    <section className="print-page print-export-page otb-page mx-auto bg-white text-black shadow-lg print:shadow-none">
      <style>{`
        .otb-page {
          box-sizing: border-box;
          width: 210mm;
          min-height: 297mm;
          padding: 9mm 11mm;
          font-family: Arial, Helvetica, sans-serif;
        }

        .otb-page *,
        .otb-page *::before,
        .otb-page *::after {
          box-sizing: border-box;
        }

        .otb-form {
          width: 100%;
          border: 1.35px solid #4b5563;
          color: #20242a;
          background: #ffffff;
          font-size: 8.25px;
          line-height: 1.08;
        }

        .otb-form table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
        }

        .otb-form td,
        .otb-form th {
          border: .85px solid #81858b;
          padding: 2px 3.5px;
          vertical-align: top;
          overflow-wrap: anywhere;
        }

        .otb-title-cell {
          border-top: 0 !important;
          border-right: 0 !important;
          border-left: 0 !important;
          padding: 5px 6px 3px !important;
        }

        .otb-title {
          margin: 0;
          font-size: 13px;
          font-weight: 800;
          line-height: 1;
        }

        .otb-subtitle {
          margin-top: 1px;
          font-size: 10px;
          font-weight: 700;
        }

        .otb-header-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 205px 145px;
          align-items: end;
          gap: 8px;
          margin-top: 2px;
        }

        .otb-buyer-type {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 2px 10px;
        }

        .otb-sales-box {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: end;
          gap: 3px;
        }

        .otb-line-box {
          display: block;
          min-height: 14px;
          border: .85px solid #81858b;
          padding: 1px 4px;
          font-weight: 700;
        }

        .otb-section,
        .otb-subhead {
          background: #d9d9d9;
          text-align: center;
          font-weight: 800;
        }

        .otb-section {
          text-transform: uppercase;
          letter-spacing: .15px;
        }

        .otb-main-section {
          padding: 3px 4px !important;
          font-size: 16px;
          letter-spacing: .65px;
        }

        .otb-location {
          height: 23px;
          padding-top: 5px !important;
          font-size: 13px;
        }

        .otb-note {
          height: 13px;
          padding: 2px !important;
          text-align: center;
          font-size: 7.7px;
          font-style: italic;
          font-weight: 600;
        }

        .otb-box {
          display: inline-flex;
          width: 10px;
          height: 10px;
          flex: 0 0 10px;
          align-items: center;
          justify-content: center;
          border: .85px solid #6f747b;
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
          grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        }

        .otb-civil-grid {
          gap: 4px 12px;
          margin-top: 5px;
        }

        .otb-employment-grid {
          gap: 4px 10px;
          margin-top: 5px;
        }

        .otb-term-title {
          height: 21px;
          font-weight: 800;
          vertical-align: middle !important;
        }

        .otb-term-opening {
          height: 30px;
        }

        .otb-term-label {
          font-weight: 800;
          vertical-align: middle !important;
        }

        .otb-currency {
          width: 30px;
          text-align: left;
          vertical-align: middle !important;
        }

        .otb-term-value {
          font-weight: 700;
          vertical-align: middle !important;
        }

        .otb-term-row {
          height: 22px;
        }

        .otb-deferred-label {
          padding-top: 5px !important;
          vertical-align: top !important;
        }

        .otb-nested-cell {
          padding: 0 !important;
          border-top: 0 !important;
          border-bottom: 0 !important;
        }

        .otb-inner-table td,
        .otb-inner-table th {
          height: 16px;
        }

        .otb-buyer-name-row {
          height: 24px !important;
          font-weight: 600;
        }

        .otb-inline-value {
          display: inline-block;
          margin-left: 5px;
          font-weight: 800;
        }

        .otb-civil {
          height: 48px !important;
        }

        .otb-employment {
          height: 74px !important;
        }

        .otb-other-line {
          display: grid;
          grid-template-columns: auto 1fr;
          align-items: end;
          gap: 4px;
          margin-top: 5px;
        }

        .otb-other-line span {
          min-height: 11px;
          border-bottom: .85px solid #81858b;
          font-weight: 700;
        }

        .otb-income-cell {
          height: 31px;
          text-align: center;
          font-weight: 800;
          vertical-align: middle !important;
        }

        .otb-blue {
          background: #1f4e79;
          color: #ffffff;
          text-align: center;
          font-weight: 800;
          text-transform: uppercase;
        }

        .otb-signature-space {
          height: 40px;
        }

        .otb-signature-label {
          height: 22px;
          text-align: center;
          font-weight: 800;
          vertical-align: middle !important;
        }

        .otb-agent-title {
          background: #d9d9d9;
          text-align: center;
          font-size: 10px;
          font-weight: 800;
        }

        .otb-agent-name-labels {
          padding-top: 0 !important;
          text-align: center;
          font-size: 7.5px;
          font-weight: 700;
        }

        .otb-field-line {
          font-weight: 800;
        }

        .otb-revision {
          padding: 2px 4px 1px;
          font-size: 7px;
          font-weight: 700;
        }

        @media print {
          .otb-page {
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            padding: 8mm 10mm !important;
            box-shadow: none !important;
          }

          .otb-form {
            min-height: 0 !important;
            height: auto !important;
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
                  <div className="otb-buyer-type">
                    <strong>Buyer Type</strong>
                    <SmallCheck label="Single" checked={buyerType === 'single'} />
                    <SmallCheck label="Spouses" checked={buyerType === 'spouses'} />
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
              <td colSpan="3"><Field label="Property Type:" value={valueFrom(listing, ['property_type', 'propertyType'], 'Lot')} /></td>
              <td colSpan="3"><Field label="Lot Area (sqm):" value={valueFrom(listing, ['lotAreaSqm', 'lot_area_sqm', 'area'], '')} /></td>
              <td colSpan="2"><Field label="Classification:" /></td>
              <td colSpan="4"><Field label="Description/Improvements:" value={valueFrom(listing, ['description', 'improvements'], valueFrom(listing, ['unit_id', 'unitCode'], '') ? `Unit ${valueFrom(listing, ['unit_id', 'unitCode'], '')}` : '')} /></td>
            </tr>

            <tr><th colSpan="12" className="otb-section">OFFER TERMS AND CONDITIONS</th></tr>
            <tr><td colSpan="12" className="otb-note">I/We, hereby offer to purchase the property described above under the following terms and conditions:</td></tr>
            <tr>
              <td colSpan="6" className="otb-term-title"><SmallCheck label="CASH" checked={isCash} /></td>
              <td colSpan="6" className="otb-term-title"><SmallCheck label="INSTALLMENT/In-house Financing" checked={isInstallment} /></td>
            </tr>
            <tr>
              <td colSpan="6" className="otb-term-opening"></td>
              <td colSpan="6" className="otb-term-opening"></td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" className="otb-term-label">Purchase Price:</td>
              <td className="otb-currency">Php</td>
              <td colSpan="3" className="otb-term-value">{isCash ? plainMoney(tcp) : ''}</td>
              <td colSpan="2" className="otb-term-label">Purchase Price:</td>
              <td className="otb-currency">Php</td>
              <td colSpan="3" className="otb-term-value">{isInstallment ? plainMoney(tcp) : ''}</td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" className="otb-term-label">Reservation Fee:</td>
              <td colSpan="4" className="otb-term-value">{isCash ? plainMoney(reservationFee) : ''}</td>
              <td colSpan="2" className="otb-term-label">Reservation Fee:</td>
              <td colSpan="4" className="otb-term-value">{isInstallment ? plainMoney(reservationFee) : ''}</td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" rowSpan="2" className="otb-term-label">Balance:</td>
              <td colSpan="4" rowSpan="2" className="otb-term-value">{isCash ? plainMoney(Math.max(tcp - reservationFee, 0)) : ''}</td>
              <td colSpan="2" className="otb-term-label">Downpayment:</td>
              <td colSpan="4" className="otb-term-value">{isInstallment ? plainMoney(downpayment) : ''}</td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" className="otb-term-label">Balance:</td>
              <td colSpan="4" className="otb-term-value">{isInstallment ? plainMoney(balance) : ''}</td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" rowSpan="3" className="otb-term-label otb-deferred-label">Deferred Cash:</td>
              <td colSpan="4" rowSpan="3"></td>
              <td colSpan="2" className="otb-term-label">Terms (months/years to pay):</td>
              <td colSpan="4" className="otb-term-value">{isInstallment && monthlyTerms > 0 ? `${monthlyTerms} months` : ''}</td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" className="otb-term-label">Interest Rate:</td>
              <td colSpan="4" className="otb-term-value">{isInstallment ? interestRate : ''}</td>
            </tr>
            <tr className="otb-term-row">
              <td colSpan="2" className="otb-term-label">Monthly Amortization:</td>
              <td colSpan="4" className="otb-term-value">{isInstallment ? plainMoney(monthly) : ''}</td>
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
              <td colSpan="4" className="otb-income-cell">PRINCIPAL<br />{plainMoney(monthlyIncome)}</td>
              <td colSpan="4" className="otb-income-cell">SPOUSE/SECOND BUYER<br />{plainMoney(secondMonthlyIncome)}</td>
              <td colSpan="4" className="otb-income-cell">TOTAL<br />{plainMoney(totalIncome)}</td>
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
            <tr><th colSpan="12" className="otb-agent-title">SALES AGENT:</th></tr>
            <tr>
              <td><strong>Name:</strong></td>
              <td colSpan="3" className="otb-field-line">{sellerLastName || (!sellerFirstName && !sellerMiddleName ? seller : '')}</td>
              <td colSpan="3" className="otb-field-line">{sellerFirstName}</td>
              <td colSpan="2" className="otb-field-line">{sellerMiddleName}</td>
              <td colSpan="3"><Field label="TIN No.:" value={sellerTinNo} /></td>
            </tr>
            <tr>
              <td></td>
              <td colSpan="3" className="otb-agent-name-labels">Last name</td>
              <td colSpan="3" className="otb-agent-name-labels">First Name</td>
              <td colSpan="2" className="otb-agent-name-labels">Middle Name</td>
              <td colSpan="3"><Field label="Address:" value={sellerAddress} /></td>
            </tr>
          </tbody>
        </table>
        <div className="otb-revision">OTB (Individual) – Revised April 2026</div>
      </div>
    </section>
  )
}

export default OfferToBuyForm