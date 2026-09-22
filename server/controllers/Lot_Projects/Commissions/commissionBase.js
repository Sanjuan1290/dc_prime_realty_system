export const roundCommissionMoney = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const firstPositiveCommissionValue = (...values) => {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
};

/**
 * Commissions are based on the selected contract price before sale discounts
 * and before LMF: lot area x the cash/installment price per SQM.
 */
export const resolveCommissionBaseAmount = (listing = {}) => {
  const explicitBase = firstPositiveCommissionValue(
    listing.commissionBase,
    listing.soa_selected_base_selling_price,
    listing.selectedBaseSellingPrice,
    listing.baseSellingPrice,
    listing.commission_base_amount
  );
  if (explicitBase > 0) return roundCommissionMoney(explicitBase);

  const area = firstPositiveCommissionValue(
    listing.lot_project_listing_area_sqm,
    listing.lotAreaSqm,
    listing.area,
    listing.lot_area
  );
  const selectedPricePerSqm = firstPositiveCommissionValue(
    listing.soa_selected_price_per_sqm,
    listing.selectedPricePerSqm,
    listing.lot_project_listing_price_per_sqm,
    listing.pricePerSqm
  );
  if (area > 0 && selectedPricePerSqm > 0) {
    return roundCommissionMoney(area * selectedPricePerSqm);
  }

  // Legacy fallback for old rows that do not contain a base-price snapshot.
  return roundCommissionMoney(firstPositiveCommissionValue(
    listing.lot_project_listing_net_selling_price,
    listing.lot_project_listing_tcp
  ));
};
