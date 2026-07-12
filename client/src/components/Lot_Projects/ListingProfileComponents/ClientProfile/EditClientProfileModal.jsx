import { useEffect, useMemo, useState } from 'react'
import { FiAlertCircle, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const principalRequiredFields = [
  ['buyerLastName', 'Principal buyer last name'],
  ['buyerFirstName', 'Principal buyer first name'],
  ['buyerMiddleName', 'Principal buyer middle name'],
  ['buyerSuffix', 'Principal buyer suffix'],
  ['birthDate', 'Principal buyer birth date'],
  ['placeOfBirth', 'Principal buyer place of birth'],
  ['citizenship', 'Principal buyer citizenship'],
  ['gender', 'Principal buyer gender'],
  ['civilStatus', 'Principal buyer civil status'],
  ['contactNo', 'Principal buyer mobile number'],
  ['residencePhoneNumber', 'Principal buyer residence phone number'],
  ['email', 'Principal buyer email'],
  ['tin', 'Principal buyer TIN'],
  ['presentAddress', 'Principal buyer present address'],
  ['presentZipCode', 'Principal buyer present ZIP code'],
  ['permanentAddress', 'Principal buyer permanent address'],
  ['permanentZipCode', 'Principal buyer permanent ZIP code'],
  ['employmentStatus', 'Principal buyer employment status'],
  ['employerBusinessName', 'Principal buyer employer / business name'],
  ['employerZipCode', 'Principal buyer employer ZIP code'],
  ['natureOfWorkBusiness', 'Principal buyer nature of work / business'],
  ['occupationPositionTitle', 'Principal buyer occupation / position / title'],
  ['monthlyIncome', 'Principal buyer monthly income'],
  ['employerBusinessAddress', 'Principal buyer employer / business address'],
]

const secondBuyerRequiredFields = [
  ['secondBuyerRole', 'Spouse / second buyer role'],
  ['secondBuyerLastName', 'Spouse / second buyer last name'],
  ['secondBuyerFirstName', 'Spouse / second buyer first name'],
  ['secondBuyerMiddleName', 'Spouse / second buyer middle name'],
  ['secondBuyerSuffix', 'Spouse / second buyer suffix'],
  ['secondBuyerBirthDate', 'Spouse / second buyer birth date'],
  ['secondBuyerPlaceOfBirth', 'Spouse / second buyer place of birth'],
  ['secondBuyerCitizenship', 'Spouse / second buyer citizenship'],
  ['secondBuyerGender', 'Spouse / second buyer gender'],
  ['secondBuyerCivilStatus', 'Spouse / second buyer civil status'],
  ['secondBuyerContactNo', 'Spouse / second buyer mobile number'],
  ['secondBuyerResidencePhoneNumber', 'Spouse / second buyer residence phone number'],
  ['secondBuyerEmail', 'Spouse / second buyer email'],
  ['secondBuyerTin', 'Spouse / second buyer TIN'],
  ['secondBuyerPresentAddress', 'Spouse / second buyer present address'],
  ['secondBuyerPresentZipCode', 'Spouse / second buyer present ZIP code'],
  ['secondBuyerPermanentAddress', 'Spouse / second buyer permanent address'],
  ['secondBuyerPermanentZipCode', 'Spouse / second buyer permanent ZIP code'],
  ['secondBuyerEmploymentStatus', 'Spouse / second buyer employment status'],
  ['secondBuyerEmployerBusinessName', 'Spouse / second buyer employer / business name'],
  ['secondBuyerEmployerZipCode', 'Spouse / second buyer employer ZIP code'],
  ['secondBuyerNatureOfWorkBusiness', 'Spouse / second buyer nature of work / business'],
  ['secondBuyerOccupationPositionTitle', 'Spouse / second buyer occupation / position / title'],
  ['secondBuyerMonthlyIncome', 'Spouse / second buyer monthly income'],
  ['secondBuyerEmployerBusinessAddress', 'Spouse / second buyer employer / business address'],
]

const findMissingRequiredField = (form, fields) =>
  fields.find(([key]) => !String(form?.[key] ?? '').trim())

const emptyProfile = {
  profileStatus: 'incomplete',
  buyerType: 'single',

  buyerFirstName: '',
  buyerMiddleName: '',
  buyerLastName: '',
  buyerSuffix: '',
  buyerName: '',
  birthDate: '',
  placeOfBirth: '',
  computedAge: '-',
  citizenship: '',
  gender: '',
  civilStatus: '',
  contactNo: '',
  residencePhoneNumber: '',
  email: '',
  tin: '',
  presentAddress: '',
  presentZipCode: '',
  permanentAddress: '',
  permanentZipCode: '',

  employmentStatus: '',
  employerBusinessName: '',
  employerZipCode: '',
  natureOfWorkBusiness: '',
  occupationPositionTitle: '',
  monthlyIncome: '',
  employerBusinessAddress: '',

  secondBuyerRole: 'spouse',
  secondBuyerFirstName: '',
  secondBuyerMiddleName: '',
  secondBuyerLastName: '',
  secondBuyerSuffix: '',
  secondBuyerName: '',
  secondBuyerBirthDate: '',
  secondBuyerPlaceOfBirth: '',
  secondBuyerComputedAge: '-',
  secondBuyerCitizenship: '',
  secondBuyerGender: '',
  secondBuyerCivilStatus: '',
  secondBuyerContactNo: '',
  secondBuyerResidencePhoneNumber: '',
  secondBuyerEmail: '',
  secondBuyerTin: '',
  secondBuyerPresentAddress: '',
  secondBuyerPresentZipCode: '',
  secondBuyerPermanentAddress: '',
  secondBuyerPermanentZipCode: '',

  secondBuyerEmploymentStatus: '',
  secondBuyerEmployerBusinessName: '',
  secondBuyerEmployerZipCode: '',
  secondBuyerNatureOfWorkBusiness: '',
  secondBuyerOccupationPositionTitle: '',
  secondBuyerMonthlyIncome: '',
  secondBuyerEmployerBusinessAddress: '',
}

const buildDisplayName = ({ firstName = '', middleName = '', lastName = '', suffix = '' } = {}) =>
  [firstName, middleName, lastName, suffix]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')

const suffixValues = new Set(['jr', 'jr.', 'sr', 'sr.', 'ii', 'iii', 'iv', 'v'])
const compoundSurnamePrefixes = new Set(['san', 'santa', 'de', 'del', 'dela', 'da', 'dos', 'das', 'la', 'las', 'los', 'van', 'von'])

const firstFilledValue = (...values) => {
  const match = values.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
  return match === undefined ? '' : String(match).trim()
}

const normalizeDateValue = (value) => {
  if (!value) return ''
  const clean = String(value).trim()
  if (!clean || clean === '-') return ''
  const match = clean.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : clean
}

const parseLegacyFullName = (fullName = '') => {
  const clean = String(fullName || '').replace(/\s+/g, ' ').trim()
  if (!clean) return { firstName: '', middleName: '', lastName: '', suffix: '' }

  if (clean.includes(',')) {
    const [lastPart, ...remainingParts] = clean.split(',')
    const remaining = remainingParts.join(' ').trim().split(/\s+/).filter(Boolean)
    let suffix = ''

    if (remaining.length && suffixValues.has(remaining[remaining.length - 1].toLowerCase())) {
      suffix = remaining.pop()
    }

    return {
      lastName: lastPart.trim(),
      firstName: remaining.shift() || '',
      middleName: remaining.join(' '),
      suffix,
    }
  }

  const parts = clean.split(' ').filter(Boolean)
  let suffix = ''

  if (parts.length && suffixValues.has(parts[parts.length - 1].toLowerCase())) {
    suffix = parts.pop()
  }

  if (parts.length === 1) {
    return { firstName: parts[0], middleName: '', lastName: '', suffix }
  }

  const firstName = parts.shift() || ''
  let surnameTokenCount = 1
  const lowerParts = parts.map((part) => part.toLowerCase())

  if (
    lowerParts.length >= 3 &&
    lowerParts[lowerParts.length - 3] === 'de' &&
    ['la', 'las', 'los'].includes(lowerParts[lowerParts.length - 2])
  ) {
    surnameTokenCount = 3
  } else if (
    lowerParts.length >= 2 &&
    compoundSurnamePrefixes.has(lowerParts[lowerParts.length - 2])
  ) {
    surnameTokenCount = 2
  }

  const lastName = parts.splice(-surnameTokenCount).join(' ')

  return {
    firstName,
    lastName,
    middleName: parts.join(' '),
    suffix,
  }
}

const normalizeClientProfile = (client = {}) => {
  const buyerFullName = firstFilledValue(client.buyerName, client.buyer_full_name)
  const buyerNameParts = parseLegacyFullName(buyerFullName)
  const secondBuyerFullName = firstFilledValue(client.secondBuyerName, client.second_buyer_full_name)
  const secondBuyerNameParts = parseLegacyFullName(secondBuyerFullName)

  const birthDate = normalizeDateValue(firstFilledValue(client.birthDate, client.buyer_birth_date))
  const secondBuyerBirthDate = normalizeDateValue(
    firstFilledValue(client.secondBuyerBirthDate, client.second_buyer_birth_date)
  )

  const normalized = {
    ...emptyProfile,
    ...client,
    profileStatus: firstFilledValue(client.profileStatus, client.profile_status) || 'incomplete',
    buyerType: firstFilledValue(client.buyerType, client.buyer_type) || 'single',

    buyerFirstName: firstFilledValue(client.buyerFirstName, client.buyer_first_name, buyerNameParts.firstName),
    buyerMiddleName: firstFilledValue(client.buyerMiddleName, client.buyer_middle_name, buyerNameParts.middleName),
    buyerLastName: firstFilledValue(client.buyerLastName, client.buyer_last_name, buyerNameParts.lastName),
    buyerSuffix: firstFilledValue(client.buyerSuffix, client.buyer_suffix, buyerNameParts.suffix),
    birthDate,
    computedAge: computeAge(birthDate),
    placeOfBirth: firstFilledValue(client.placeOfBirth, client.buyer_place_of_birth),
    citizenship: firstFilledValue(client.citizenship, client.buyer_citizenship),
    gender: firstFilledValue(client.gender, client.buyer_gender),
    civilStatus: firstFilledValue(client.civilStatus, client.buyer_civil_status),
    contactNo: firstFilledValue(client.contactNo, client.buyer_contact_number),
    residencePhoneNumber: firstFilledValue(client.residencePhoneNumber, client.buyer_residence_phone_number),
    email: firstFilledValue(client.email, client.buyer_email),
    tin: firstFilledValue(client.tin, client.buyer_tin),
    presentAddress: firstFilledValue(client.presentAddress, client.buyer_present_address),
    presentZipCode: firstFilledValue(client.presentZipCode, client.buyer_present_zip_code),
    permanentAddress: firstFilledValue(client.permanentAddress, client.buyer_permanent_address),
    permanentZipCode: firstFilledValue(client.permanentZipCode, client.buyer_permanent_zip_code),

    employmentStatus: firstFilledValue(client.employmentStatus, client.buyer_employment_status),
    employerBusinessName: firstFilledValue(client.employerBusinessName, client.buyer_employer_business_name),
    employerZipCode: firstFilledValue(client.employerZipCode, client.buyer_employer_zip_code),
    natureOfWorkBusiness: firstFilledValue(client.natureOfWorkBusiness, client.buyer_nature_of_work_business),
    occupationPositionTitle: firstFilledValue(client.occupationPositionTitle, client.buyer_occupation_position),
    monthlyIncome: firstFilledValue(client.monthlyIncome, client.buyer_monthly_income),
    employerBusinessAddress: firstFilledValue(client.employerBusinessAddress, client.buyer_employer_business_address),

    secondBuyerRole: firstFilledValue(client.secondBuyerRole, client.second_buyer_role) || 'spouse',
    secondBuyerFirstName: firstFilledValue(
      client.secondBuyerFirstName,
      client.second_buyer_first_name,
      secondBuyerNameParts.firstName
    ),
    secondBuyerMiddleName: firstFilledValue(
      client.secondBuyerMiddleName,
      client.second_buyer_middle_name,
      secondBuyerNameParts.middleName
    ),
    secondBuyerLastName: firstFilledValue(
      client.secondBuyerLastName,
      client.second_buyer_last_name,
      secondBuyerNameParts.lastName
    ),
    secondBuyerSuffix: firstFilledValue(
      client.secondBuyerSuffix,
      client.second_buyer_suffix,
      secondBuyerNameParts.suffix
    ),
    secondBuyerBirthDate,
    secondBuyerComputedAge: computeAge(secondBuyerBirthDate),
    secondBuyerPlaceOfBirth: firstFilledValue(client.secondBuyerPlaceOfBirth, client.second_buyer_place_of_birth),
    secondBuyerCitizenship: firstFilledValue(client.secondBuyerCitizenship, client.second_buyer_citizenship),
    secondBuyerGender: firstFilledValue(client.secondBuyerGender, client.second_buyer_gender),
    secondBuyerCivilStatus: firstFilledValue(client.secondBuyerCivilStatus, client.second_buyer_civil_status),
    secondBuyerContactNo: firstFilledValue(client.secondBuyerContactNo, client.second_buyer_contact_number),
    secondBuyerResidencePhoneNumber: firstFilledValue(
      client.secondBuyerResidencePhoneNumber,
      client.second_buyer_residence_phone_number
    ),
    secondBuyerEmail: firstFilledValue(client.secondBuyerEmail, client.second_buyer_email),
    secondBuyerTin: firstFilledValue(client.secondBuyerTin, client.second_buyer_tin),
    secondBuyerPresentAddress: firstFilledValue(client.secondBuyerPresentAddress, client.second_buyer_present_address),
    secondBuyerPresentZipCode: firstFilledValue(client.secondBuyerPresentZipCode, client.second_buyer_present_zip_code),
    secondBuyerPermanentAddress: firstFilledValue(
      client.secondBuyerPermanentAddress,
      client.second_buyer_permanent_address
    ),
    secondBuyerPermanentZipCode: firstFilledValue(
      client.secondBuyerPermanentZipCode,
      client.second_buyer_permanent_zip_code
    ),

    secondBuyerEmploymentStatus: firstFilledValue(
      client.secondBuyerEmploymentStatus,
      client.second_buyer_employment_status
    ),
    secondBuyerEmployerBusinessName: firstFilledValue(
      client.secondBuyerEmployerBusinessName,
      client.second_buyer_employer_business_name
    ),
    secondBuyerEmployerZipCode: firstFilledValue(
      client.secondBuyerEmployerZipCode,
      client.second_buyer_employer_zip_code
    ),
    secondBuyerNatureOfWorkBusiness: firstFilledValue(
      client.secondBuyerNatureOfWorkBusiness,
      client.second_buyer_nature_of_work_business
    ),
    secondBuyerOccupationPositionTitle: firstFilledValue(
      client.secondBuyerOccupationPositionTitle,
      client.second_buyer_occupation_position
    ),
    secondBuyerMonthlyIncome: firstFilledValue(client.secondBuyerMonthlyIncome, client.second_buyer_monthly_income),
    secondBuyerEmployerBusinessAddress: firstFilledValue(
      client.secondBuyerEmployerBusinessAddress,
      client.second_buyer_employer_business_address
    ),
  }

  normalized.buyerName = buyerFullName || buildDisplayName({
    firstName: normalized.buyerFirstName,
    middleName: normalized.buyerMiddleName,
    lastName: normalized.buyerLastName,
    suffix: normalized.buyerSuffix,
  })

  normalized.secondBuyerName = secondBuyerFullName || buildDisplayName({
    firstName: normalized.secondBuyerFirstName,
    middleName: normalized.secondBuyerMiddleName,
    lastName: normalized.secondBuyerLastName,
    suffix: normalized.secondBuyerSuffix,
  })

  return normalized
}

const computeAge = (birthDate) => {
  if (!birthDate) return '-'

  const birth = new Date(birthDate)
  const today = new Date()

  if (Number.isNaN(birth.getTime())) return '-'

  let age = today.getFullYear() - birth.getFullYear()
  const monthDiff = today.getMonth() - birth.getMonth()

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1
  }

  return age >= 0 ? String(age) : '-'
}

