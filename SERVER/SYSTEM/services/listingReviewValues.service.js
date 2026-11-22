// Values persisted in inventory; buyer-specific financial terms are separate.
export const storedListingReviewFinancials = (row={}) => ({
 installmentPricePerSqm:Number(row.lot_project_listing_installment_price_per_sqm ?? row.lot_project_listing_price_per_sqm ?? 0),
 cashPricePerSqm:Number(row.lot_project_listing_cash_price_per_sqm ?? row.lot_project_listing_price_per_sqm ?? 0),
 netSellingPrice:Number(row.lot_project_listing_net_selling_price||0),legalMiscRate:Number(row.lot_project_listing_lmf_rate||0),
 legalMiscAmount:Number(row.lot_project_listing_lmf_amount||0),tcp:Number(row.lot_project_listing_tcp||0),
 reservationFee:Number(row.lot_project_listing_reservation_fee||0),annualInterestRate:Number(row.annual_interest_rate||0),
});
