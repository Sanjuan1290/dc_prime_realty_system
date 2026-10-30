/** Matches the preset month ranges in System Reports.
 * Dates are YYYY-MM-DD in the business's Asia/Manila calendar, not UTC instants.
 */
export const financeRangeOptions = Object.freeze([
  {value:'this_month', label:'This Month'},
  {value:'last_month', label:'Last Month'},
  {value:'2_months', label:'2 Months'},
  {value:'3_months', label:'3 Months'},
  {value:'6_months', label:'6 Months'},
  {value:'12_months', label:'12 Months'},
  {value:'custom', label:'Custom'},
])

const dayString = (date) => date.toISOString().slice(0,10)

/** Full calendar months; returns null for Custom so existing dates are retained. */
export const getFinancePresetRange = (selection, referenceDate) => {
  if(selection==='custom') return null
  if(!financeRangeOptions.some(option=>option.value===selection)) return null
  const [year,month]=String(referenceDate||'').slice(0,7).split('-').map(Number)
  if(!Number.isInteger(year)||!Number.isInteger(month)||month<1||month>12) return null
  const startMonth=selection==='last_month'?month-2:month-1
  const endMonth=selection==='last_month'?month-1:month
  const monthsBack=selection==='last_month'?0:Number(selection.match(/^(\d+)_months$/)?.[1]||1)-1
  return {
    from:dayString(new Date(Date.UTC(year,startMonth-monthsBack,1))),
    to:dayString(new Date(Date.UTC(year,endMonth,0))),
  }
}