const Input = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  disabled = false,
  required = false,
  helper,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label} {required ? <span className="text-red-500">*</span> : null}</span>
    <input
      type={type}
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      className={`h-10 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 ${
        disabled
          ? 'cursor-not-allowed bg-slate-100 text-slate-500'
          : 'bg-white focus:border-blue-400 focus:ring-4 focus:ring-blue-50'
      }`}
    />
    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const Select = ({ label, value, onChange, children, disabled = false, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-600">{label} {required ? <span className="text-red-500">*</span> : null}</span>
    <select
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      disabled={disabled}
      required={required}
      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
    >
      {children}
    </select>
  </label>
)

const Section = ({ title, children }) => (
  <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <h3 className="mb-4 text-sm font-black text-slate-800">{title}</h3>
    {children}
  </section>
)

const PersonForm = ({ title, form, setForm, second = false }) => {
  const key = (field) => {
    if (!second) return field
    return `secondBuyer${field.charAt(0).toUpperCase()}${field.slice(1)}`
  }

  const getValue = (field) => form[key(field)]

  const updateValue = (field, value) => {
    const targetKey = key(field)

    setForm((current) => {
      const next = {
        ...current,
        [targetKey]: value,
      }

      if (['firstName', 'middleName', 'lastName', 'suffix'].includes(field)) {
        next[second ? 'secondBuyerName' : 'buyerName'] = buildDisplayName({
          firstName: next[key('firstName')],
          middleName: next[key('middleName')],
          lastName: next[key('lastName')],
          suffix: next[key('suffix')],
        })
      }

      if (field === 'birthDate') {
        next[key('computedAge')] = computeAge(value)
      }

      return next
    })
  }

  return (
    <Section title={title}>
      <p className="mb-4 -mt-2 text-xs font-semibold text-slate-500">
        All fields are required. Enter N/A when a field does not apply.
      </p>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {second ? (
          <Select
            label="Buyer Role"
            value={form.secondBuyerRole}
            onChange={(value) =>
              setForm((current) => ({ ...current, secondBuyerRole: value }))
            }
            required
          >
            <option value="spouse">Spouse</option>
            <option value="co_owner">Co-owner</option>
            <option value="second_buyer">Second Buyer</option>
          </Select>
        ) : null}

        <Input
          label="Last Name"
          value={getValue('lastName')}
          onChange={(value) => updateValue('lastName', value)}
          required
        />

        <Input
          label="First Name"
          value={getValue('firstName')}
          onChange={(value) => updateValue('firstName', value)}
          required
        />

        <Input
          label="Middle Name"
          placeholder="Middle name or N/A"
          helper="Enter N/A when the field does not apply."
          value={getValue('middleName')}
          onChange={(value) => updateValue('middleName', value)}
          required
        />

        <Input
          label="Suffix"
          value={getValue('suffix')}
          onChange={(value) => updateValue('suffix', value)}
          placeholder="Jr., Sr., III, or N/A"
          helper="Enter N/A when the field does not apply."
          required
        />

        <Input
          label="Birth Date"
          type="date"
          value={getValue('birthDate')}
          onChange={(value) => updateValue('birthDate', value)}
          required
        />

        <Input
          label="Computed Age"
          value={getValue('computedAge')}
          onChange={() => null}
          disabled
        />

        <Input
          label="Place of Birth"
          value={getValue('placeOfBirth')}
          onChange={(value) => updateValue('placeOfBirth', value)}
          required
        />

        <Input
          label="Citizenship"
          value={getValue('citizenship')}
          onChange={(value) => updateValue('citizenship', value)}
          required
        />

        <Select
          label="Gender"
          value={getValue('gender')}
          onChange={(value) => updateValue('gender', value)}
          required
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </Select>

        <Select
          label="Civil Status"
          value={getValue('civilStatus')}
          onChange={(value) => updateValue('civilStatus', value)}
          required
        >
          <option value="">Select civil status</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Separated">Separated</option>
          <option value="Annulled/Divorced">Annulled/Divorced</option>
          <option value="Widow/er">Widow/er</option>
        </Select>

        <Input
          label="Mobile Number / Contact Number"
          value={second ? form.secondBuyerContactNo : form.contactNo}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              [second ? 'secondBuyerContactNo' : 'contactNo']: value,
            }))
          }
          required
        />

        <Input
          label="Residence Phone Number"
          placeholder="Phone number or N/A"
          helper="Enter N/A when the field does not apply."
          value={getValue('residencePhoneNumber')}
          onChange={(value) => updateValue('residencePhoneNumber', value)}
          required
        />

        <Input
          label="Email"
          type="email"
          value={second ? form.secondBuyerEmail : form.email}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              [second ? 'secondBuyerEmail' : 'email']: value,
            }))
          }
          required
        />

        <Input
          label="TIN"
          placeholder="TIN or N/A"
          helper="Enter N/A when the field does not apply."
          value={second ? form.secondBuyerTin : form.tin}
          onChange={(value) =>
            setForm((current) => ({
              ...current,
              [second ? 'secondBuyerTin' : 'tin']: value,
            }))
          }
          required
        />

        <Input
          label="Present Address"
          value={getValue('presentAddress')}
          onChange={(value) => updateValue('presentAddress', value)}
          required
        />

        <Input
          label="Present ZIP Code"
          value={getValue('presentZipCode')}
          onChange={(value) => updateValue('presentZipCode', value)}
          required
        />

        <Input
          label="Permanent Address"
          value={getValue('permanentAddress')}
          onChange={(value) => updateValue('permanentAddress', value)}
          required
        />

        <Input
          label="Permanent ZIP Code"
          value={getValue('permanentZipCode')}
          onChange={(value) => updateValue('permanentZipCode', value)}
          required
        />
      </div>
    </Section>
  )
}

