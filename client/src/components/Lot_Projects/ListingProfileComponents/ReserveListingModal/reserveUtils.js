import { getListingPricingForMode } from '../../../../utils/listingPricing.js'

export const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

export const getListingTcp = (
  listing,
  modeOfPayment = 'installment',
  saleDiscountPercentage = 0
) => getListingPricingForMode(listing, modeOfPayment, saleDiscountPercentage).tcp

export const buildDisplayName = ({ firstName = '', middleName = '', lastName = '', suffix = '' } = {}) =>
  [firstName, middleName, lastName, suffix]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join(' ')

export const computeAge = (birthDate) => {
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

export const getInitialClientForm = (client = {}) => ({
  buyerType: client.buyerType || 'single',

  buyerFirstName: client.buyerFirstName || '',
  buyerMiddleName: client.buyerMiddleName || '',
  buyerLastName: client.buyerLastName || '',
  buyerSuffix: client.buyerSuffix || '',
  buyerName: client.buyerName || buildDisplayName({
    firstName: client.buyerFirstName,
    middleName: client.buyerMiddleName,
    lastName: client.buyerLastName,
    suffix: client.buyerSuffix,
  }),
  birthDate: client.birthDate || '',
  computedAge: client.computedAge || '-',
  placeOfBirth: client.placeOfBirth || '',
  citizenship: client.citizenship || '',
  gender: client.gender || '',
  civilStatus: client.civilStatus || '',
  contactNo: client.contactNo || '',
  residencePhoneNumber: client.residencePhoneNumber || '',
  email: client.email || '',
  tin: client.tin || '',
  presentAddress: client.presentAddress || '',
  presentZipCode: client.presentZipCode || '',
  permanentAddress: client.permanentAddress || '',
  permanentZipCode: client.permanentZipCode || '',

  employmentStatus: client.employmentStatus || '',
  employerBusinessName: client.employerBusinessName || '',
  employerZipCode: client.employerZipCode || '',
  natureOfWorkBusiness: client.natureOfWorkBusiness || '',
  occupationPositionTitle: client.occupationPositionTitle || '',
  monthlyIncome: client.monthlyIncome || '',
  employerBusinessAddress: client.employerBusinessAddress || '',

  secondBuyerRole: client.secondBuyerRole || 'spouse',
  secondBuyerFirstName: client.secondBuyerFirstName || '',
  secondBuyerMiddleName: client.secondBuyerMiddleName || '',
  secondBuyerLastName: client.secondBuyerLastName || '',
  secondBuyerSuffix: client.secondBuyerSuffix || '',
  secondBuyerName: client.secondBuyerName || buildDisplayName({
    firstName: client.secondBuyerFirstName,
    middleName: client.secondBuyerMiddleName,
    lastName: client.secondBuyerLastName,
    suffix: client.secondBuyerSuffix,
  }),
  secondBuyerBirthDate: client.secondBuyerBirthDate || '',
  secondBuyerComputedAge: client.secondBuyerComputedAge || '-',
  secondBuyerPlaceOfBirth: client.secondBuyerPlaceOfBirth || '',
  secondBuyerCitizenship: client.secondBuyerCitizenship || '',
  secondBuyerGender: client.secondBuyerGender || '',
  secondBuyerCivilStatus: client.secondBuyerCivilStatus || '',
  secondBuyerContactNo: client.secondBuyerContactNo || '',
  secondBuyerResidencePhoneNumber: client.secondBuyerResidencePhoneNumber || '',
  secondBuyerEmail: client.secondBuyerEmail || '',
  secondBuyerTin: client.secondBuyerTin || '',
  secondBuyerPresentAddress: client.secondBuyerPresentAddress || '',
  secondBuyerPresentZipCode: client.secondBuyerPresentZipCode || '',
  secondBuyerPermanentAddress: client.secondBuyerPermanentAddress || '',
  secondBuyerPermanentZipCode: client.secondBuyerPermanentZipCode || '',

  secondBuyerEmploymentStatus: client.secondBuyerEmploymentStatus || '',
  secondBuyerEmployerBusinessName: client.secondBuyerEmployerBusinessName || '',
  secondBuyerEmployerZipCode: client.secondBuyerEmployerZipCode || '',
  secondBuyerNatureOfWorkBusiness: client.secondBuyerNatureOfWorkBusiness || '',
  secondBuyerOccupationPositionTitle: client.secondBuyerOccupationPositionTitle || '',
  secondBuyerMonthlyIncome: client.secondBuyerMonthlyIncome || '',
  secondBuyerEmployerBusinessAddress: client.secondBuyerEmployerBusinessAddress || '',
})

const roundMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

export const calculateMonthlyAmortization = (
  financedBalance,
  annualInterestRate,
  monthlyTerms
) => {
  const principal = roundMoney(financedBalance)
  const terms = Number(monthlyTerms || 0)

  if (principal <= 0 || terms <= 0) return 0

  const monthlyRate = Number(annualInterestRate || 0) / 100 / 12

  if (monthlyRate <= 0) {
    return roundMoney(principal / terms)
  }

  const factor = Math.pow(1 + monthlyRate, terms)

  return roundMoney(
    principal * ((monthlyRate * factor) / (factor - 1))
  )
}

export const getPaymentCalculations = (tcp, paymentForm) => {
  const modeOfPayment = String(paymentForm.modeOfPayment || 'installment').toLowerCase()
  const isCash = modeOfPayment === 'cash'

  const downpaymentPercentage = isCash
    ? 0
    : paymentForm.downpaymentPercentageMode === 'custom'
      ? Number(paymentForm.customDownpaymentPercentage || 0)
      : Number(paymentForm.downpaymentPercentageMode || 0)

  const downpaymentTerms = isCash
    ? 0
    : paymentForm.downpaymentTermsMode === 'custom'
      ? Number(paymentForm.customDownpaymentTerms || 0)
      : paymentForm.downpaymentTermsMode === 'spot_cash'
        ? 0
        : Number(paymentForm.downpaymentTermsMode || 0)

  const monthlyTerms = isCash
    ? 0
    : paymentForm.monthlyTermsMode === 'custom'
      ? Number(paymentForm.customMonthlyTerms || 0)
      : Number(paymentForm.monthlyTermsMode || 0)

  const reservationFee = Number(paymentForm.reservationFee || 0)
  const legalMiscFeeAmount = Number(paymentForm.legalMiscFeeAmount || 0)
  const legalMiscFeeMode = paymentForm.legalMiscFeeMode || paymentForm.legalMiscFee || 'include_in_monthly'
  const principalBase = Math.max(
    Number(tcp || 0) - (legalMiscFeeMode === 'separate_soa_row' ? legalMiscFeeAmount : 0),
    0
  )

  const reservationFeeTreatment = isCash
    ? 'separate'
    : paymentForm.reservationFeeTreatment === 'apply_to_downpayment'
      ? 'apply_to_downpayment'
      : 'separate'
  const reservationFeeAppliedToDownpayment = reservationFeeTreatment === 'apply_to_downpayment'

  // The downpayment target stays based on the selected percentage. When the
  // reservation fee is applied to it, only the unpaid part becomes a DP schedule.
  const dpTarget = isCash ? 0 : principalBase * (downpaymentPercentage / 100)
  const reservationFeeDownpaymentCredit = reservationFeeAppliedToDownpayment
    ? Math.min(reservationFee, dpTarget)
    : 0
  const dpGross = Math.max(dpTarget - reservationFeeDownpaymentCredit, 0)
  const dpDiscountAmount = isCash
    ? 0
    : dpGross * (Number(paymentForm.dpDiscountPercentage || 0) / 100)
  const dpNet = Math.max(dpGross - dpDiscountAmount, 0)

  // The discount reduces the cash the buyer pays for the remaining downpayment.
  // The gross scheduled DP still reduces the financed balance.
  const downpaymentCredit = dpNet + dpDiscountAmount
  const balance = Math.max(
    principalBase - reservationFee - downpaymentCredit,
    0
  )
  const monthlyAmortization = !isCash
    ? calculateMonthlyAmortization(
        balance,
        paymentForm.interestRate,
        monthlyTerms
      )
    : 0
  const fullPaymentAmount = isCash ? balance : 0

  return {
    modeOfPayment,
    isCash,
    downpaymentPercentage,
    downpaymentTerms,
    monthlyTerms,
    reservationFeeTreatment,
    reservationFeeAppliedToDownpayment,
    preview: {
      reservationFee,
      reservationFeeTreatment,
      reservationFeeAppliedToDownpayment,
      reservationFeeDownpaymentCredit,
      dpTarget,
      legalMiscFeeAmount,
      legalMiscFeeMode,
      principalBase,
      dpGross,
      dpDiscountAmount,
      dpNet,
      downpaymentCredit,
      balance,
      monthlyAmortization,
      fullPaymentAmount,
    },
  }
}
