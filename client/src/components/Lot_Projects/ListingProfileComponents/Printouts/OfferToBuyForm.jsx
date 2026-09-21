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

const TEMPLATE_WIDTH = 2550
const TEMPLATE_HEIGHT = 4200
const TEMPLATE_URL = '/forms/offer-to-buy-individual-apr-2026.png'

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

const buyerField = (client, key) => valueFrom(client, [key], '')
const secondBuyerField = (client, suffix) => valueFrom(client, [`secondBuyer${suffix}`], '')

const formatBuyerName = ({ lastName, firstName, middleName, suffix, fallback }) => {
  const familyName = [lastName, suffix].filter(Boolean).join(' ')
  const givenNames = [firstName, middleName].filter(Boolean).join(' ')
  if (familyName && givenNames) return `${familyName}, ${givenNames}`
  if (familyName || givenNames) return familyName || givenNames
  return fallback || ''
}

const pxToPercent = (value, axis = 'x') => `${((Number(value || 0) / (axis === 'x' ? TEMPLATE_WIDTH : TEMPLATE_HEIGHT)) * 100).toFixed(5)}%`

const Overlay = ({ x, y, w, h = 42, size = 7.2, weight = 700, align = 'left', children, wrap = false, className = '' }) => {
  if (children === undefined || children === null || children === '') return null
  return (
    <div
      className={`otb-overlay ${className}`}
      style={{
        left: pxToPercent(x, 'x'),
        top: pxToPercent(y, 'y'),
        width: pxToPercent(w, 'x'),
        minHeight: pxToPercent(h, 'y'),
        fontSize: `${size}pt`,
        fontWeight: weight,
        textAlign: align,
        whiteSpace: wrap ? 'normal' : 'nowrap',
      }}
    >
      {children}
    </div>
  )
}

const Check = ({ x, y, checked }) => checked ? (
  <div
    className="otb-checkmark"
    style={{ left: pxToPercent(x, 'x'), top: pxToPercent(y, 'y') }}
    aria-hidden="true"
  >✓</div>
) : null

const dateText = (value) => {
  if (!value) return ''
  const formatted = formatDate(value)
  return formatted === '-' ? '' : formatted
}

