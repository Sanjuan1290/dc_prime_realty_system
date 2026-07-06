import PrintPageShell from './PrintPageShell'
import { cleanMoney, formatDate, getNormalizedSoaRows, getValue, money, readPrintPayload } from './printUtils'

const text = (value) => (value === undefined || value === null || value === '-' ? '' : String(value))
const valueFrom = (source, keys, fallback = '') => text(getValue(source, keys, fallback))

const Check = ({ checked = false, label }) => (
  <span className="mr-4 inline-flex items-center gap-1 whitespace-nowrap align-middle">
    <span className="inline-flex h-[12px] w-[12px] items-center justify-center border border-black text-[9px] leading-none">
      {checked ? '✓' : ''}
    </span>
    <span>{label}</span>
  </span>
)

const Section = ({ children, blue = false, className = '' }) => (
  <div className={`${blue ? 'bg-[#1f4e79] text-white' : 'bg-[#d9d9d9] text-black'} border border-black py-[3px] text-center text-[11px] font-black uppercase leading-none ${className}`}>
    {children}
  </div>
)

const Cell = ({ children, className = '' }) => (
  <div className={`border border-black px-[5px] py-[3px] text-[10px] leading-tight ${className}`}>{children}</div>
)

const Label = ({ children }) => <span className="font-black">{children}</span>
const FieldLine = ({ label, value, className = '' }) => <Cell className={className}><Label>{label}</Label> {value}</Cell>

const getRowAmount = (rows, keyword) => rows
  .filter((row) => String(row.description || '').toLowerCase().includes(keyword))
  .reduce((sum, row) => sum + cleanMoney(row.dueAmount), 0)

const getMonthlyAmount = (rows) => {
  const row = rows.find((item) => String(item.description || '').toLowerCase().includes('monthly'))
  return cleanMoney(row?.dueAmount || 0)
}

const employmentChecked = (value, target) => String(value || '').toLowerCase().includes(target.toLowerCase())
const getKey = (prefix, key) => prefix ? `${prefix}${key}` : `${key.charAt(0).toLowerCase()}${key.slice(1)}`

const CivilStatusBox = ({ value = '' }) => {
  const civilStatus = value.toLowerCase()
  return (
    <Cell className="min-h-[58px]">
      <Label>Civil Status</Label><br />
      <div className="grid grid-cols-2 gap-y-[3px] pt-[4px]">
        <Check label="Single/Married" checked={civilStatus === 'single' || civilStatus === 'married'} />
        <Check label="Separated" checked={civilStatus === 'separated'} />
        <Check label="Annulled/Divorced" checked={civilStatus.includes('annulled') || civilStatus.includes('divorced')} />
        <Check label="Widow/er" checked={civilStatus.includes('widow')} />
      </div>
    </Cell>
  )
}

const BuyerBlock = ({ client, prefix = '', title, buyerName }) => {
  const get = (key) => valueFrom(client, [getKey(prefix, key)], '')

  return (
    <div>
      <FieldLine className="min-h-[26px] font-black" label={title} value={buyerName} />
      <div className="grid grid-cols-2">
        <FieldLine label="Date of Birth:" value={formatDate(get('BirthDate'))} />
        <FieldLine label="Place of Birth:" value={get('PlaceOfBirth')} />
      </div>
      <div className="grid grid-cols-2">
        <FieldLine label="Citizenship:" value={get('Citizenship')} />
        <FieldLine label="Gender:" value={get('Gender')} />
      </div>
      <CivilStatusBox value={get('CivilStatus')} />
      <div className="grid grid-cols-[1fr_105px]">
        <FieldLine label="Present Address:" value={get('PresentAddress')} className="min-h-[34px]" />
        <FieldLine label="Zip Code" value={get('PresentZipCode')} className="min-h-[34px]" />
      </div>
      <FieldLine label="Permanent Address:" value={get('PermanentAddress')} />
      <FieldLine label="Mobile No.:" value={get('ContactNo')} />
      <FieldLine label="Residence Phone Number:" value={get('ResidencePhoneNumber')} />
      <FieldLine label="E-mail Add:" value={get('Email')} />
      <FieldLine label="TIN:" value={get('Tin')} />
    </div>
  )
}