const WorkBusinessForm = ({ title, form, setForm, second = false }) => {
  const prefix = second ? 'secondBuyer' : ''

  const key = (field) => {
    if (!second) return field
    return `${prefix}${field.charAt(0).toUpperCase()}${field.slice(1)}`
  }

  const update = (field, value) => {
    setForm((current) => ({
      ...current,
      [key(field)]: value,
    }))
  }

  const value = (field) => form[key(field)] || ''

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-black text-slate-800">{title}</h4>
      <p className="mb-4 mt-1 text-xs font-semibold text-slate-500">
        All fields are required. Enter N/A when a field does not apply.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Select
          label="Employment Status"
          value={value('employmentStatus')}
          onChange={(nextValue) => update('employmentStatus', nextValue)}
          required
        >
          <option value="">Select status</option>
          <option value="Employed - Private">Employed - Private</option>
          <option value="Self-Employed">Self-Employed</option>
          <option value="Employed - Government">Employed - Government</option>
          <option value="Professional">Professional</option>
          <option value="OFW">OFW</option>
          <option value="Other">Other</option>
        </Select>

        <Input
          label="Employer / Business Name"
          value={value('employerBusinessName')}
          onChange={(nextValue) => update('employerBusinessName', nextValue)}
          required
        />

        <Input
          label="Employer ZIP Code"
          value={value('employerZipCode')}
          onChange={(nextValue) => update('employerZipCode', nextValue)}
          required
        />

        <Input
          label="Nature of Work / Business"
          value={value('natureOfWorkBusiness')}
          onChange={(nextValue) => update('natureOfWorkBusiness', nextValue)}
          required
        />

        <Input
          label="Occupation / Position / Title"
          value={value('occupationPositionTitle')}
          onChange={(nextValue) => update('occupationPositionTitle', nextValue)}
          required
        />

        <Input
          label="Monthly Income"
          type="number"
          value={value('monthlyIncome')}
          onChange={(nextValue) => update('monthlyIncome', nextValue)}
          placeholder="0.00"
          required
        />

        <div className="md:col-span-2">
          <Input
            label="Employer / Business Address"
            value={value('employerBusinessAddress')}
            onChange={(nextValue) => update('employerBusinessAddress', nextValue)}
            required
          />
        </div>
      </div>
    </section>
  )
}

