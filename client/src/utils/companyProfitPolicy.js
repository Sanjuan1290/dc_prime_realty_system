// Mirrors server/controllers/System/groupFixedCommissionRates.service.js
// (assertCompanyProfitWithinPolicy). The server is authoritative; this only
// gives immediate feedback in the Network forms.
export const DEFAULT_MAX_COMPANY_PROFIT_PERCENT_OF_POOL = 50
export const MIN_ROLE_DISTRIBUTION_RATE = 0.0001

const DEFAULT_SHARES = { division_manager: 14.18, sales_director: 15.82, unit_manager: 20, sales_agent: 50 }
const round4 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 10000) / 10000

export const getMaxCompanyProfitPercent = (poolSharesData = {}) => {
  const value = Number(poolSharesData?.max_company_profit_percent_of_pool)
  return Number.isFinite(value) && value >= 0 && value <= 100 ? value : DEFAULT_MAX_COMPANY_PROFIT_PERCENT_OF_POOL
}

export const getMaxCompanyProfitRate = (poolRate, maxPercentOfPool = DEFAULT_MAX_COMPANY_PROFIT_PERCENT_OF_POOL) =>
  Math.floor(((Number(poolRate || 0) * Number(maxPercentOfPool || 0)) / 100 + Number.EPSILON) * 10000) / 10000

export const getRoleRates = (poolRate, companyProfitRate, shares = DEFAULT_SHARES) => {
  const distributable = round4(Math.max(Number(poolRate || 0) - Number(companyProfitRate || 0), 0))
  const dm = round4(distributable * (Number(shares.division_manager ?? DEFAULT_SHARES.division_manager) / 100))
  const sd = round4(distributable * (Number(shares.sales_director ?? DEFAULT_SHARES.sales_director) / 100))
  const um = round4(distributable * (Number(shares.unit_manager ?? DEFAULT_SHARES.unit_manager) / 100))
  const sa = round4(distributable - dm - sd - um)
  return { distributable, dm, sd, um, sa }
}

/** Returns an error message for one In-House project rate, or '' when it is valid. */
export const getCompanyProfitError = (rate = {}, { maxPercentOfPool = DEFAULT_MAX_COMPANY_PROFIT_PERCENT_OF_POOL, shares = DEFAULT_SHARES } = {}) => {
  const pool = Number(rate.seller_group_pool_rate)
  const companyProfit = Number(rate.company_profit_rate || 0)
  if (!Number.isFinite(companyProfit) || companyProfit < 0) return 'Company Profit must be 0% or greater.'
  if (companyProfit >= pool) return 'Company Profit must be lower than the Pool Rate.'
  const maxRate = getMaxCompanyProfitRate(pool, maxPercentOfPool)
  if (companyProfit - maxRate > 0.00001) {
    return `Company Profit can be at most ${maxRate.toFixed(4)}% (${Number(maxPercentOfPool).toFixed(2)}% of the Pool Rate).`
  }
  const { dm, sd, um, sa } = getRoleRates(pool, companyProfit, shares)
  if ([dm, sd, um, sa].some((value) => value < MIN_ROLE_DISTRIBUTION_RATE)) {
    return `Company Profit leaves a role with 0%. Every role must receive at least ${MIN_ROLE_DISTRIBUTION_RATE.toFixed(4)}%.`
  }
  return ''
}