const WorkBlock = ({ client, prefix = '' }) => {
  const get = (key) => valueFrom(client, [getKey(prefix, key)], '')
  const employmentStatus = get('EmploymentStatus')
  const otherChecked = employmentStatus && !['private', 'business', 'government', 'professional', 'ngo', 'ofw', 'immigrant'].some((item) => employmentChecked(employmentStatus, item))

  return (
    <div>
      <Section className="normal-case">Work/Business Information</Section>
      <Cell className="min-h-[88px]">
        <Label>Employment Status: (Please check)</Label>
        <div className="grid grid-cols-2 gap-y-[4px] pt-[5px]">
          <Check label="Employed - Private" checked={employmentChecked(employmentStatus, 'private')} />
          <Check label="Self-Employed (With Business)" checked={employmentChecked(employmentStatus, 'business')} />
          <Check label="Employed Government" checked={employmentChecked(employmentStatus, 'government')} />
          <Check label="Self-Employed (Professional)" checked={employmentChecked(employmentStatus, 'professional')} />
          <Check label="Employed - NGO" checked={employmentChecked(employmentStatus, 'ngo')} />
          <Check label="OFW/immigrant" checked={employmentChecked(employmentStatus, 'ofw') || employmentChecked(employmentStatus, 'immigrant')} />
        </div>
        <div className="pt-[3px]"><Label>Other:</Label> {otherChecked ? employmentStatus : ''}</div>
      </Cell>
      <FieldLine label="Employer/Business Name:" value={get('EmployerBusinessName')} />
      <div className="grid grid-cols-[1fr_105px]">
        <FieldLine label="Employer/Business Address:" value={get('EmployerBusinessAddress')} />
        <FieldLine label="Zip Code:" value={get('EmployerZipCode')} />
      </div>
      <FieldLine label="Nature of Work/Business:" value={get('NatureOfWorkBusiness')} />
      <FieldLine label="Occupation/Position/Title:" value={get('OccupationPositionTitle')} />
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
      <section className="print-page mx-auto h-[297mm] w-[210mm] bg-white p-[8mm] text-black shadow-lg print:p-[7mm] print:shadow-none">
        <div className="h-full border-2 border-black font-sans text-[10px] leading-tight">
          <div className="px-[7px] py-[5px]">
            <h1 className="text-[15px] font-black leading-none">Offer To Buy &amp; Buyer&apos;s Profile</h1>
            <p className="mt-[2px] text-[12px] font-black">Real Estate Sales - For Individual</p>
            <div className="mt-[4px] grid grid-cols-[1fr_250px_170px] items-center gap-2">
              <p>
                <Label>Buyer Type</Label>{' '}
                <Check label="Single" checked={buyerType === 'single'} />
                <Check label="Spouses" checked={buyerType === 'spouses'} />
                <Check label="and Account" checked={buyerType === 'and_account'} />
              </p>
              <div className="grid grid-cols-[85px_1fr] items-center"><Label>Sales Officer:</Label><span className="min-h-[20px] border border-black px-1 font-bold">{seller}</span></div>
              <p><Label>Date Received:</Label> {formatDate(valueFrom(client, ['dateReceived'], valueFrom(listing, ['client_unit_created'], '')))}</p>
            </div>
          </div>

          <Section className="py-[5px] text-[16px]">PROPERTY DESCRIPTION</Section>
          <Cell className="min-h-[36px] text-[13px]"><Label>Location:</Label> {valueFrom(listing, ['project_location', 'location'], '')}</Cell>
          <div className="grid grid-cols-[1.05fr_1.05fr_1fr_2.2fr]">
            <FieldLine label="Property Type:" value={valueFrom(listing, ['lot_type'], '')} />
            <FieldLine label="Lot Area (sqm):" value={valueFrom(listing, ['lotAreaSqm', 'area'], '')} />
            <FieldLine label="Classification:" value={valueFrom(listing, ['classification', 'lot_type'], '')} />
            <FieldLine label="Description/Improvements:" value={`Unit ${valueFrom(listing, ['unit_id', 'unitCode'], '')}`} />
          </div>

          <Section>OFFER TERMS AND CONDITIONS</Section>
          <div className="border border-black py-[4px] text-center text-[9.5px] italic">
            I/We, hereby offer to purchase the property described above under the following terms and conditions.
          </div>

          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[160px_1fr]">
              <Cell className="col-span-2 min-h-[72px] font-black"><Check label="CASH" checked={modeOfPayment === 'cash'} /></Cell>
              <FieldLine label="Purchase Price:" value={modeOfPayment === 'cash' ? money(tcp) : ''} />
              <Cell />
              <FieldLine label="Reservation Fee:" value={modeOfPayment === 'cash' ? money(reservationFee) : ''} />
              <Cell />
              <FieldLine label="Balance:" value={modeOfPayment === 'cash' ? money(balance) : ''} className="min-h-[42px]" />
              <Cell className="min-h-[42px]" />
              <FieldLine label="Deferred Cash:" value="" className="min-h-[62px]" />
              <Cell className="min-h-[62px]" />
            </div>
            <div className="grid grid-cols-[170px_1fr]">
              <Cell className="col-span-2 min-h-[72px] font-black"><Check label="INSTALLMENT/In-house Financing" checked={modeOfPayment !== 'cash'} /></Cell>
              <FieldLine label="Purchase Price:" value={money(tcp)} />
              <Cell />
              <FieldLine label="Reservation Fee:" value={money(reservationFee)} />
              <Cell />
              <FieldLine label="Downpayment:" value={money(downpayment)} />
              <Cell />
              <FieldLine label="Balance:" value={money(balance)} className="min-h-[42px]" />
              <Cell className="min-h-[42px]" />
              <FieldLine label="Terms (months/years to pay):" value={`${monthlyTerms} months`} />
              <Cell />
              <FieldLine label="Interest Rate:" value={valueFrom(listing, ['interestRate'], '0.00%')} />
              <Cell />
              <FieldLine label="Monthly Amortization:" value={money(monthly)} />
              <Cell />
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
            <Cell className="min-h-[46px] text-center"><Label>PRINCIPAL</Label><br />{monthlyIncome ? money(monthlyIncome) : ''}</Cell>
            <Cell className="min-h-[46px] text-center"><Label>SPOUSE/SECOND BUYER</Label><br />{secondMonthlyIncome ? money(secondMonthlyIncome) : ''}</Cell>
            <Cell className="min-h-[46px] text-center"><Label>TOTAL</Label><br />{monthlyIncome || secondMonthlyIncome ? money(monthlyIncome + secondMonthlyIncome) : ''}</Cell>
          </div>

          <Section blue className="py-[5px]">SIGNATURES of BUYER/S</Section>
          <div className="grid grid-cols-2">
            <Cell className="h-[76px] pt-[56px] text-center font-black">Signature over Printed Name of Principal Buyer</Cell>
            <Cell className="h-[76px] pt-[56px] text-center font-black">Signature over Printed Name of Spouse/Second Buyer</Cell>
          </div>

          <Section>SALES AGENT:</Section>
          <div className="grid grid-cols-[1.2fr_160px_1.6fr]">
            <FieldLine label="Name:" value={seller} />
            <FieldLine label="TIN No.:" value="" />
            <FieldLine label="Address:" value="" />
          </div>
          <div className="grid grid-cols-3">
            <Cell className="min-h-[26px]"><Label>Last Name</Label></Cell>
            <Cell className="min-h-[26px]"><Label>First Name</Label></Cell>
            <Cell className="min-h-[26px]"><Label>Middle Name</Label></Cell>
          </div>
        </div>
      </section>
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage
