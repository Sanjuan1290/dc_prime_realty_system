const toNumber = (value) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

export const roundPricingMoney = (value) =>
  Math.round((toNumber(value) + Number.EPSILON) * 100) / 100

export const normalizePricingMode = (value = '') =>
  String(value || '').trim().toLowerCase() === 'cash' ? 'cash' : 'installment'

export const calculateContractPricing = ({
  lotAreaSqm = 0,
  pricePerSqm = 0,
  legalMiscRate = 0,
  saleDiscountPercentage = 0,
} = {}) => {
  const area = Math.max(toNumber(lotAreaSqm), 0)
  const price = Math.max(toNumber(pricePerSqm), 0)
  const lmfRate = Math.max(toNumber(legalMiscRate), 0)
  const discountRate = Math.max(toNumber(saleDiscountPercentage), 0)

  const baseSellingPrice = roundPricingMoney(area * price)
  const saleDiscountAmount = roundPricingMoney(baseSellingPrice * (discountRate / 100))
  const netSellingPrice = roundPricingMoney(Math.max(baseSellingPrice - saleDiscountAmount, 0))
  const lmfAmount = roundPricingMoney(baseSellingPrice * (lmfRate / 100))
  const tcp = roundPricingMoney(netSellingPrice + lmfAmount)

  return {
    lotAreaSqm: area,
    pricePerSqm: price,
    legalMiscRate: lmfRate,
    saleDiscountPercentage: discountRate,
    baseSellingPrice,
    saleDiscountAmount,
    netSellingPrice,
    lmfAmount,
    tcp,
  }
}

export const getListingPricePerSqmForMode = (listing = {}, mode = 'installment') => {
  const normalizedMode = normalizePricingMode(mode)
  const legacyPrice = toNumber(
    listing.lot_project_listing_price_per_sqm ??
      listing.pricePerSqm ??
      listing.price_per_sqm
  )

  if (normalizedMode === 'cash') {
    return toNumber(
      listing.lot_project_listing_cash_price_per_sqm ??
        listing.cashPricePerSqm ??
        listing.cash_price_per_sqm ??
        legacyPrice
    )
  }

  return toNumber(
    listing.lot_project_listing_installment_price_per_sqm ??
      listing.installmentPricePerSqm ??
      listing.installment_price_per_sqm ??
      legacyPrice
  )
}

export const getListingPricingForMode = (
  listing = {},
  mode = 'installment',
  saleDiscountPercentage = 0
) => {
  const pricingMode = normalizePricingMode(mode)
  const pricing = calculateContractPricing({
    lotAreaSqm:
      listing.lot_project_listing_area_sqm ??
      listing.lotAreaSqm ??
      listing.area,
    pricePerSqm: getListingPricePerSqmForMode(listing, pricingMode),
    legalMiscRate:
      listing.lot_project_listing_lmf_rate ??
      listing.legalMiscRate ??
      listing.lmfRate,
    saleDiscountPercentage,
  })

  return { pricingMode, ...pricing }
}

