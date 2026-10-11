import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, percent, pick, titleCase } from './core/doubleCheckFormatters'

const SoaTermsDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const account = data.account || request.meta?.account || {}
  const terms = data.soaTerms || data
  const steps = [
    { key: 'account', title: 'Account', content: <DoubleCheckSection title="Account" helper="Verify which buyer account will receive these SOA terms." tone="blue"><DoubleCheckFields fields={[
      { label: 'Project', value: pick(account, 'project', 'projectName') || request.meta?.project },
      { label: 'Unit', value: pick(account, 'unit', 'listingId') || request.meta?.unit },
      { label: 'Buyer', value: pick(account, 'buyer') || request.meta?.buyer, wide: true },
    ]} /></DoubleCheckSection> },
    { key: 'terms', title: 'Payment Terms', content: <DoubleCheckSection title="Payment Terms" helper="Verify downpayment, monthly terms, dates, fees, discounts, and rates." tone="amber"><DoubleCheckFields fields={[
      { label: 'Downpayment Percentage', value: pick(terms, 'downpaymentPercentage', 'downpayment_percentage'), formatter: percent, tone: 'financial' },
      { label: 'Downpayment Amount', value: pick(terms, 'downpaymentAmount', 'downpayment_amount'), formatter: money, tone: 'financial' },
      { label: 'DP Discount', value: pick(terms, 'dpDiscountPercentage', 'dp_discount_percentage'), formatter: percent, tone: 'financial' },
      { label: 'Downpayment Terms', value: pick(terms, 'downpaymentTerms', 'downpayment_terms') },
      { label: 'Monthly Terms', value: pick(terms, 'monthlyTerms', 'monthly_terms') },
      { label: 'Starting Date', value: pick(terms, 'startingDate', 'starting_date'), formatter: formatDate },
      { label: 'First Due Date', value: pick(terms, 'firstDueDate', 'first_due_date'), formatter: formatDate },
      { label: 'Allow Backdated SOA Date', value: Boolean(pick(terms, 'isHistoricalEntry', 'is_historical_entry')) ? 'Yes' : 'No' },
      { label: 'Reservation Fee Treatment', value: pick(terms, 'reservationFeeTreatment', 'reservation_fee_treatment'), formatter: titleCase },
      { label: 'Legal / Misc Fee Treatment', value: pick(terms, 'legalMiscFee', 'legal_misc_fee'), formatter: titleCase },
      { label: 'Interest Rate', value: pick(terms, 'interestRate', 'annualInterestRate', 'interest_rate'), formatter: percent, tone: 'financial' },
      { label: 'Daily Penalty Rate', value: pick(terms, 'dailyPenaltyRate', 'daily_penalty_rate'), formatter: percent, tone: 'financial' },
      { label: 'Grace Period (Days)', value: pick(terms, 'penaltyGraceDays', 'gracePeriodDays', 'grace_period_days') },
      { label: 'Penalty Effective From', value: pick(terms, 'penaltyEffectiveFrom', 'penalty_effective_from'), formatter: formatDate },
    ]} /></DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || 'Review SOA Terms'} description={request.description || 'Verify the schedule and financial terms before updating the SOA.'} confirmLabel={request.confirmLabel || 'Confirm & Save SOA Terms'} summary={request.summary} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default SoaTermsDoubleCheck

