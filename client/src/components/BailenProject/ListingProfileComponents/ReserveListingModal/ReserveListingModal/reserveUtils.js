export const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

export const getListingTcp = (listing) => {
  if (typeof listing?.tcpAmount === 'number') return listing.tcpAmount
  if (typeof listing?.tcp === 'number') return listing.tcp
  return Number(String(listing?.tcp || '').replace(/[₱,\s]/g, '')) || 0
}

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

  buyerName: client.buyerName || '',
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
  secondBuyerName: client.secondBuyerName || '',
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

export const getPaymentCalculations = (tcp, paymentForm) => {
  const downpaymentPercentage =
    paymentForm.downpaymentPercentageMode === 'custom'
      ? Number(paymentForm.customDownpaymentPercentage || 0)
      : Number(paymentForm.downpaymentPercentageMode || 0)

  const downpaymentTerms =
    paymentForm.downpaymentTermsMode === 'custom'
      ? Number(paymentForm.customDownpaymentTerms || 0)
      : paymentForm.downpaymentTermsMode === 'spot_cash'
        ? 0
        : Number(paymentForm.downpaymentTermsMode || 0)

  const monthlyTerms =
    paymentForm.monthlyTermsMode === 'custom'
      ? Number(paymentForm.customMonthlyTerms || 0)
      : Number(paymentForm.monthlyTermsMode || 0)

  const reservationFee = Number(paymentForm.reservationFee || 0)
  const dpGross = Number(tcp || 0) * (downpaymentPercentage / 100)
  const dpDiscountAmount = dpGross * (Number(paymentForm.dpDiscountPercentage || 0) / 100)
  const dpNet = Math.max(dpGross - dpDiscountAmount, 0)
  const balance = Math.max(Number(tcp || 0) - reservationFee - dpNet, 0)
  const monthlyAmortization = monthlyTerms > 0 ? balance / monthlyTerms : 0

  return {
    downpaymentPercentage,
    downpaymentTerms,
    monthlyTerms,
    preview: {
      reservationFee,
      dpGross,
      dpDiscountAmount,
      dpNet,
      balance,
      monthlyAmortization,
    },
  }
}