const OfferToBuyForm = ({ listing = {}, client = {}, soaRows = [] }) => {
  const rows = getNormalizedSoaRows(soaRows)
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const reservationFee = getRowAmount(rows, 'reservation') || cleanMoney(getValue(listing, ['reservationFee'], 0))
  const downpayment = getRowAmount(rows, 'downpayment') || cleanMoney(getValue(listing, ['downpayment'], 0))
  const balance = cleanMoney(getValue(listing, ['balanceAmount', 'balance'], Math.max(tcp - downpayment, 0)))
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization'], getMonthlyAmount(rows)))

  const buyerType = valueFrom(client, ['buyerType'], 'single').toLowerCase()
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
  const dateReceived = dateText(dateReceivedValue)
  const monthlyIncome = cleanMoney(getValue(client, ['monthlyIncome'], 0))
  const secondMonthlyIncome = cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))
  const totalIncome = monthlyIncome + secondMonthlyIncome
  const interestRate = valueFrom(listing, ['interestRate', 'soaAnnualInterestRate'], '')

  const principal = {
    name: formatBuyerName({
      lastName: buyerField(client, 'buyerLastName'),
      firstName: buyerField(client, 'buyerFirstName'),
      middleName: buyerField(client, 'buyerMiddleName'),
      suffix: buyerField(client, 'buyerSuffix'),
      fallback: buyerName,
    }),
    birthDate: dateText(buyerField(client, 'birthDate')),
    placeOfBirth: buyerField(client, 'placeOfBirth'),
    citizenship: buyerField(client, 'citizenship'),
    gender: buyerField(client, 'gender'),
    civilStatus: buyerField(client, 'civilStatus'),
    presentAddress: buyerField(client, 'presentAddress'),
    presentZip: buyerField(client, 'presentZipCode'),
    permanentAddress: buyerField(client, 'permanentAddress'),
    mobile: buyerField(client, 'contactNo'),
    residencePhone: buyerField(client, 'residencePhoneNumber'),
    email: buyerField(client, 'email'),
    tin: buyerField(client, 'tin'),
    employmentStatus: buyerField(client, 'employmentStatus'),
    employerName: buyerField(client, 'employerBusinessName'),
    employerAddress: buyerField(client, 'employerBusinessAddress'),
    employerZip: buyerField(client, 'employerZipCode'),
    nature: buyerField(client, 'natureOfWorkBusiness'),
    occupation: buyerField(client, 'occupationPositionTitle'),
  }

  const second = {
    name: formatBuyerName({
      lastName: secondBuyerField(client, 'LastName'),
      firstName: secondBuyerField(client, 'FirstName'),
      middleName: secondBuyerField(client, 'MiddleName'),
      suffix: secondBuyerField(client, 'Suffix'),
      fallback: secondBuyerName,
    }),
    birthDate: dateText(secondBuyerField(client, 'BirthDate')),
    placeOfBirth: secondBuyerField(client, 'PlaceOfBirth'),
    citizenship: secondBuyerField(client, 'Citizenship'),
    gender: secondBuyerField(client, 'Gender'),
    civilStatus: secondBuyerField(client, 'CivilStatus'),
    presentAddress: secondBuyerField(client, 'PresentAddress'),
    presentZip: secondBuyerField(client, 'PresentZipCode'),
    permanentAddress: secondBuyerField(client, 'PermanentAddress'),
    mobile: secondBuyerField(client, 'ContactNo'),
    residencePhone: secondBuyerField(client, 'ResidencePhoneNumber'),
    email: secondBuyerField(client, 'Email'),
    tin: secondBuyerField(client, 'Tin'),
    employmentStatus: secondBuyerField(client, 'EmploymentStatus'),
    employerName: secondBuyerField(client, 'EmployerBusinessName'),
    employerAddress: secondBuyerField(client, 'EmployerBusinessAddress'),
    employerZip: secondBuyerField(client, 'EmployerZipCode'),
    nature: secondBuyerField(client, 'NatureOfWorkBusiness'),
    occupation: secondBuyerField(client, 'OccupationPositionTitle'),
  }

  const principalCivil = principal.civilStatus.toLowerCase()
  const secondCivil = second.civilStatus.toLowerCase()

  return (
    <section className="print-page print-export-page otb-page mx-auto bg-white text-black shadow-lg print:shadow-none">
      <style>{`
        @page { size: 8.5in 14in; margin: 0 !important; }
        .otb-page {
          position: relative;
          width: 8.5in;
          height: 14in;
          min-width: 8.5in;
          min-height: 14in;
          overflow: hidden;
          background: #fff;
          font-family: Arial, Helvetica, sans-serif;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .otb-template-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          user-select: none;
          pointer-events: none;
        }
        .otb-overlay {
          position: absolute;
          z-index: 2;
          overflow: hidden;
          color: #000;
          line-height: 1.05;
          font-family: Arial, Helvetica, sans-serif;
          text-overflow: clip;
        }
        .otb-checkmark {
          position: absolute;
          z-index: 3;
          width: 18px;
          height: 18px;
          transform: translate(-50%, -50%);
          color: #000;
          font-family: Arial, Helvetica, sans-serif;
          font-size: 10pt;
          font-weight: 900;
          line-height: 18px;
          text-align: center;
        }
        @media print {
          .otb-page {
            width: 8.5in !important;
            height: 14in !important;
            min-width: 8.5in !important;
            min-height: 14in !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <img className="otb-template-image" src={TEMPLATE_URL} alt="" aria-hidden="true" />

      {/* Exact April 2026 reference form lines are supplied by the template image above.
          The elements below only place reservation data into the blank areas. */}

      <Check x={366} y={480} checked={buyerType === 'single'} />
      <Check x={601} y={479} checked={buyerType === 'spouses'} />
      <Check x={844} y={479} checked={buyerType === 'and_account'} />
      <Overlay x={1395} y={483} w={480} h={44} size={6.7}>{seller}</Overlay>
      <Overlay x={2185} y={483} w={250} h={44} size={6.7}>{dateReceived}</Overlay>

      <Overlay x={270} y={670} w={2050} h={48} size={7}>{valueFrom(listing, ['project_location', 'location'], '')}</Overlay>
      <Overlay x={250} y={755} w={250} h={40} size={6.2}>{valueFrom(listing, ['property_type', 'propertyType'], 'Lot')}</Overlay>
      <Overlay x={790} y={755} w={95} h={40} size={6.2}>{valueFrom(listing, ['lotAreaSqm', 'lot_area_sqm', 'area'], '')}</Overlay>
      <Overlay x={1110} y={755} w={110} h={40} size={6.2}>{valueFrom(listing, ['classification', 'lotType', 'lot_type'], '')}</Overlay>
      <Overlay x={1700} y={755} w={630} h={40} size={6.2}>{valueFrom(listing, ['description', 'improvements'], valueFrom(listing, ['unit_id', 'unitCode'], '') ? `Unit ${valueFrom(listing, ['unit_id', 'unitCode'], '')}` : '')}</Overlay>

      <Check x={104} y={946} checked={isCash} />
      <Check x={1260} y={946} checked={isInstallment} />
      <Overlay x={620} y={1080} w={545} h={35} size={6.5}>{isCash ? plainMoney(tcp) : ''}</Overlay>
      <Overlay x={1730} y={1080} w={600} h={35} size={6.5}>{isInstallment ? plainMoney(tcp) : ''}</Overlay>
      <Overlay x={555} y={1135} w={610} h={48} size={6.5}>{isCash ? plainMoney(reservationFee) : ''}</Overlay>
      <Overlay x={1650} y={1135} w={690} h={48} size={6.5}>{isInstallment ? plainMoney(reservationFee) : ''}</Overlay>
      <Overlay x={555} y={1237} w={610} h={45} size={6.5}>{isCash ? plainMoney(Math.max(tcp - reservationFee, 0)) : ''}</Overlay>
      <Overlay x={1650} y={1237} w={690} h={45} size={6.5}>{isInstallment ? plainMoney(downpayment) : ''}</Overlay>
      <Overlay x={1650} y={1335} w={690} h={45} size={6.5}>{isInstallment ? plainMoney(balance) : ''}</Overlay>
      <Overlay x={1650} y={1430} w={690} h={48} size={6.5}>{isInstallment && monthlyTerms > 0 ? `${monthlyTerms} months` : ''}</Overlay>
      <Overlay x={1650} y={1535} w={690} h={45} size={6.5}>{isInstallment ? interestRate : ''}</Overlay>
      <Overlay x={1765} y={1630} w={570} h={45} size={6.5}>{isInstallment ? plainMoney(monthly) : ''}</Overlay>

      <Overlay x={80} y={1820} w={1080} h={42} size={6.1}>{principal.name}</Overlay>
      <Overlay x={1240} y={1820} w={1080} h={42} size={6.1}>{second.name}</Overlay>
      <Overlay x={250} y={1882} w={205} h={36} size={6}>{principal.birthDate}</Overlay>
      <Overlay x={720} y={1882} w={420} h={36} size={6}>{principal.placeOfBirth}</Overlay>
      <Overlay x={1410} y={1882} w={245} h={36} size={6}>{second.birthDate}</Overlay>
      <Overlay x={1875} y={1882} w={440} h={36} size={6}>{second.placeOfBirth}</Overlay>
      <Overlay x={190} y={1943} w={430} h={36} size={6}>{principal.citizenship}</Overlay>
      <Overlay x={950} y={1943} w={185} h={36} size={6}>{principal.gender}</Overlay>
      <Overlay x={1410} y={1943} w={430} h={36} size={6}>{second.citizenship}</Overlay>
      <Overlay x={2190} y={1943} w={140} h={36} size={6}>{second.gender}</Overlay>

      <Check x={128} y={2090} checked={principalCivil === 'single' || principalCivil === 'married'} />
      <Check x={729} y={2090} checked={principalCivil.includes('separated')} />
      <Check x={128} y={2145} checked={principalCivil.includes('annulled') || principalCivil.includes('divorced')} />
      <Check x={729} y={2145} checked={principalCivil.includes('widow')} />
      <Check x={1286} y={2090} checked={secondCivil === 'single' || secondCivil === 'married'} />
      <Check x={1889} y={2090} checked={secondCivil.includes('separated')} />
      <Check x={1286} y={2145} checked={secondCivil.includes('annulled') || secondCivil.includes('divorced')} />
      <Check x={1889} y={2145} checked={secondCivil.includes('widow')} />

      <Overlay x={80} y={2250} w={730} h={65} size={6} wrap>{principal.presentAddress}</Overlay>
      <Overlay x={990} y={2250} w={205} h={45} size={6}>{principal.presentZip}</Overlay>
      <Overlay x={1240} y={2250} w={730} h={65} size={6} wrap>{second.presentAddress}</Overlay>
      <Overlay x={2190} y={2250} w={145} h={45} size={6}>{second.presentZip}</Overlay>
      <Overlay x={300} y={2340} w={830} h={34} size={6}>{principal.permanentAddress}</Overlay>
      <Overlay x={1485} y={2340} w={825} h={34} size={6}>{second.permanentAddress}</Overlay>
      <Overlay x={200} y={2390} w={930} h={32} size={6}>{principal.mobile}</Overlay>
      <Overlay x={1370} y={2390} w={930} h={32} size={6}>{second.mobile}</Overlay>
      <Overlay x={330} y={2438} w={800} h={32} size={6}>{principal.residencePhone}</Overlay>
      <Overlay x={1570} y={2438} w={730} h={32} size={6}>{second.residencePhone}</Overlay>
      <Overlay x={190} y={2487} w={940} h={32} size={6}>{principal.email}</Overlay>
      <Overlay x={1390} y={2487} w={910} h={32} size={6}>{second.email}</Overlay>
      <Overlay x={120} y={2536} w={1010} h={32} size={6}>{principal.tin}</Overlay>
      <Overlay x={1300} y={2536} w={1000} h={32} size={6}>{second.tin}</Overlay>

      <Check x={119} y={2710} checked={isEmploymentStatusChecked(principal.employmentStatus, 'private')} />
      <Check x={562} y={2725} checked={isEmploymentStatusChecked(principal.employmentStatus, 'business')} />
      <Check x={119} y={2777} checked={isEmploymentStatusChecked(principal.employmentStatus, 'government')} />
      <Check x={568} y={2786} checked={isEmploymentStatusChecked(principal.employmentStatus, 'professional')} />
      <Check x={119} y={2845} checked={isEmploymentStatusChecked(principal.employmentStatus, 'ngo')} />
      <Check x={566} y={2845} checked={isEmploymentStatusChecked(principal.employmentStatus, 'ofw')} />
      <Check x={1277} y={2706} checked={isEmploymentStatusChecked(second.employmentStatus, 'private')} />
      <Check x={1765} y={2714} checked={isEmploymentStatusChecked(second.employmentStatus, 'business')} />
      <Check x={1277} y={2770} checked={isEmploymentStatusChecked(second.employmentStatus, 'government')} />
      <Check x={1764} y={2775} checked={isEmploymentStatusChecked(second.employmentStatus, 'professional')} />
      <Check x={1277} y={2831} checked={isEmploymentStatusChecked(second.employmentStatus, 'ngo')} />
      <Check x={1763} y={2840} checked={isEmploymentStatusChecked(second.employmentStatus, 'ofw')} />
      <Overlay x={190} y={2890} w={590} h={36} size={5.9}>{getEmploymentStatusOtherText(principal.employmentStatus)}</Overlay>
      <Overlay x={1335} y={2890} w={590} h={36} size={5.9}>{getEmploymentStatusOtherText(second.employmentStatus)}</Overlay>

      <Overlay x={490} y={2930} w={680} h={32} size={6}>{principal.employerName}</Overlay>
      <Overlay x={1640} y={2930} w={680} h={32} size={6}>{second.employerName}</Overlay>
      <Overlay x={80} y={3040} w={730} h={60} size={6} wrap>{principal.employerAddress}</Overlay>
      <Overlay x={990} y={3040} w={205} h={36} size={6}>{principal.employerZip}</Overlay>
      <Overlay x={1240} y={3040} w={730} h={60} size={6} wrap>{second.employerAddress}</Overlay>
      <Overlay x={2190} y={3040} w={145} h={36} size={6}>{second.employerZip}</Overlay>
      <Overlay x={400} y={3133} w={760} h={32} size={6}>{principal.nature}</Overlay>
      <Overlay x={1550} y={3133} w={770} h={32} size={6}>{second.nature}</Overlay>
      <Overlay x={400} y={3185} w={760} h={32} size={6}>{principal.occupation}</Overlay>
      <Overlay x={1550} y={3185} w={770} h={32} size={6}>{second.occupation}</Overlay>

      <Overlay x={80} y={3370} w={770} h={38} size={6.4} align="center">{plainMoney(monthlyIncome)}</Overlay>
      <Overlay x={850} y={3370} w={770} h={38} size={6.4} align="center">{plainMoney(secondMonthlyIncome)}</Overlay>
      <Overlay x={1620} y={3370} w={780} h={38} size={6.4} align="center">{plainMoney(totalIncome)}</Overlay>

      <Overlay x={210} y={3745} w={280} h={34} size={6}>{sellerLastName || (!sellerFirstName && !sellerMiddleName ? seller : '')}</Overlay>
      <Overlay x={630} y={3745} w={300} h={34} size={6}>{sellerFirstName}</Overlay>
      <Overlay x={975} y={3745} w={250} h={34} size={6}>{sellerMiddleName}</Overlay>
      <Overlay x={1455} y={3745} w={850} h={34} size={6}>{sellerTinNo}</Overlay>
      <Overlay x={1395} y={3830} w={920} h={34} size={6}>{sellerAddress}</Overlay>
    </section>
  )
}

export default OfferToBuyForm