const EditClientProfileModal = ({ client, onClose, onSave, isParentSaving = false }) => {
  const [form, setForm] = useState(() => normalizeClientProfile(client))
  const [alert, setAlert] = useState(null)

  useEffect(() => {
    setForm(normalizeClientProfile(client))
  }, [client])
  const [isSaving, setIsSaving] = useState(false)

  const saving = isSaving || isParentSaving
  const hasSecondBuyer = form.buyerType === 'spouses' || form.buyerType === 'and_account'

  const status = useMemo(() => {
    const missingPrincipalField = findMissingRequiredField(form, principalRequiredFields)
    const missingSecondBuyerField = hasSecondBuyer
      ? findMissingRequiredField(form, secondBuyerRequiredFields)
      : null

    return missingPrincipalField || missingSecondBuyerField ? 'incomplete' : 'complete'
  }, [form, hasSecondBuyer])

  const updateBuyerType = (buyerType) => {
    setForm((current) => ({
      ...current,
      buyerType,
      secondBuyerRole: buyerType === 'spouses' ? 'spouse' : 'co_owner',
    }))

    setAlert({
      type: 'info',
      message:
        buyerType === 'single'
          ? 'Second buyer form hidden.'
          : 'Second buyer form shown for Offer to Buy.',
    })
  }

  const handleSave = async () => {
    const missingPrincipalField = findMissingRequiredField(form, principalRequiredFields)
    if (missingPrincipalField) {
      setAlert({ type: 'error', message: `${missingPrincipalField[1]} is required.` })
      return
    }

    if (hasSecondBuyer) {
      const missingSecondBuyerField = findMissingRequiredField(form, secondBuyerRequiredFields)
      if (missingSecondBuyerField) {
        setAlert({ type: 'error', message: `${missingSecondBuyerField[1]} is required.` })
        return
      }
    }

    setIsSaving(true)
    setAlert({ type: 'loading', message: 'Saving buyer profile to database...' })

    try {
      await onSave?.({
        ...form,
        profileStatus: status,
      })
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save buyer profile.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-lg font-black text-slate-950">Edit Buyer Profile</h2>
            <p className="text-xs font-semibold text-slate-500">
              Used for Offer to Buy and Buyer&apos;s Profile printout.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close edit client profile"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          <section className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
              <Select
                label="Buyer Type"
                value={form.buyerType}
                onChange={updateBuyerType}
                disabled={saving}
                required
              >
                <option value="single">Single</option>
                <option value="spouses">Spouses</option>
                <option value="and_account">And Account</option>
              </Select>

              <div className="rounded-lg bg-white px-4 py-3">
                <p className="text-xs font-black uppercase text-slate-500">Profile Status</p>
                <p
                  className={`mt-1 text-sm font-black ${
                    status === 'complete' ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {status === 'complete' ? 'Complete' : 'Incomplete'}
                </p>
              </div>
            </div>

            {hasSecondBuyer ? (
              <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-white px-4 py-3 text-sm font-semibold text-blue-800">
                <FiAlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  Since buyer type is {form.buyerType === 'spouses' ? 'Spouses' : 'And Account'}, the spouse/co-buyer form is shown for the Offer to Buy printout.
                </p>
              </div>
            ) : null}
          </section>

          <div className="flex flex-col gap-4">
            <PersonForm title="Principal Buyer" form={form} setForm={setForm} />

            {hasSecondBuyer ? (
              <PersonForm
                title={form.buyerType === 'spouses' ? 'Spouse Details' : 'Second Buyer / Co-owner Details'}
                form={form}
                setForm={setForm}
                second
              />
            ) : null}

            <Section title="Work / Business Information">
              <div className={`grid gap-4 ${hasSecondBuyer ? 'xl:grid-cols-2' : 'xl:grid-cols-1'}`}>
                <WorkBusinessForm
                  title="Principal Buyer"
                  form={form}
                  setForm={setForm}
                />

                {hasSecondBuyer ? (
                  <WorkBusinessForm
                    title={form.buyerType === 'spouses' ? 'Spouse Details — Work / Business Information' : 'Second Buyer — Work / Business Information'}
                    form={form}
                    setForm={setForm}
                    second
                  />
                ) : null}
              </div>
            </Section>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave className="h-4 w-4" />
            {saving ? 'Saving...' : 'Save Buyer Profile'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditClientProfileModal
