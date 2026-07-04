import { SectionCard, SelectInput, TextInput } from './ReserveShared'
import { computeAge } from './reserveUtils'

const PersonFields = ({ title, form, setForm, second = false }) => {
  const nameKey = second ? 'secondBuyerName' : 'buyerName'
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
    setForm((current) => {
      const next = { ...current, [key]: value }

      if (key === birthDateKey) {
        next[computedAgeKey] = computeAge(value)
      }

      return next
    })
  }

  return (
    <SectionCard title={title}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {second ? (
          <SelectInput
            label="Buyer Role"
            value={form.secondBuyerRole}
            onChange={(value) => update('secondBuyerRole', value)}
          >
            <option value="spouse">Spouse</option>
            <option value="co_owner">Co-owner</option>
            <option value="second_buyer">Second Buyer</option>
          </SelectInput>
        ) : null}

        <TextInput
          label="Full Name"
          value={form[nameKey]}
          onChange={(value) => update(nameKey, value)}
          placeholder={second ? 'Full name of spouse / second buyer' : 'Full name of principal buyer'}
          required
        />

        <TextInput
          label="Birth Date"
          type="date"
          value={form[birthDateKey]}
          onChange={(value) => update(birthDateKey, value)}
        />

        <TextInput
          label="Computed Age"
          value={form[computedAgeKey]}
          onChange={() => null}
          disabled
        />

        <TextInput
          label="Place of Birth"
          value={form[placeOfBirthKey]}
          onChange={(value) => update(placeOfBirthKey, value)}
        />

        <TextInput
          label="Citizenship"
          value={form[citizenshipKey]}
          onChange={(value) => update(citizenshipKey, value)}
        />

        <SelectInput
          label="Gender"
          value={form[genderKey]}
          onChange={(value) => update(genderKey, value)}
        >
          <option value="">Select gender</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </SelectInput>

        <SelectInput
          label="Civil Status"
          value={form[civilStatusKey]}
          onChange={(value) => update(civilStatusKey, value)}
        >
          <option value="">Select civil status</option>
          <option value="Single">Single</option>
          <option value="Married">Married</option>
          <option value="Separated">Separated</option>
          <option value="Annulled/Divorced">Annulled/Divorced</option>
          <option value="Widow/er">Widow/er</option>
        </SelectInput>

        <TextInput
          label="Mobile Number"
          value={form[contactKey]}
          onChange={(value) => update(contactKey, value)}
          placeholder="09XXXXXXXXX"
          required
        />

        <TextInput
          label="Residence Phone Number"
          value={form[residencePhoneKey]}
          onChange={(value) => update(residencePhoneKey, value)}
        />

        <TextInput
          label="Email"
          value={form[emailKey]}
          onChange={(value) => update(emailKey, value)}
          placeholder="buyer@email.com"
        />

        <TextInput
          label="TIN"
          value={form[tinKey]}
          onChange={(value) => update(tinKey, value)}
        />

        <TextInput
          label="Present Address"
          value={form[presentAddressKey]}
          onChange={(value) => update(presentAddressKey, value)}
          required={!second}
        />

        <TextInput
          label="Present ZIP Code"
          value={form[presentZipKey]}
          onChange={(value) => update(presentZipKey, value)}
        />

        <TextInput
          label="Permanent Address"
          value={form[permanentAddressKey]}
          onChange={(value) => update(permanentAddressKey, value)}
        />

        <TextInput
          label="Permanent ZIP Code"
          value={form[permanentZipKey]}
          onChange={(value) => update(permanentZipKey, value)}
        />
      </div>
    </SectionCard>
  )
}

