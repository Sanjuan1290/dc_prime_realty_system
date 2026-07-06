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

const OfferToBuyPrintPage = () => {
  const { listing = {}, client = {} } = readPrintPayload()

  const tcp = cleanMoney(getValue(listing, ['tcpAmount', 'tcp'], 0))
  const reservationFee = cleanMoney(getValue(listing, ['reservationFee'], 0))
  const downpayment = cleanMoney(getValue(listing, ['downpayment'], 0))
  const balance = cleanMoney(
    getValue(listing, ['balanceAmount', 'balance'], tcp - reservationFee - downpayment)
  )
  const monthly = cleanMoney(getValue(listing, ['monthlyAmortization'], 0))

  const buyerType = getValue(client, ['buyerType'], 'single')
  const isSpouses = buyerType === 'spouses'
  const isAndAccount = buyerType === 'and_account'

  const buyerName = getValue(
    client,
    ['buyerName'],
    getValue(listing, ['buyer_name'], '-')
  )
  const secondBuyerName = getValue(client, ['secondBuyerName'], '')
  const seller = getValue(
    client,
    ['seller', 'salesOfficer'],
    getValue(listing, ['seller'], '-')
  )

  const TermsRow = ({ label, value }) => (
    <>
      <PrintCell className="font-black">{label}</PrintCell>
      <PrintCell>{value}</PrintCell>
    </>
  )

  return (
    <PrintPageShell title="Offer to Buy">
      <div className="mx-auto w-[920px] bg-white text-black shadow-lg print:shadow-none">
        <div className="border border-black text-[10px]">
          <div className="p-2">
            <h1 className="text-[16px] font-black leading-none">
              Offer To Buy &amp; Buyer&apos;s Profile
            </h1>

            <p className="mt-1 font-black">
              Real Estate Sales — For Individual
            </p>

            <div className="mt-1 grid grid-cols-[1fr_180px_180px] gap-2">
              <p>
                Buyer Type{' '}
                <CheckBox label="Single" checked={buyerType === 'single'} />
                <CheckBox label="Spouses" checked={isSpouses} />
                <CheckBox label="and Account" checked={isAndAccount} />
              </p>

              <p>
                Sales Officer: <span className="font-black">{seller}</span>
              </p>

              <p>
                Date Received:{' '}
                <span className="font-black">
                  {getValue(client, ['dateReceived'], new Date().toISOString().slice(0, 10))}
                </span>
              </p>
            </div>
          </div>

          <PrintHeaderCell>PROPERTY DESCRIPTION</PrintHeaderCell>

          <PrintCell>
            <span className="font-black">Location:</span>{' '}
            {getValue(listing, ['project_location', 'location'], '-')}
          </PrintCell>

          <div className="grid grid-cols-4">
            <PrintCell>
              <span className="font-black">Property Type:</span>{' '}
              {getValue(listing, ['lot_type'], 'Inner')}
            </PrintCell>

            <PrintCell>
              <span className="font-black">Lot Area (sqm):</span>{' '}
              {getValue(listing, ['lotAreaSqm', 'lot_area_sqm'], 300)}
            </PrintCell>

            <PrintCell>
              <span className="font-black">Classification:</span>{' '}
              {getValue(listing, ['classification'], getValue(listing, ['lot_type'], 'Inner'))}
            </PrintCell>

            <PrintCell>
              <span className="font-black">Description/Improvements:</span>{' '}
              Unit {getValue(listing, ['unit_id', 'unitCode'], '-')}
            </PrintCell>
          </div>

          <PrintHeaderCell>OFFER TERMS AND CONDITIONS</PrintHeaderCell>

          <div className="border border-black py-1 text-center text-[10px] italic">
            I/We hereby offer to purchase the property described above under the following terms and conditions.
          </div>

          <div className="grid grid-cols-2">
            <div className="grid grid-cols-[230px_1fr]">
              <PrintCell className="col-span-2 font-black">
                <CheckBox label="CASH" />
              </PrintCell>

              <TermsRow label="Purchase Price:" value="" />
              <TermsRow label="Reservation Fee:" value="" />
              <TermsRow label="Balance:" value="" />
              <TermsRow label="Deferred Cash:" value="" />
            </div>

            <div className="grid grid-cols-[230px_1fr]">
              <PrintCell className="col-span-2 font-black">
                <CheckBox label="INSTALLMENT/In-house Financing" checked />
              </PrintCell>

              <TermsRow label="Purchase Price:" value={money(tcp)} />
              <TermsRow label="Reservation Fee:" value={money(reservationFee)} />
              <TermsRow label="Downpayment:" value={money(downpayment)} />
              <TermsRow label="Balance:" value={money(balance)} />
              <TermsRow
                label="Terms (months/years to pay):"
                value={getValue(listing, ['terms'], '36 months')}
              />
              <TermsRow
                label="Interest Rate:"
                value={getValue(listing, ['interestRate'], '0.00%')}
              />
              <TermsRow label="Monthly Amortization:" value={money(monthly)} />
            </div>
          </div>

          <PrintHeaderCell>INDIVIDUAL BUYER/S INFORMATION</PrintHeaderCell>

          <div className="grid grid-cols-2">
            <div className="grid grid-cols-2">
              <PrintCell className="col-span-2">
                <span className="font-black">Principal Full-name:</span> {buyerName}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Date of Birth:</span>{' '}
                {getValue(client, ['birthDate'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Place of Birth:</span>{' '}
                {getValue(client, ['placeOfBirth'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Citizenship:</span>{' '}
                {getValue(client, ['citizenship'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Gender:</span>{' '}
                {getValue(client, ['gender'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Civil Status:</span>{' '}
                <CheckBox label="Single" checked={getValue(client, ['civilStatus'], '') === 'Single'} />
                <CheckBox label="Married" checked={getValue(client, ['civilStatus'], '') === 'Married'} />
                <CheckBox label="Separated" />
                <CheckBox label="Annulled/Divorced" />
                <CheckBox label="Widow/er" />
              </PrintCell>

              <PrintCell>
                <span className="font-black">Present Address:</span>{' '}
                {getValue(client, ['presentAddress'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Zip Code:</span>{' '}
                {getValue(client, ['presentZipCode'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Permanent Address:</span>{' '}
                {getValue(client, ['permanentAddress'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Mobile No.:</span>{' '}
                {getValue(client, ['contactNo'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Residence Phone Number:</span>{' '}
                {getValue(client, ['residencePhoneNumber'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">E-mail Add:</span>{' '}
                {getValue(client, ['email'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">TIN:</span>{' '}
                {getValue(client, ['tin'], '-')}
              </PrintCell>
            </div>

            <div className="grid grid-cols-2">
              <PrintCell className="col-span-2">
                <span className="font-black">Spouse/Second Buyer&apos;s Name:</span>{' '}
                {secondBuyerName || '-'}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Date of Birth:</span>{' '}
                {getValue(client, ['secondBuyerBirthDate'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Place of Birth:</span>{' '}
                {getValue(client, ['secondBuyerPlaceOfBirth'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Citizenship:</span>{' '}
                {getValue(client, ['secondBuyerCitizenship'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Gender:</span>{' '}
                {getValue(client, ['secondBuyerGender'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Civil Status:</span>{' '}
                <CheckBox label="Single" />
                <CheckBox label="Married" />
                <CheckBox label="Separated" />
                <CheckBox label="Annulled/Divorced" />
                <CheckBox label="Widow/er" />
              </PrintCell>

              <PrintCell>
                <span className="font-black">Present Address:</span>{' '}
                {getValue(client, ['secondBuyerPresentAddress'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Zip Code:</span>{' '}
                {getValue(client, ['secondBuyerPresentZipCode'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Permanent Address:</span>{' '}
                {getValue(client, ['secondBuyerPermanentAddress'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Mobile No.:</span>{' '}
                {getValue(client, ['secondBuyerContactNo'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">Residence Phone Number:</span>{' '}
                {getValue(client, ['secondBuyerResidencePhoneNumber'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">E-mail Add:</span>{' '}
                {getValue(client, ['secondBuyerEmail'], '-')}
              </PrintCell>

              <PrintCell className="col-span-2">
                <span className="font-black">TIN:</span>{' '}
                {getValue(client, ['secondBuyerTin'], '-')}
              </PrintCell>
            </div>
          </div>

          <div className="grid grid-cols-2">
            <div>
              <PrintHeaderCell>Work/Business Information</PrintHeaderCell>
              <PrintCell>
                <span className="font-black">Employment Status:</span>
                <br />
                <CheckBox label="Employed - Private" />
                <CheckBox label="Self-Employed (With Business)" />
                <br />
                <CheckBox label="Employed Government" />
                <CheckBox label="Self-Employed (Professional)" />
                <br />
                <CheckBox label="Employed - NGO" />
                <CheckBox label="OFW/immigrant" />
                <br />
                Other:
              </PrintCell>

              <PrintCell>
                <span className="font-black">Employer/Business Name:</span>{' '}
                {getValue(client, ['employerBusinessName'], '-')}
              </PrintCell>

              <div className="grid grid-cols-[1fr_115px]">
                <PrintCell>
                  <span className="font-black">Employer/Business Address:</span>{' '}
                  {getValue(client, ['employerBusinessAddress'], '-')}
                </PrintCell>
                <PrintCell>
                  <span className="font-black">Zip Code:</span>{' '}
                  {getValue(client, ['employerZipCode'], '-')}
                </PrintCell>
              </div>

              <PrintCell>
                <span className="font-black">Nature of Work/Business:</span>{' '}
                {getValue(client, ['natureOfWorkBusiness'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Occupation/Position/Title:</span>{' '}
                {getValue(client, ['occupationPositionTitle'], '-')}
              </PrintCell>
            </div>

            <div>
              <PrintHeaderCell>Work/Business Information</PrintHeaderCell>
              <PrintCell>
                <span className="font-black">Employment Status:</span>
                <br />
                <CheckBox label="Employed - Private" />
                <CheckBox label="Self-Employed (With Business)" />
                <br />
                <CheckBox label="Employed Government" />
                <CheckBox label="Self-Employed (Professional)" />
                <br />
                <CheckBox label="Employed - NGO" />
                <CheckBox label="OFW/immigrant" />
                <br />
                Other:
              </PrintCell>

              <PrintCell>
                <span className="font-black">Employer/Business Name:</span>{' '}
                {getValue(client, ['secondBuyerEmployerBusinessName'], '-')}
              </PrintCell>

              <div className="grid grid-cols-[1fr_115px]">
                <PrintCell>
                  <span className="font-black">Employer/Business Address:</span>{' '}
                  {getValue(client, ['secondBuyerEmployerBusinessAddress'], '-')}
                </PrintCell>
                <PrintCell>
                  <span className="font-black">Zip Code:</span>{' '}
                  {getValue(client, ['secondBuyerEmployerZipCode'], '-')}
                </PrintCell>
              </div>

              <PrintCell>
                <span className="font-black">Nature of Work/Business:</span>{' '}
                {getValue(client, ['secondBuyerNatureOfWorkBusiness'], '-')}
              </PrintCell>

              <PrintCell>
                <span className="font-black">Occupation/Position/Title:</span>{' '}
                {getValue(client, ['secondBuyerOccupationPositionTitle'], '-')}
              </PrintCell>
            </div>
          </div>

          <PrintHeaderCell>INCOME DETAILS (MONTHLY)</PrintHeaderCell>

          <div className="grid grid-cols-3">
            <PrintCell className="text-center">
              <span className="font-black">PRINCIPAL</span>
              <br />
              {money(getValue(client, ['monthlyIncome'], 0))}
            </PrintCell>

            <PrintCell className="text-center">
              <span className="font-black">SPOUSE/SECOND BUYER</span>
              <br />
              {money(getValue(client, ['secondBuyerMonthlyIncome'], 0))}
            </PrintCell>

            <PrintCell className="text-center">
              <span className="font-black">TOTAL</span>
              <br />
              {money(
                cleanMoney(getValue(client, ['monthlyIncome'], 0)) +
                  cleanMoney(getValue(client, ['secondBuyerMonthlyIncome'], 0))
              )}
            </PrintCell>
          </div>

          <div className="bg-[#1f4e79] py-2 text-center text-[11px] font-black text-white">
            SIGNATURES of BUYER/S
          </div>

          <div className="grid grid-cols-2">
            <PrintCell className="h-48 pt-36 text-center font-black">
              Signature over Printed Name of Principal Buyer
            </PrintCell>
            <PrintCell className="h-48 pt-36 text-center font-black">
              Signature over Printed Name of Spouse/Second Buyer
            </PrintCell>
          </div>

          <PrintHeaderCell>SALES AGENT:</PrintHeaderCell>

          <div className="grid grid-cols-[230px_230px_1fr]">
            <PrintCell>
              <span className="font-black">Name:</span> {seller}
            </PrintCell>
            <PrintCell>
              <span className="font-black">TIN No.:</span>
            </PrintCell>
            <PrintCell>
              <span className="font-black">Address:</span>
            </PrintCell>
          </div>
        </div>
      </div>
    </PrintPageShell>
  )
}

export default OfferToBuyPrintPage
