import { SectionCard, SelectInput, TextInput } from './ReserveShared'
import { buildDisplayName, computeAge } from './reserveUtils'

const PersonFields = ({ title, form, setForm, second = false, invalidField = '', onFieldChange }) => {
  const nameKey = second ? 'secondBuyerName' : 'buyerName'
  const firstNameKey = second ? 'secondBuyerFirstName' : 'buyerFirstName'
  const middleNameKey = second ? 'secondBuyerMiddleName' : 'buyerMiddleName'
  const lastNameKey = second ? 'secondBuyerLastName' : 'buyerLastName'
  const suffixKey = second ? 'secondBuyerSuffix' : 'buyerSuffix'
  const birthDateKey = second ? 'secondBuyerBirthDate' : 'birthDate'
  const computedAgeKey = second ? 'secondBuyerComputedAge' : 'computedAge'
  const placeOfBirthKey = second ? 'secondBuyerPlaceOfBirth' : 'placeOfBirth'
  const citizenshipKey = second ? 'secondBuyerCitizenship' : 'citizenship'
  const genderKey = second ? 'secondBuyerGender' : 'gender'
  const civilStatusKey = second ? 'secondBuyerCivilStatus' : 'civilStatus'
  const contactKey = second ? 'secondBuyerContactNo' : 'contactNo'
  const residencePhoneKey = second ? 'secondBuyerResidencePhoneNumber' : 'residencePhoneNumber'
  const emailKey = second ? 'secondBuyerEmail' : 'email'
  const tinKey = second ? 'secondBuyerTin' : 'tin'
  const presentAddressKey = second ? 'secondBuyerPresentAddress' : 'presentAddress'
  const presentZipKey = second ? 'secondBuyerPresentZipCode' : 'presentZipCode'
  const permanentAddressKey = second ? 'secondBuyerPermanentAddress' : 'permanentAddress'
  const permanentZipKey = second ? 'secondBuyerPermanentZipCode' : 'permanentZipCode'

  const update = (key, value) => {
    onFieldChange?.(key)

    setForm((current) => {
      const next = { ...current, [key]: value }

      if ([firstNameKey, middleNameKey, lastNameKey, suffixKey].includes(key)) {
        next[nameKey] = buildDisplayName({
          firstName: next[firstNameKey],
          middleName: next[middleNameKey],
          lastName: next[lastNameKey],
          suffix: next[suffixKey],
        })
      }

      if (key === birthDateKey) {
        next[computedAgeKey] = computeAge(value)
      }

      return next
    })
  }

  return (
    <SectionCard
      title={title}
      description="Fields marked * are required. Leave optional fields blank when they do not apply."
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {second ? (
          <SelectInput
            label="Buyer Role"
            value={form.secondBuyerRole}
            onChange={(value) => update('secondBuyerRole', value)}
            error={invalidField === 'secondBuyerRole'}
            required
          >
            <option value="spouse">Spouse</option>
            <option value="co_owner">Co-owner</option>
            <option value="second_buyer">Second Buyer</option>
          </SelectInput>
        ) : null}

        <TextInput label="Last Name" value={form[lastNameKey]} onChange={(value) => update(lastNameKey, value)} placeholder="Last name" error={invalidField === lastNameKey} required />
        <TextInput label="First Name" value={form[firstNameKey]} onChange={(value) => update(firstNameKey, value)} placeholder="First name" error={invalidField === firstNameKey} required />
        <TextInput label="Middle Name" value={form[middleNameKey]} onChange={(value) => update(middleNameKey, value)} placeholder="Optional middle name" error={invalidField === middleNameKey} />
        <TextInput label="Suffix" value={form[suffixKey]} onChange={(value) => update(suffixKey, value)} placeholder="Jr., Sr., III (optional)" error={invalidField === suffixKey} />
        <TextInput label="Birth Date" type="date" value={form[birthDateKey]} onChange={(value) => update(birthDateKey, value)} error={invalidField === birthDateKey} required />
        <TextInput label="Computed Age" value={form[computedAgeKey]} onChange={() => null} disabled />
        <TextInput label="Place of Birth" value={form[placeOfBirthKey]} onChange={(value) => update(placeOfBirthKey, value)} error={invalidField === placeOfBirthKey} required />
        <TextInput label="Citizenship" value={form[citizenshipKey]} onChange={(value) => update(citizenshipKey, value)} error={invalidField === citizenshipKey} required />

        <SelectInput label="Gender" value={form[genderKey]} onChange={(value) => update(genderKey, value)} error={invalidField === genderKey} required>
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </SelectInput>

        <SelectInput label="Civil Status" value={form[civilStatusKey]} onChange={(value) => update(civilStatusKey, value)} error={invalidField === civilStatusKey} required>
          <option value="">Select civil status</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Separated">Separated</option>
          <option value="Annulled/Divorced">Annulled/Divorced</option>
          <option value="Widow/er">Widow/er</option>
        </SelectInput>

        <TextInput label="Mobile Number" value={form[contactKey]} onChange={(value) => update(contactKey, value)} placeholder="09XXXXXXXXX" error={invalidField === contactKey} required />
        <TextInput label="Residence Phone Number" value={form[residencePhoneKey]} onChange={(value) => update(residencePhoneKey, value)} placeholder="Optional phone number" />
        <TextInput label="Email" type="email" value={form[emailKey]} onChange={(value) => update(emailKey, value)} placeholder="buyer@email.com (optional)" />
        <TextInput label="TIN" value={form[tinKey]} onChange={(value) => update(tinKey, value)} placeholder="Optional TIN" />
        <TextInput label="Present Address" value={form[presentAddressKey]} onChange={(value) => update(presentAddressKey, value)} error={invalidField === presentAddressKey} required />
        <TextInput label="Present ZIP Code" value={form[presentZipKey]} onChange={(value) => update(presentZipKey, value)} error={invalidField === presentZipKey} required />
        <TextInput label="Permanent Address" value={form[permanentAddressKey]} onChange={(value) => update(permanentAddressKey, value)} placeholder="Optional if same as present address" />
        <TextInput label="Permanent ZIP Code" value={form[permanentZipKey]} onChange={(value) => update(permanentZipKey, value)} placeholder="Optional" />
      </div>
    </SectionCard>
  )
}

const WorkBusinessFields = ({ title, form, setForm, second = false, invalidField = '', onFieldChange }) => {
  const employmentKey = second ? 'secondBuyerEmploymentStatus' : 'employmentStatus'
  const employerKey = second ? 'secondBuyerEmployerBusinessName' : 'employerBusinessName'
  const zipKey = second ? 'secondBuyerEmployerZipCode' : 'employerZipCode'
  const natureKey = second ? 'secondBuyerNatureOfWorkBusiness' : 'natureOfWorkBusiness'
  const occupationKey = second ? 'secondBuyerOccupationPositionTitle' : 'occupationPositionTitle'
  const incomeKey = second ? 'secondBuyerMonthlyIncome' : 'monthlyIncome'
  const addressKey = second ? 'secondBuyerEmployerBusinessAddress' : 'employerBusinessAddress'

  const update = (key, value) => {
    onFieldChange?.(key)
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-black text-slate-800">{title}</h4>
      <p className="mb-4 mt-1 text-xs font-semibold text-slate-500">Fields marked * are required. Leave optional fields blank when they do not apply.</p>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectInput label="Employment Status" value={form[employmentKey]} onChange={(value) => update(employmentKey, value)} error={invalidField === employmentKey} required>
          <option value="">Select status</option>
          <option value="Employed - Private">Employed - Private</option>
          <option value="Self-Employed">Self-Employed</option>
          <option value="Employed - Government">Employed - Government</option>
          <option value="Professional">Professional</option>
          <option value="OFW">OFW</option>
          <option value="Other">Other</option>
          <option value="Unemployed">Unemployed</option>
          <option value="Retired">Retired</option>
          <option value="Student">Student</option>
          <option value="Not Applicable">Not Applicable</option>
        </SelectInput>

        <TextInput label="Employer / Business Name" value={form[employerKey]} onChange={(value) => update(employerKey, value)} />
        <TextInput label="Employer ZIP Code" value={form[zipKey]} onChange={(value) => update(zipKey, value)} />
        <TextInput label="Nature of Work / Business" value={form[natureKey]} onChange={(value) => update(natureKey, value)} />
        <TextInput label="Occupation / Position / Title" value={form[occupationKey]} onChange={(value) => update(occupationKey, value)} />
        <TextInput label="Monthly Income" type="number" value={form[incomeKey]} onChange={(value) => update(incomeKey, value)} placeholder="0.00" error={invalidField === incomeKey} required />

        <div className="md:col-span-2">
          <TextInput label="Employer / Business Address" value={form[addressKey]} onChange={(value) => update(addressKey, value)} />
        </div>
      </div>
    </section>
  )
}

const ReserveClientProfileModal = ({
  clientForm,
  setClientForm,
  hasSecondBuyer,
  updateBuyerType,
  invalidField = '',
  onFieldChange,
  title = 'Client Profile',
  description = 'Input the buyer profile first. This data is used for the Offer to Buy printout.',
  stepLabel = 'Step 1 of 3',
}) => (
  <div className="flex flex-col gap-4">
    <SectionCard
      title={title}
      description={description}
      right={stepLabel ? <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{stepLabel}</span> : null}
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <SelectInput label="Buyer Type" value={clientForm.buyerType} onChange={updateBuyerType} error={invalidField === 'buyerType'} required>
          <option value="single">Single</option>
          <option value="spouses">Spouses</option>
          <option value="and_account">And Account</option>
        </SelectInput>

        <div className={`rounded-xl border px-4 py-3 ${hasSecondBuyer ? 'border-blue-200 bg-blue-50 text-blue-800' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
          <p className="text-xs font-black uppercase">{hasSecondBuyer ? 'Second buyer form enabled' : 'Single buyer'}</p>
          <p className="mt-1 text-xs font-semibold">
            {hasSecondBuyer
              ? 'Required spouse/co-buyer fields are marked * and will appear in printouts.'
              : 'No spouse/co-buyer information required.'}
          </p>
        </div>
      </div>
    </SectionCard>

    <PersonFields title="Principal Buyer" form={clientForm} setForm={setClientForm} invalidField={invalidField} onFieldChange={onFieldChange} />

    {hasSecondBuyer ? (
      <PersonFields
        title={clientForm.buyerType === 'spouses' ? 'Spouse Details' : 'Second Buyer / Co-owner Details'}
        form={clientForm}
        setForm={setClientForm}
        invalidField={invalidField}
        onFieldChange={onFieldChange}
        second
      />
    ) : null}

    <SectionCard title="Work / Business Information">
      <div className={`grid gap-4 ${hasSecondBuyer ? 'xl:grid-cols-2' : ''}`}>
        <WorkBusinessFields title="Principal Buyer" form={clientForm} setForm={setClientForm} invalidField={invalidField} onFieldChange={onFieldChange} />

        {hasSecondBuyer ? (
          <WorkBusinessFields
            title={clientForm.buyerType === 'spouses' ? 'Spouse Work / Business Information' : 'Second Buyer Work / Business Information'}
            form={clientForm}
            setForm={setClientForm}
            invalidField={invalidField}
            onFieldChange={onFieldChange}
            second
          />
        ) : null}
      </div>
    </SectionCard>
  </div>
)

export default ReserveClientProfileModal