const WorkBusinessFields = ({ title, form, setForm, second = false }) => {
  const employmentKey = second ? 'secondBuyerEmploymentStatus' : 'employmentStatus'
  const employerKey = second ? 'secondBuyerEmployerBusinessName' : 'employerBusinessName'
  const zipKey = second ? 'secondBuyerEmployerZipCode' : 'employerZipCode'
  const natureKey = second ? 'secondBuyerNatureOfWorkBusiness' : 'natureOfWorkBusiness'
  const occupationKey = second ? 'secondBuyerOccupationPositionTitle' : 'occupationPositionTitle'
  const incomeKey = second ? 'secondBuyerMonthlyIncome' : 'monthlyIncome'
  const addressKey = second ? 'secondBuyerEmployerBusinessAddress' : 'employerBusinessAddress'

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="mb-4 text-sm font-black text-slate-800">{title}</h4>

      <div className="grid gap-4 md:grid-cols-2">
        <SelectInput
          label="Employment Status"
          value={form[employmentKey]}
          onChange={(value) => update(employmentKey, value)}
        >
          <option value="">Select status</option>
          <option value="Employed - Private">Employed - Private</option>
          <option value="Self-Employed">Self-Employed</option>
          <option value="Employed - Government">Employed - Government</option>
          <option value="Professional">Professional</option>
          <option value="OFW">OFW</option>
          <option value="Other">Other</option>
        </SelectInput>

        <TextInput
          label="Employer / Business Name"
          value={form[employerKey]}
          onChange={(value) => update(employerKey, value)}
        />

        <TextInput
          label="Employer ZIP Code"
          value={form[zipKey]}
          onChange={(value) => update(zipKey, value)}
        />

        <TextInput
          label="Nature of Work / Business"
          value={form[natureKey]}
          onChange={(value) => update(natureKey, value)}
        />

        <TextInput
          label="Occupation / Position / Title"
          value={form[occupationKey]}
          onChange={(value) => update(occupationKey, value)}
        />

        <TextInput
          label="Monthly Income"
          value={form[incomeKey]}
          onChange={(value) => update(incomeKey, value)}
          placeholder="₱0.00"
        />

        <div className="md:col-span-2">
          <TextInput
            label="Employer / Business Address"
            value={form[addressKey]}
            onChange={(value) => update(addressKey, value)}
          />
        </div>
      </div>
    </section>
  )
}

const ReserveClientProfileModal = ({ clientForm, setClientForm, hasSecondBuyer, updateBuyerType }) => (
  <div className="flex flex-col gap-4">
    <SectionCard
      title="Client Profile"
      description="Input the buyer profile first. This data is used for the Offer to Buy printout."
      right={
        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
          Step 1 of 3
        </span>
      }
    >
      <div className="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <SelectInput
          label="Buyer Type"
          value={clientForm.buyerType}
          onChange={updateBuyerType}
          required
        >
          <option value="single">Single</option>
          <option value="spouses">Spouses</option>
          <option value="and_account">And Account</option>
        </SelectInput>

        <div
          className={`rounded-xl border px-4 py-3 ${
            hasSecondBuyer
              ? 'border-blue-200 bg-blue-50 text-blue-800'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          <p className="text-xs font-black uppercase">
            {hasSecondBuyer ? 'Second buyer form enabled' : 'Single buyer'}
          </p>
          <p className="mt-1 text-xs font-semibold">
            {hasSecondBuyer
              ? 'Spouse/co-buyer details will show in the next form and printouts.'
              : 'No spouse/co-buyer information required.'}
          </p>
        </div>
      </div>
    </SectionCard>

    <PersonFields
      title="Principal Buyer"
      form={clientForm}
      setForm={setClientForm}
    />

    {hasSecondBuyer ? (
      <PersonFields
        title={clientForm.buyerType === 'spouses' ? 'Spouse Details' : 'Second Buyer / Co-owner Details'}
        form={clientForm}
        setForm={setClientForm}
        second
      />
    ) : null}

    <SectionCard title="Work / Business Information">
      <div className={`grid gap-4 ${hasSecondBuyer ? 'xl:grid-cols-2' : ''}`}>
        <WorkBusinessFields
          title="Principal Buyer"
          form={clientForm}
          setForm={setClientForm}
        />

        {hasSecondBuyer ? (
          <WorkBusinessFields
            title={clientForm.buyerType === 'spouses' ? 'Spouse Work / Business Information' : 'Second Buyer Work / Business Information'}
            form={clientForm}
            setForm={setClientForm}
            second
          />
        ) : null}
      </div>
    </SectionCard>
  </div>
)

export default ReserveClientProfileModal
