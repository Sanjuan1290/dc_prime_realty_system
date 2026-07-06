import PrintPageShell from './PrintPageShell'
import { cleanMoney, formatDate, getNormalizedSoaRows, getValue, money, readPrintPayload } from './printUtils'

const text = (value) => (value === undefined || value === null || value === '-' ? '' : String(value))

const Check = ({ checked = false, label }) => (
  <span className="mr-3 inline-flex items-center gap-1 whitespace-nowrap">
    <span className="inline-flex h-[10px] w-[10px] items-center justify-center border border-black text-[8px] leading-none">
      {checked ? '✓' : ''}
    </span>
    <span>{label}</span>
  </span>
)

const Section = ({ children, blue = false }) => (
  <div className={`${blue ? 'bg-[#1f4e79] text-white' : 'bg-[#d9d9d9] text-black'} border border-black py-[2px] text-center text-[9px] font-black uppercase leading-none`}>
    {children}
  </div>
)

const Cell = ({ children, className = '' }) => (
  <div className={`min-h-[18px] border border-black px-[4px] py-[2px] text-[8.5px] leading-[1.15] ${className}`}>{children}</div>
)

const Label = ({ children }) => <span className="font-black">{children}</span>

const valueFrom = (source, keys, fallback = '') => text(getValue(source, keys, fallback))

const getRowAmount = (rows, keyword) => rows
  .filter((row) => String(row.description || '').toLowerCase().includes(keyword))
  .reduce((sum, row) => sum + cleanMoney(row.dueAmount), 0)

const getMonthlyAmount = (rows) => {
  const row = rows.find((item) => String(item.description || '').toLowerCase().includes('monthly'))
  return cleanMoney(row?.dueAmount || 0)
}

const employmentChecked = (value, target) => String(value || '').toLowerCase().includes(target.toLowerCase())
const getKey = (prefix, key) => prefix ? `${prefix}${key}` : `${key.charAt(0).toLowerCase()}${key.slice(1)}`

const WorkBlock = ({ client, prefix = '' }) => {
  const get = (key) => valueFrom(client, [getKey(prefix, key)], '')
  const employmentStatus = get('EmploymentStatus')
  const otherChecked = employmentStatus && !['private', 'business', 'government', 'professional', 'ngo', 'ofw', 'immigrant'].some((item) => employmentChecked(employmentStatus, item))

  return (
    <div>
      <Section>Work/Business Information</Section>
      <Cell className="min-h-[68px]">
        <Label>Employment Status: (Please check)</Label><br />
        <Check label="Employed - Private" checked={employmentChecked(employmentStatus, 'private')} />
        <Check label="Self-Employed (With Business)" checked={employmentChecked(employmentStatus, 'business')} /><br />
        <Check label="Employed Government" checked={employmentChecked(employmentStatus, 'government')} />
        <Check label="Self-Employed (Professional)" checked={employmentChecked(employmentStatus, 'professional')} /><br />
        <Check label="Employed - NGO" checked={employmentChecked(employmentStatus, 'ngo')} />
        <Check label="OFW/immigrant" checked={employmentChecked(employmentStatus, 'ofw') || employmentChecked(employmentStatus, 'immigrant')} /><br />
        <Label>Other:</Label> {otherChecked ? employmentStatus : ''}
      </Cell>
      <Cell><Label>Employer/Business Name:</Label> {get('EmployerBusinessName')}</Cell>
      <div className="grid grid-cols-[1fr_95px]">
        <Cell><Label>Employer/Business Address:</Label> {get('EmployerBusinessAddress')}</Cell>
        <Cell><Label>Zip Code:</Label> {get('EmployerZipCode')}</Cell>
      </div>
      <Cell><Label>Nature of Work/Business:</Label> {get('NatureOfWorkBusiness')}</Cell>
      <Cell><Label>Occupation/Position/Title:</Label> {get('OccupationPositionTitle')}</Cell>
    </div>
  )
}

