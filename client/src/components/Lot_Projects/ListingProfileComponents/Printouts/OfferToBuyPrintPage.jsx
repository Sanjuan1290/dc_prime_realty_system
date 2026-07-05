import PrintPageShell from './PrintPageShell'
import {
  CheckBox,
  PrintCell,
  PrintHeaderCell,
  cleanMoney,
  getValue,
  money,
  readPrintPayload,
} from './printUtils'

const InfoLine = ({ label, value }) => (
  <PrintCell>
    <span className="font-black">{label}</span> {value || '-'}
  </PrintCell>
)

const TermsRow = ({ label, value }) => (
  <>
    <PrintCell className="font-black">{label}</PrintCell>
    <PrintCell>{value}</PrintCell>
  </>
)

const EmploymentBlock = ({ source = {}, prefix = '' }) => {
  const status = getValue(source, [`${prefix}employmentStatus`, `${prefix}employment_status`], '')

  return (
    <div>
      <PrintHeaderCell>Work/Business Information</PrintHeaderCell>
      <PrintCell className="min-h-[58px]">
        <span className="font-black">Employment Status:</span>
        <br />
        <CheckBox label="Employed - Private" checked={status === 'Employed - Private'} />
        <CheckBox label="Self-Employed (With Business)" checked={status === 'Self-Employed (With Business)'} />
        <br />
        <CheckBox label="Employed Government" checked={status === 'Employed Government'} />
        <CheckBox label="Self-Employed (Professional)" checked={status === 'Self-Employed (Professional)'} />
        <br />
        <CheckBox label="Employed - NGO" checked={status === 'Employed - NGO'} />
        <CheckBox label="OFW/immigrant" checked={status === 'OFW/immigrant'} />
        <br />
        Other: {status && !['Employed - Private', 'Self-Employed (With Business)', 'Employed Government', 'Self-Employed (Professional)', 'Employed - NGO', 'OFW/immigrant'].includes(status) ? status : ''}
      </PrintCell>
      <InfoLine label="Employer/Business Name:" value={getValue(source, [`${prefix}employerBusinessName`, `${prefix}employer_business_name`], '')} />
      <div className="grid grid-cols-[1fr_120px]">
        <InfoLine label="Employer/Business Address:" value={getValue(source, [`${prefix}employerBusinessAddress`, `${prefix}employer_business_address`], '')} />
        <InfoLine label="Zip Code:" value={getValue(source, [`${prefix}employerZipCode`, `${prefix}employer_zip_code`], '')} />
      </div>
      <InfoLine label="Nature of Work/Business:" value={getValue(source, [`${prefix}natureOfWorkBusiness`, `${prefix}nature_of_work_business`], '')} />
      <InfoLine label="Occupation/Position/Title:" value={getValue(source, [`${prefix}occupationPositionTitle`, `${prefix}occupation_position_title`], '')} />
    </div>
  )
}

const OfferToBuyPrintPage = () => {
  const { listing = {}, client = {} } = readPrintPayload()

  const tcp = cleanMoney(getValue(listing, ['tcp', 'tcpAmount', 'lot_project_listing_tcp'], 0))
  const reservationFee = cleanMoney(getValue(listing, ['reservationFee', 'reservation_fee', 'lot_project_listing_reservation_fee'], 0))
  const downpayment = cleanMoney(getValue(listing, ['downpayment', 'downpaymentAmount', 'downpayment_amount'], 0))
  const balance = cleanMoney(getValue(listing, ['balanceAmount', 'balance'], tcp - reservationFee - downpayment))
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization', 'monthly_amortization'], 0))

  const buyerType = getValue(client, ['buyerType', 'buyer_type'], 'single')
  const isSingle = buyerType === 'single'
  const isSpouses = buyerType === 'spouses'
  const isAndAccount = buyerType === 'and_account'

  const buyerName = getValue(client, ['buyerName', 'buyer_full_name'], getValue(listing, ['buyer_name'], '-'))
  const secondBuyerName = getValue(client, ['secondBuyerName', 'second_buyer_full_name'], '')
  const seller = getValue(client, ['seller', 'salesOfficer', 'sales_officer'], getValue(listing, ['seller'], '-'))
  const civilStatus = getValue(client, ['civilStatus', 'buyer_civil_status'], '')
  const secondCivilStatus = getValue(client, ['secondBuyerCivilStatus', 'second_buyer_civil_status'], '')

  return (
    <PrintPageShell title="Offer to Buy & Buyer's Profile">
      <div className="mx-auto w-[794px] bg-white text-black shadow-lg print:w-full print:shadow-none">
        <div className="border border-black text-[8.5px] leading-tight">
          <div className="px-1.5 py-1">
            <h1 className="text-[14px] font-black leading-none">Offer To Buy &amp; Buyer&apos;s Profile</h1>
            <p className="mt-0.5 font-black">Real Estate Sales — For Individual</p>

            <div className="mt-1 grid grid-cols-[1fr_210px_150px] gap-1">
              <p>
                Buyer Type{' '}
                <CheckBox label="Single" checked={isSingle} />
                <CheckBox label="Spouses" checked={isSpouses} />
                <CheckBox label="and Account" checked={isAndAccount} />
              </p>
              <p>Sales Officer: <span className="font-black">{seller}</span></p>
              <p>Date Received: <span className="font-black">{getValue(client, ['dateReceived', 'date_received'], getValue(listing, ['reserved_at', 'created_at'], '-'))}</span></p>
            </div>
          </div>

          <PrintHeaderCell>PROPERTY DESCRIPTION</PrintHeaderCell>
          <PrintCell><span className="font-black">Location:</span> {getValue(listing, ['project_location', 'location'], '-')}</PrintCell>

          <div className="grid grid-cols-4">
            <InfoLine label="Property Type:" value={getValue(listing, ['lot_type', 'unitType', 'lot_project_listing_unit_type'], '-')} />
            <InfoLine label="Lot Area (sqm):" value={getValue(listing, ['lotAreaSqm', 'lot_area_sqm', 'area', 'lot_project_listing_area_sqm'], '-')} />
            <InfoLine label="Classification:" value={getValue(listing, ['classification', 'lot_type', 'unitType', 'lot_project_listing_unit_type'], '-')} />
            <InfoLine label="Description/Improvements:" value={`Unit ${getValue(listing, ['unit_id', 'unitCode', 'lot_project_listing_unit_id'], '-')}`} />
          </div>

          <PrintHeaderCell>OFFER TERMS AND CONDITIONS</PrintHeaderCell>
          <div className="border border-black py-1 text-center text-[8.5px] italic">I/We hereby offer to purchase the property described above under the following terms and conditions:</div>

          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[150px_1fr]">
              <PrintCell className="col-span-2 font-black"><CheckBox label="CASH" checked={getValue(listing, ['paymentMode', 'payment_mode'], '') === 'cash'} /></PrintCell>
              <TermsRow label="Purchase Price:" value={getValue(listing, ['paymentMode', 'payment_mode'], '') === 'cash' ? money(tcp) : ''} />
              <TermsRow label="Reservation Fee:" value={getValue(listing, ['paymentMode', 'payment_mode'], '') === 'cash' ? money(reservationFee) : ''} />
              <TermsRow label="Balance:" value={getValue(listing, ['paymentMode', 'payment_mode'], '') === 'cash' ? money(balance) : ''} />
              <TermsRow label="Deferred Cash:" value="" />
            </div>

            <div className="grid grid-cols-[150px_1fr]">
              <PrintCell className="col-span-2 font-black"><CheckBox label="INSTALLMENT/In-house Financing" checked={getValue(listing, ['paymentMode', 'payment_mode'], 'installment') !== 'cash'} /></PrintCell>
              <TermsRow label="Purchase Price:" value={money(tcp)} />
              <TermsRow label="Reservation Fee:" value={money(reservationFee)} />
              <TermsRow label="Downpayment:" value={money(downpayment)} />
              <TermsRow label="Balance:" value={money(balance)} />
              <TermsRow label="Terms (months/years to pay):" value={getValue(listing, ['terms', 'termsText'], '-')} />
              <TermsRow label="Interest Rate:" value={getValue(listing, ['interestRate', 'interest_rate'], '0.00%')} />
              <TermsRow label="Monthly Amortization:" value={money(monthly)} />
            </div>
          </div>

          <PrintHeaderCell>INDIVIDUAL BUYER/S INFORMATION</PrintHeaderCell>

          <div className="grid grid-cols-2">
            <div className="grid grid-cols-2">
              <PrintCell className="col-span-2"><span className="font-black">Principal Full-name:</span> {buyerName}</PrintCell>
              <InfoLine label="Date of Birth:" value={getValue(client, ['birthDate', 'buyer_birth_date'], '-')} />
              <InfoLine label="Place of Birth:" value={getValue(client, ['placeOfBirth', 'buyer_place_of_birth'], '-')} />
              <InfoLine label="Citizenship:" value={getValue(client, ['citizenship', 'buyer_citizenship'], '-')} />
              <InfoLine label="Gender:" value={getValue(client, ['gender', 'buyer_gender'], '-')} />
              <PrintCell className="col-span-2">
                <span className="font-black">Civil Status:</span>{' '}
                <CheckBox label="Single" checked={civilStatus === 'Single'} />
                <CheckBox label="Married" checked={civilStatus === 'Married'} />
                <CheckBox label="Separated" checked={civilStatus === 'Separated'} />
                <CheckBox label="Annulled/Divorced" checked={civilStatus === 'Annulled/Divorced'} />
                <CheckBox label="Widow/er" checked={civilStatus === 'Widow/er'} />
              </PrintCell>
              <InfoLine label="Present Address:" value={getValue(client, ['presentAddress', 'buyer_present_address'], '-')} />
              <InfoLine label="Zip Code:" value={getValue(client, ['presentZipCode', 'buyer_present_zip_code'], '')} />
              <PrintCell className="col-span-2"><span className="font-black">Permanent Address:</span> {getValue(client, ['permanentAddress', 'buyer_permanent_address'], '-')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">Mobile No.:</span> {getValue(client, ['contactNo', 'buyer_contact_number'], '-')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">Residence Phone Number:</span> {getValue(client, ['residencePhoneNumber'], '')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">E-mail Add:</span> {getValue(client, ['email', 'buyer_email'], '-')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">TIN:</span> {getValue(client, ['tin', 'buyer_tin'], '')}</PrintCell>
            </div>

            <div className="grid grid-cols-2">
              <PrintCell className="col-span-2"><span className="font-black">Spouse/Second Buyer&apos;s Name:</span> {secondBuyerName || ''}</PrintCell>
              <InfoLine label="Date of Birth:" value={getValue(client, ['secondBuyerBirthDate', 'second_buyer_birth_date'], '')} />
              <InfoLine label="Place of Birth:" value={getValue(client, ['secondBuyerPlaceOfBirth', 'second_buyer_place_of_birth'], '')} />
              <InfoLine label="Citizenship:" value={getValue(client, ['secondBuyerCitizenship', 'second_buyer_citizenship'], '')} />
              <InfoLine label="Gender:" value={getValue(client, ['secondBuyerGender', 'second_buyer_gender'], '')} />
              <PrintCell className="col-span-2">
                <span className="font-black">Civil Status:</span>{' '}
                <CheckBox label="Single" checked={secondCivilStatus === 'Single'} />
                <CheckBox label="Married" checked={secondCivilStatus === 'Married'} />
                <CheckBox label="Separated" checked={secondCivilStatus === 'Separated'} />
                <CheckBox label="Annulled/Divorced" checked={secondCivilStatus === 'Annulled/Divorced'} />
                <CheckBox label="Widow/er" checked={secondCivilStatus === 'Widow/er'} />
              </PrintCell>
              <InfoLine label="Present Address:" value={getValue(client, ['secondBuyerPresentAddress', 'second_buyer_present_address'], '')} />
              <InfoLine label="Zip Code:" value={getValue(client, ['secondBuyerPresentZipCode', 'second_buyer_present_zip_code'], '')} />
              <PrintCell className="col-span-2"><span className="font-black">Permanent Address:</span> {getValue(client, ['secondBuyerPermanentAddress', 'second_buyer_permanent_address'], '')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">Mobile No.:</span> {getValue(client, ['secondBuyerContactNo', 'second_buyer_contact_number'], '')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">Residence Phone Number:</span> {getValue(client, ['secondBuyerResidencePhoneNumber'], '')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">E-mail Add:</span> {getValue(client, ['secondBuyerEmail', 'second_buyer_email'], '')}</PrintCell>
              <PrintCell className="col-span-2"><span className="font-black">TIN:</span> {getValue(client, ['secondBuyerTin', 'second_buyer_tin'], '')}</PrintCell>
            </div>
          </div>

          <div className="grid grid-cols-2">
            <EmploymentBlock source={client} />
            <EmploymentBlock source={client} prefix="secondBuyer" />
          </div>

          <PrintHeaderCell>INCOME DETAILS (MONTHLY)</PrintHeaderCell>
          <div className="grid grid-cols-3">
            <PrintCell className="text-center"><span className="font-black">PRINCIPAL</span><br />{money(getValue(client, ['monthlyIncome', 'buyer_monthly_income'], 0))}</PrintCell>
            <PrintCell className="text-center"><span className="font-black">SPOUSE/SECOND BUYER</span><br />{money(getValue(client, ['secondBuyerMonthlyIncome', 'second_buyer_monthly_income'], 0))}</PrintCell>
            <PrintCell className="text-center"><span className="font-black">TOTAL</span><br />{money(cleanMoney(getValue(client, ['monthlyIncome', 'buyer_monthly_income'], 0)) + cleanMoney(getValue(client, ['secondBuyerMonthlyIncome', 'second_buyer_monthly_income'], 0)))}</PrintCell>
          </div>

          <div className="bg-[#1f4e79] py-1 text-center text-[9px] font-black text-white">SIGNATURES of BUYER/S</div>
          <div className="grid grid-cols-2">
            <PrintCell className="h-14 pt-9 text-center font-black">Signature over Printed Name of Principal Buyer</PrintCell>
            <PrintCell className="h-14 pt-9 text-center font-black">Signature over Printed Name of Spouse/Second Buyer</PrintCell>
          </div>

          <PrintHeaderCell>SALES AGENT:</PrintHeaderCell>
          <div className="grid grid-cols-[200px_200px_1fr]">
            <InfoLine label="Name:" value={seller} />
            <InfoLine label="TIN No.:" value={getValue(listing, ['seller_tin'], '')} />
            <InfoLine label="Address:" value={getValue(listing, ['seller_address'], '')} />
          </div>
        </div>
      </div>
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage
