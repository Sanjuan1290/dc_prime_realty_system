import PrintPageShell from './PrintPageShell'
import { cleanMoney, formatDate, getNormalizedSoaRows, getValue, money, readPrintPayload } from './printUtils'

const Box = ({ label, checked = false }) => (
  <span className="mr-1 inline-flex items-center gap-0.5 whitespace-nowrap">
    <span className="inline-flex h-[8px] w-[8px] items-center justify-center border border-black text-[7px] leading-none">
      {checked ? '✓' : ''}
    </span>
    {label}
  </span>
)

const Cell = ({ children, className = '' }) => (
  <div className={`min-h-[18px] border border-black px-1 py-[2px] text-[8px] leading-tight ${className}`}>{children}</div>
)

const Header = ({ children }) => (
  <div className="border border-black bg-[#d9d9d9] py-[2px] text-center text-[9px] font-black leading-tight">{children}</div>
)

const Label = ({ children }) => <span className="font-black">{children}</span>

const getRowAmount = (rows, keyword) => rows
  .filter((row) => String(row.description || '').toLowerCase().includes(keyword))
  .reduce((sum, row) => sum + cleanMoney(row.dueAmount), 0)

const employmentChecked = (value, target) => String(value || '').toLowerCase().includes(target.toLowerCase())

const makeKey = (prefix, key) => {
  const normalizedKey = key.charAt(0).toLowerCase() + key.slice(1)
  return prefix ? `${prefix}${key}` : normalizedKey
}

const WorkInfo = ({ title, client, prefix = '' }) => {
  const get = (key, fallback = '') => getValue(client, [makeKey(prefix, key)], fallback)
  const employmentStatus = get('EmploymentStatus', '')

  return (
    <div>
      <Header>{title}</Header>
      <Cell className="min-h-[52px]">
        <Label>Employment Status:</Label>
        <br />
        <Box label="Employed - Private" checked={employmentChecked(employmentStatus, 'private')} />
        <Box label="Self-Employed (With Business)" checked={employmentChecked(employmentStatus, 'business')} />
        <br />
        <Box label="Employed Government" checked={employmentChecked(employmentStatus, 'government')} />
        <Box label="Self-Employed (Professional)" checked={employmentChecked(employmentStatus, 'professional')} />
        <br />
        <Box label="Employed - NGO" checked={employmentChecked(employmentStatus, 'ngo')} />
        <Box label="OFW/immigrant" checked={employmentChecked(employmentStatus, 'ofw') || employmentChecked(employmentStatus, 'immigrant')} />
        <br />
        Other: {employmentStatus && !['private', 'business', 'government', 'professional', 'ngo', 'ofw', 'immigrant'].some((item) => employmentChecked(employmentStatus, item)) ? employmentStatus : ''}
      </Cell>
      <Cell><Label>Employer/Business Name:</Label> {get('EmployerBusinessName')}</Cell>
      <div className="grid grid-cols-[1fr_96px]">
        <Cell><Label>Employer/Business Address:</Label> {get('EmployerBusinessAddress')}</Cell>
        <Cell><Label>Zip Code:</Label> {get('EmployerZipCode')}</Cell>
      </div>
      <Cell><Label>Nature of Work/Business:</Label> {get('NatureOfWorkBusiness')}</Cell>
      <Cell><Label>Occupation/Position/Title:</Label> {get('OccupationPositionTitle')}</Cell>
    </div>
  )
}

const BuyerInfo = ({ title, client, prefix = '', buyerName = '' }) => {
  const get = (key, fallback = '') => getValue(client, [makeKey(prefix, key)], fallback)
  const civilStatus = String(get('CivilStatus')).toLowerCase()

  return (
    <div className="grid grid-cols-2">
      <Cell className="col-span-2"><Label>{title}</Label> {buyerName}</Cell>
      <Cell><Label>Date of Birth:</Label> {formatDate(get('BirthDate'))}</Cell>
      <Cell><Label>Place of Birth:</Label> {get('PlaceOfBirth')}</Cell>
      <Cell><Label>Citizenship:</Label> {get('Citizenship')}</Cell>
      <Cell><Label>Gender:</Label> {get('Gender')}</Cell>
      <Cell className="col-span-2">
        <Label>Civil Status:</Label>{' '}
        <Box label="Single" checked={civilStatus === 'single'} />
        <Box label="Married" checked={civilStatus === 'married'} />
        <Box label="Separated" checked={civilStatus === 'separated'} />
        <Box label="Annulled/Divorced" checked={civilStatus === 'annulled/divorced' || civilStatus === 'divorced'} />
        <Box label="Widow/er" checked={civilStatus === 'widow/er' || civilStatus === 'widower' || civilStatus === 'widow'} />
      </Cell>
      <Cell><Label>Present Address:</Label> {get('PresentAddress')}</Cell>
      <Cell><Label>Zip Code:</Label> {get('PresentZipCode')}</Cell>
      <Cell className="col-span-2"><Label>Permanent Address:</Label> {get('PermanentAddress')}</Cell>
      <Cell className="col-span-2"><Label>Mobile No.:</Label> {get('ContactNo')}</Cell>
      <Cell className="col-span-2"><Label>Residence Phone Number:</Label> {get('ResidencePhoneNumber')}</Cell>
      <Cell className="col-span-2"><Label>E-mail Add:</Label> {get('Email')}</Cell>
      <Cell className="col-span-2"><Label>TIN:</Label> {get('Tin')}</Cell>
    </div>
  )
}

const OfferToBuyPrintPage = () => {
  const { listing = {}, client = {}, soaRows = [] } = readPrintPayload()
  const rows = getNormalizedSoaRows(soaRows)
  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const reservationFee = getRowAmount(rows, 'reservation') || cleanMoney(getValue(listing, ['reservationFee'], 0))
  const downpayment = getRowAmount(rows, 'downpayment') || cleanMoney(getValue(listing, ['downpayment'], 0))
  const balance = cleanMoney(getValue(listing, ['balanceAmount', 'balance'], tcp - reservationFee - downpayment))
  const monthlyRow = rows.find((row) => String(row.description || '').toLowerCase().includes('monthly'))
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization'], monthlyRow?.dueAmount || 0))
  const monthlyTerms = Number(getValue(listing, ['soaMonthlyTerms', 'monthlyTerms'], 0)) || rows.filter((row) => String(row.description || '').toLowerCase().includes('monthly')).length || 36
  const buyerType = getValue(client, ['buyerType'], 'single')
  const buyerName = getValue(client, ['buyerName'], getValue(listing, ['buyer_name'], ''))
  const secondBuyerName = getValue(client, ['secondBuyerName'], '')
  const seller = getValue(listing, ['seller'], getValue(client, ['seller', 'salesOfficer'], ''))
  const modeOfPayment = String(getValue(listing, ['soaModeOfPayment', 'modeOfPayment'], 'installment')).toLowerCase()

  return (
    <PrintPageShell title="Offer to Buy">
      <div className="mx-auto w-[8.5in] bg-white p-2 text-black shadow-lg print:w-full print:p-0 print:shadow-none">
        <div className="border border-black font-sans text-[8px] leading-tight">
          <div className="px-1 py-[2px]">
            <h1 className="text-[13px] font-black leading-none">Offer To Buy &amp; Buyer&apos;s Profile</h1>
            <p className="mt-[1px] text-[8px] font-black">Real Estate Sales — For Individual</p>
            <div className="mt-[2px] grid grid-cols-[1fr_210px_160px] items-center gap-1">
              <p>
                Buyer Type&nbsp;
                <Box label="Single" checked={buyerType === 'single'} />
                <Box label="Spouses" checked={buyerType === 'spouses'} />
                <Box label="and Account" checked={buyerType === 'and_account'} />
              </p>
              <p>Sales Officer: <span className="font-black">{seller}</span></p>
              <p>Date Received: <span className="font-black">{formatDate(getValue(client, ['dateReceived'], getValue(listing, ['client_unit_created'], new Date().toISOString().slice(0, 10))))}</span></p>
            </div>
          </div>

          <Header>PROPERTY DESCRIPTION</Header>
          <Cell><Label>Location:</Label> {getValue(listing, ['project_location', 'location'], '')}</Cell>
          <div className="grid grid-cols-4">
            <Cell><Label>Property Type:</Label> {getValue(listing, ['lot_type'], '')}</Cell>
            <Cell><Label>Lot Area (sqm):</Label> {getValue(listing, ['lotAreaSqm', 'area'], '')}</Cell>
            <Cell><Label>Classification:</Label> {getValue(listing, ['classification', 'lot_type'], '')}</Cell>
            <Cell><Label>Description/Improvements:</Label> Unit {getValue(listing, ['unit_id', 'unitCode'], '')}</Cell>
          </div>

          <Header>OFFER TERMS AND CONDITIONS</Header>
          <div className="border border-black py-[2px] text-center text-[8px] italic">
            I/We hereby offer to purchase the property described above under the following terms and conditions.
          </div>
          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[150px_1fr]">
              <Cell className="col-span-2 font-black"><Box label="CASH" checked={modeOfPayment === 'cash'} /></Cell>
              <Cell className="font-black">Purchase Price:</Cell><Cell>{modeOfPayment === 'cash' ? money(tcp) : ''}</Cell>
              <Cell className="font-black">Reservation Fee:</Cell><Cell>{modeOfPayment === 'cash' ? money(reservationFee) : ''}</Cell>
              <Cell className="font-black">Balance:</Cell><Cell>{modeOfPayment === 'cash' ? money(balance) : ''}</Cell>
              <Cell className="font-black">Deferred Cash:</Cell><Cell></Cell>
            </div>
            <div className="grid grid-cols-[150px_1fr]">
              <Cell className="col-span-2 font-black"><Box label="INSTALLMENT/In-house Financing" checked={modeOfPayment !== 'cash'} /></Cell>
              <Cell className="font-black">Purchase Price:</Cell><Cell>{money(tcp)}</Cell>
              <Cell className="font-black">Reservation Fee:</Cell><Cell>{money(reservationFee)}</Cell>
              <Cell className="font-black">Downpayment:</Cell><Cell>{money(downpayment)}</Cell>
              <Cell className="font-black">Balance:</Cell><Cell>{money(balance)}</Cell>
              <Cell className="font-black">Terms (months/years to pay):</Cell><Cell>{monthlyTerms} months</Cell>
              <Cell className="font-black">Interest Rate:</Cell><Cell>{getValue(listing, ['interestRate'], '0.00%')}</Cell>
              <Cell className="font-black">Monthly Amortization:</Cell><Cell>{money(monthly)}</Cell>
            </div>
          </div>

          <Header>INDIVIDUAL BUYER/S INFORMATION</Header>
          <div className="grid grid-cols-2">
            <BuyerInfo title="Principal Full-name:" client={client} buyerName={buyerName} />
            <BuyerInfo title="Spouse/Second Buyer&apos;s Name:" client={client} prefix="secondBuyer" buyerName={secondBuyerName} />
          </div>

          <div className="grid grid-cols-2">
            <WorkInfo title="Work/Business Information" client={client} />
            <WorkInfo title="Work/Business Information" client={client} prefix="secondBuyer" />
          </div>

          <Header>INCOME DETAILS (MONTHLY)</Header>
          <div className="grid grid-cols-3">
            <Cell className="text-center"><Label>PRINCIPAL</Label><br />{money(getValue(client, ['monthlyIncome'], 0))}</Cell>
            <Cell className="text-center"><Label>SPOUSE/SECOND BUYER</Label><br />{money(getValue(client, ['secondBuyerMonthlyIncome'], 0))}</Cell>
            <Cell className="text-center"><Label>TOTAL</Label><br />{money(cleanMoney(getValue(client, ['monthlyIncome'], 0)) + cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0)))}</Cell>
          </div>

          <div className="bg-[#1f4e79] py-[3px] text-center text-[9px] font-black text-white">SIGNATURES of BUYER/S</div>
          <div className="grid grid-cols-2">
            <Cell className="h-[76px] pt-[56px] text-center font-black">Signature over Printed Name of Principal Buyer</Cell>
            <Cell className="h-[76px] pt-[56px] text-center font-black">Signature over Printed Name of Spouse/Second Buyer</Cell>
          </div>

          <Header>SALES AGENT:</Header>
          <div className="grid grid-cols-[220px_170px_1fr]">
            <Cell><Label>Name:</Label> {seller}</Cell>
            <Cell><Label>TIN No.:</Label></Cell>
            <Cell><Label>Address:</Label></Cell>
          </div>
        </div>
      </div>
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage
