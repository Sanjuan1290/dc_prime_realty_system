import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, pick, titleCase } from './core/doubleCheckFormatters'

export const principalBuyerReviewFields = (data) => [
  { label: 'Buyer Type', value: pick(data, 'buyerType', 'buyer_type'), formatter: titleCase },
  { label: 'Last Name', value: pick(data, 'buyerLastName', 'buyer_last_name') },
  { label: 'First Name', value: pick(data, 'buyerFirstName', 'buyer_first_name') },
  { label: 'Middle Name', value: pick(data, 'buyerMiddleName', 'buyer_middle_name') },
  { label: 'Suffix', value: pick(data, 'buyerSuffix', 'buyer_suffix') },
  { label: 'Birth Date', value: pick(data, 'birthDate', 'buyer_birth_date'), formatter: formatDate },
  { label: 'Computed Age', value: pick(data, 'computedAge') },
  { label: 'Place of Birth', value: pick(data, 'placeOfBirth', 'buyer_place_of_birth') },
  { label: 'Citizenship', value: pick(data, 'citizenship', 'buyer_citizenship') },
  { label: 'Gender', value: pick(data, 'gender', 'buyer_gender'), formatter: titleCase },
  { label: 'Civil Status', value: pick(data, 'civilStatus', 'buyer_civil_status'), formatter: titleCase },
  { label: 'Mobile / Contact Number', value: pick(data, 'contactNo', 'buyer_contact_number') },
  { label: 'Residence Phone Number', value: pick(data, 'residencePhoneNumber', 'buyer_residence_phone_number') },
  { label: 'Email', value: pick(data, 'email', 'buyer_email') },
  { label: 'TIN', value: pick(data, 'tin', 'buyer_tin') },
  { label: 'Present Address', value: pick(data, 'presentAddress', 'buyer_present_address'), wide: true },
  { label: 'Present ZIP Code', value: pick(data, 'presentZipCode', 'buyer_present_zip_code') },
  { label: 'Permanent Address', value: pick(data, 'permanentAddress', 'buyer_permanent_address'), wide: true },
  { label: 'Permanent ZIP Code', value: pick(data, 'permanentZipCode', 'buyer_permanent_zip_code') },
]

export const buyerEmploymentReviewFields = (data, prefix = '') => {
  const key = (name) => prefix ? `${prefix}${name.charAt(0).toUpperCase()}${name.slice(1)}` : name
  const snakePrefix = prefix === 'secondBuyer' ? 'second_buyer_' : 'buyer_'
  return [
    { label: 'Employment Status', value: pick(data, key('employmentStatus'), `${snakePrefix}employment_status`), formatter: titleCase },
    { label: 'Employer / Business Name', value: pick(data, key('employerBusinessName'), `${snakePrefix}employer_business_name`) },
    { label: 'Employer ZIP Code', value: pick(data, key('employerZipCode'), `${snakePrefix}employer_zip_code`) },
    { label: 'Nature of Work / Business', value: pick(data, key('natureOfWorkBusiness'), `${snakePrefix}nature_of_work_business`) },
    { label: 'Occupation / Position', value: pick(data, key('occupationPositionTitle'), `${snakePrefix}occupation_position`) },
    { label: 'Monthly Income', value: pick(data, key('monthlyIncome'), `${snakePrefix}monthly_income`), formatter: money, tone: 'financial' },
    { label: 'Employer / Business Address', value: pick(data, key('employerBusinessAddress'), `${snakePrefix}employer_business_address`), wide: true },
  ]
}

export const secondBuyerReviewFields = (data) => [
  { label: 'Buyer Role', value: pick(data, 'secondBuyerRole', 'second_buyer_role'), formatter: titleCase },
  { label: 'Last Name', value: pick(data, 'secondBuyerLastName', 'second_buyer_last_name') },
  { label: 'First Name', value: pick(data, 'secondBuyerFirstName', 'second_buyer_first_name') },
  { label: 'Middle Name', value: pick(data, 'secondBuyerMiddleName', 'second_buyer_middle_name') },
  { label: 'Suffix', value: pick(data, 'secondBuyerSuffix', 'second_buyer_suffix') },
  { label: 'Birth Date', value: pick(data, 'secondBuyerBirthDate', 'second_buyer_birth_date'), formatter: formatDate },
  { label: 'Computed Age', value: pick(data, 'secondBuyerComputedAge') },
  { label: 'Place of Birth', value: pick(data, 'secondBuyerPlaceOfBirth', 'second_buyer_place_of_birth') },
  { label: 'Citizenship', value: pick(data, 'secondBuyerCitizenship', 'second_buyer_citizenship') },
  { label: 'Gender', value: pick(data, 'secondBuyerGender', 'second_buyer_gender'), formatter: titleCase },
  { label: 'Civil Status', value: pick(data, 'secondBuyerCivilStatus', 'second_buyer_civil_status'), formatter: titleCase },
  { label: 'Mobile / Contact Number', value: pick(data, 'secondBuyerContactNo', 'second_buyer_contact_number') },
  { label: 'Residence Phone Number', value: pick(data, 'secondBuyerResidencePhoneNumber', 'second_buyer_residence_phone_number') },
  { label: 'Email', value: pick(data, 'secondBuyerEmail', 'second_buyer_email') },
  { label: 'TIN', value: pick(data, 'secondBuyerTin', 'second_buyer_tin') },
  { label: 'Present Address', value: pick(data, 'secondBuyerPresentAddress', 'second_buyer_present_address'), wide: true },
  { label: 'Present ZIP Code', value: pick(data, 'secondBuyerPresentZipCode', 'second_buyer_present_zip_code') },
  { label: 'Permanent Address', value: pick(data, 'secondBuyerPermanentAddress', 'second_buyer_permanent_address'), wide: true },
  { label: 'Permanent ZIP Code', value: pick(data, 'secondBuyerPermanentZipCode', 'second_buyer_permanent_zip_code') },
]

export const hasSecondBuyerReviewData = (data) => {
  const buyerType = String(pick(data, 'buyerType', 'buyer_type') || 'single').toLowerCase()
  if (buyerType !== 'single') return true
  return ['secondBuyerFirstName', 'secondBuyerLastName', 'secondBuyerName', 'second_buyer_full_name'].some((key) => String(data?.[key] || '').trim())
}

const BuyerProfileDoubleCheck = ({ request, onConfirm, onCancel, additionalSteps = [] }) => {
  const data = request.data || {}
  const second = hasSecondBuyerReviewData(data)
  const steps = [
    { key: 'principal', title: 'Principal Buyer', content: <DoubleCheckSection title="Principal Buyer" helper="Verify identity, contact, and address information." tone="blue"><DoubleCheckFields fields={principalBuyerReviewFields(data)} /></DoubleCheckSection> },
    { key: 'employment', title: 'Work / Business', content: <DoubleCheckSection title="Principal Buyer Work / Business" helper="Verify work, business, occupation, and income information." tone="amber"><DoubleCheckFields fields={buyerEmploymentReviewFields(data)} /></DoubleCheckSection> },
    { key: 'second', title: 'Second Buyer', hidden: !second, content: <div className="space-y-4"><DoubleCheckSection title="Second Buyer" helper="Verify identity, contact, and address information for the spouse or co-buyer." tone="violet"><DoubleCheckFields fields={secondBuyerReviewFields(data)} /></DoubleCheckSection><DoubleCheckSection title="Second Buyer Work / Business" helper="Verify employment and income information." tone="amber"><DoubleCheckFields fields={buyerEmploymentReviewFields(data, 'secondBuyer')} /></DoubleCheckSection></div> },
    ...additionalSteps,
  ]
  return <DoubleCheckShell title={request.title || 'Review Buyer Profile'} description={request.description || 'Verify the buyer profile before saving.'} confirmLabel={request.confirmLabel || 'Confirm & Save Buyer Profile'} summary={pick(data, 'buyerName', 'buyer_full_name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default BuyerProfileDoubleCheck

