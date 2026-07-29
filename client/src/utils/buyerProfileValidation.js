export const principalBuyerRequiredFields = [
  ['buyerLastName', 'Principal buyer last name'],
  ['buyerFirstName', 'Principal buyer first name'],
  ['birthDate', 'Principal buyer birth date'],
  ['placeOfBirth', 'Principal buyer place of birth'],
  ['citizenship', 'Principal buyer citizenship'],
  ['gender', 'Principal buyer gender'],
  ['civilStatus', 'Principal buyer civil status'],
  ['contactNo', 'Principal buyer mobile number'],
  ['presentAddress', 'Principal buyer present address'],
  ['presentZipCode', 'Principal buyer present ZIP code'],
  ['employmentStatus', 'Principal buyer employment status'],
  ['monthlyIncome', 'Principal buyer monthly income'],
]

export const secondBuyerRequiredFields = [
  ['secondBuyerRole', 'Spouse / second buyer role'],
  ['secondBuyerLastName', 'Spouse / second buyer last name'],
  ['secondBuyerFirstName', 'Spouse / second buyer first name'],
  ['secondBuyerBirthDate', 'Spouse / second buyer birth date'],
  ['secondBuyerPlaceOfBirth', 'Spouse / second buyer place of birth'],
  ['secondBuyerCitizenship', 'Spouse / second buyer citizenship'],
  ['secondBuyerGender', 'Spouse / second buyer gender'],
  ['secondBuyerCivilStatus', 'Spouse / second buyer civil status'],
  ['secondBuyerContactNo', 'Spouse / second buyer mobile number'],
  ['secondBuyerPresentAddress', 'Spouse / second buyer present address'],
  ['secondBuyerPresentZipCode', 'Spouse / second buyer present ZIP code'],
  ['secondBuyerEmploymentStatus', 'Spouse / second buyer employment status'],
  ['secondBuyerMonthlyIncome', 'Spouse / second buyer monthly income'],
]

export const getBuyerProfileValidationError = (form = {}) => {
  const hasSecondBuyer = form.buyerType === 'spouses' || form.buyerType === 'and_account'
  const fields = hasSecondBuyer
    ? [...principalBuyerRequiredFields, ...secondBuyerRequiredFields]
    : principalBuyerRequiredFields

  const missing = fields.find(([key]) => !String(form?.[key] ?? '').trim())
  if (missing) return { field: missing[0], message: `${missing[1]} is required.` }

  const dateFields = [
    ['birthDate', 'Principal buyer birth date'],
    ...(hasSecondBuyer ? [['secondBuyerBirthDate', 'Spouse / second buyer birth date']] : []),
  ]
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  for (const [key, label] of dateFields) {
    const date = new Date(`${form[key]}T00:00:00`)
    if (Number.isNaN(date.getTime())) return { field: key, message: `${label} is invalid.` }
    if (date.getTime() > today.getTime()) return { field: key, message: `${label} cannot be in the future.` }
  }

  const incomeFields = [
    ['monthlyIncome', 'Principal buyer monthly income'],
    ...(hasSecondBuyer ? [['secondBuyerMonthlyIncome', 'Spouse / second buyer monthly income']] : []),
  ]
  for (const [key, label] of incomeFields) {
    const amount = Number(String(form[key]).replace(/,/g, ''))
    if (!Number.isFinite(amount) || amount < 0) {
      return { field: key, message: `${label} must be a valid non-negative amount.` }
    }
  }

  const emailFields = [
    ['email', 'Principal buyer email'],
    ...(hasSecondBuyer ? [['secondBuyerEmail', 'Spouse / second buyer email']] : []),
  ]
  for (const [key, label] of emailFields) {
    const value = String(form[key] || '').trim()
    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return { field: key, message: `${label} is invalid.` }
    }
  }

  return null
}