const BuyerBlock = ({ client, prefix = '', title, buyerName }) => {
  const get = (key) => valueFrom(client, [getKey(prefix, key)], '')
  const civilStatus = get('CivilStatus').toLowerCase()

  return (
    <div>
      <Cell className="font-black">{title} {buyerName}</Cell>
      <div className="grid grid-cols-2">
        <Cell><Label>Date of Birth:</Label> {formatDate(get('BirthDate'))}</Cell>
        <Cell><Label>Place of Birth:</Label> {get('PlaceOfBirth')}</Cell>
      </div>
      <div className="grid grid-cols-2">
        <Cell><Label>Citizenship:</Label> {get('Citizenship')}</Cell>
        <Cell><Label>Gender:</Label> {get('Gender')}</Cell>
      </div>
      <Cell className="min-h-[46px]">
        <Label>Civil Status</Label><br />
        <Check label="Single/Married" checked={civilStatus === 'single' || civilStatus === 'married'} />
        <Check label="Separated" checked={civilStatus === 'separated'} /><br />
        <Check label="Annulled/Divorced" checked={civilStatus.includes('annulled') || civilStatus.includes('divorced')} />
        <Check label="Widow/er" checked={civilStatus.includes('widow')} />
      </Cell>
      <div className="grid grid-cols-[1fr_95px]">
        <Cell><Label>Present Address:</Label> {get('PresentAddress')}</Cell>
        <Cell><Label>Zip Code</Label> {get('PresentZipCode')}</Cell>
      </div>
      <Cell><Label>Permanent Address:</Label> {get('PermanentAddress')}</Cell>
      <Cell><Label>Mobile No.:</Label> {get('ContactNo')}</Cell>
      <Cell><Label>Residence Phone Number:</Label> {get('ResidencePhoneNumber')}</Cell>
      <Cell><Label>E-mail Add:</Label> {get('Email')}</Cell>
      <Cell><Label>TIN:</Label> {get('Tin')}</Cell>
    </div>
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
  const monthlyTerms = Number(getValue(listing, ['soaMonthlyTerms', 'monthlyTerms'], 0)) || rows.filter((row) => String(row.description || '').toLowerCase().includes('monthly')).length || 36
  const buyerType = valueFrom(client, ['buyerType'], 'single')
  const modeOfPayment = valueFrom(listing, ['soaModeOfPayment', 'modeOfPayment'], 'installment').toLowerCase()
  const buyerName = valueFrom(client, ['buyerName'], valueFrom(listing, ['buyer_name'], ''))
  const secondBuyerName = valueFrom(client, ['secondBuyerName'], '')
  const seller = valueFrom(listing, ['seller'], valueFrom(client, ['seller', 'salesOfficer'], ''))
  const monthlyIncome = cleanMoney(getValue(client, ['monthlyIncome'], 0))
  const secondMonthlyIncome = cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))

  return (
    <PrintPageShell title="Offer To Buy & Buyer&apos;s Profile">
      <section className="print-page mx-auto h-[297mm] w-[210mm] bg-white p-[10mm] text-black shadow-lg print:p-[6mm] print:shadow-none">
        <div className="h-full border border-black font-sans text-[8.5px] leading-tight">
          <div className="px-[5px] py-[3px]">
            <h1 className="text-[12px] font-black leading-none">Offer To Buy &amp; Buyer&apos;s Profile</h1>
            <p className="mt-[1px] font-black">Real Estate Sales - For Individual</p>
            <div className="mt-[2px] grid grid-cols-[1fr_210px_150px] items-center gap-2">
              <p>
                <Label>Buyer Type</Label>{' '}
                <Check label="Single" checked={buyerType === 'single'} />
                <Check label="Spouses" checked={buyerType === 'spouses'} />
                <Check label="and Account" checked={buyerType === 'and_account'} />
              </p>
              <p><Label>Sales Officer:</Label> {seller}</p>
              <p><Label>Date Received:</Label> {formatDate(valueFrom(client, ['dateReceived'], valueFrom(listing, ['client_unit_created'], '')))}</p>
            </div>
          </div>

          <Section>PROPERTY DESCRIPTION</Section>
          <Cell className="min-h-[24px] text-[10px]"><Label>Location:</Label> {valueFrom(listing, ['project_location', 'location'], '')}</Cell>
          <div className="grid grid-cols-[1.05fr_1.05fr_1fr_2.2fr]">
            <Cell><Label>Property Type:</Label> {valueFrom(listing, ['lot_type'], '')}</Cell>
            <Cell><Label>Lot Area (sqm):</Label> {valueFrom(listing, ['lotAreaSqm', 'area'], '')}</Cell>
            <Cell><Label>Classification:</Label> {valueFrom(listing, ['classification', 'lot_type'], '')}</Cell>
            <Cell><Label>Description/Improvements:</Label> Unit {valueFrom(listing, ['unit_id', 'unitCode'], '')}</Cell>
          </div>

          <Section>OFFER TERMS AND CONDITIONS</Section>
          <div className="border border-black py-[2px] text-center text-[8px] italic">
            I/We, hereby offer to purchase the property described above under the following terms and conditions.
          </div>

          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[145px_1fr]">
              <Cell className="col-span-2 min-h-[28px] font-black"><Check label="CASH" checked={modeOfPayment === 'cash'} /></Cell>
              <Cell><Label>Purchase Price:</Label></Cell><Cell>{modeOfPayment === 'cash' ? money(tcp) : ''}</Cell>
              <Cell><Label>Reservation Fee:</Label></Cell><Cell>{modeOfPayment === 'cash' ? money(reservationFee) : ''}</Cell>
              <Cell><Label>Balance:</Label></Cell><Cell>{modeOfPayment === 'cash' ? money(balance) : ''}</Cell>
              <Cell><Label>Deferred Cash:</Label></Cell><Cell></Cell>
            </div>
            <div className="grid grid-cols-[145px_1fr]">
              <Cell className="col-span-2 min-h-[28px] font-black"><Check label="INSTALLMENT/In-house Financing" checked={modeOfPayment !== 'cash'} /></Cell>
              <Cell><Label>Purchase Price:</Label></Cell><Cell>{money(tcp)}</Cell>
              <Cell><Label>Reservation Fee:</Label></Cell><Cell>{money(reservationFee)}</Cell>
              <Cell><Label>Downpayment:</Label></Cell><Cell>{money(downpayment)}</Cell>
              <Cell><Label>Balance:</Label></Cell><Cell>{money(balance)}</Cell>
              <Cell><Label>Terms (months/years to pay):</Label></Cell><Cell>{monthlyTerms} months</Cell>
              <Cell><Label>Interest Rate:</Label></Cell><Cell>{valueFrom(listing, ['interestRate'], '0.00%')}</Cell>
              <Cell><Label>Monthly Amortization:</Label></Cell><Cell>{money(monthly)}</Cell>
            </div>
          </div>

          <Section>INDIVIDUAL BUYER/S INFORMATION</Section>
          <div className="grid grid-cols-2">
            <BuyerBlock title="Principal Full-name (Last Name, First Name, Middle Name)" client={client} buyerName={buyerName} />
            <BuyerBlock title="Spouse/Second Buyer&apos;s Name (Last Name, First Name, Middle Name)" client={client} prefix="secondBuyer" buyerName={secondBuyerName} />
          </div>

          <div className="grid grid-cols-2">
            <WorkBlock client={client} />
            <WorkBlock client={client} prefix="secondBuyer" />
          </div>

          <Section>INCOME DETAILS (MONTHLY)</Section>
          <div className="grid grid-cols-3">
            <Cell className="min-h-[34px] text-center"><Label>PRINCIPAL</Label><br />{money(monthlyIncome)}</Cell>
            <Cell className="min-h-[34px] text-center"><Label>SPOUSE/SECOND BUYER</Label><br />{money(secondMonthlyIncome)}</Cell>
            <Cell className="min-h-[34px] text-center"><Label>TOTAL</Label><br />{money(monthlyIncome + secondMonthlyIncome)}</Cell>
          </div>

          <Section blue>SIGNATURES of BUYER/S</Section>
          <div className="grid grid-cols-2">
            <Cell className="h-[58px] pt-[42px] text-center font-black">Signature over Printed Name of Principal Buyer</Cell>
            <Cell className="h-[58px] pt-[42px] text-center font-black">Signature over Printed Name of Spouse/Second Buyer</Cell>
          </div>

          <Section>SALES AGENT:</Section>
          <div className="grid grid-cols-[230px_160px_1fr]">
            <Cell><Label>Name:</Label> {seller}</Cell>
            <Cell><Label>TIN No.:</Label></Cell>
            <Cell><Label>Address:</Label></Cell>
          </div>
          <div className="grid grid-cols-3">
            <Cell><Label>Last Name</Label></Cell>
            <Cell><Label>First Name</Label></Cell>
            <Cell><Label>Middle Name</Label></Cell>
          </div>
        </div>
      </section>
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage
