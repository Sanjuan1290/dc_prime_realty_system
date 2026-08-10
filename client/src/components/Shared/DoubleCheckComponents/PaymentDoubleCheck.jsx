import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, money, pick, titleCase } from './core/doubleCheckFormatters'

const paymentFields = (payment = {}) => [
  { label: 'Payment Type', value: pick(payment, 'paymentType', 'type'), formatter: titleCase },
  { label: 'Amount', value: pick(payment, 'amount'), formatter: money, tone: 'financial' },
  { label: 'Payment Date', value: pick(payment, 'paymentDate'), formatter: formatDate },
  { label: 'Method', value: pick(payment, 'method'), formatter: titleCase },
  { label: 'Bank / Provider', value: pick(payment, 'bankName') },
  { label: 'Account No. / Wallet', value: pick(payment, 'accountNumber') },
  { label: 'Reference ID / OR / Transaction No.', value: pick(payment, 'referenceId'), wide: true },
]

const PaymentDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const account = data.account || request.meta?.account || {}
  const current = data.currentPayment || null
  const payment = data.newPaymentValues || data.payment || data
  const steps = [
    { key: 'account', title: 'Account', content: <DoubleCheckSection title="Account" helper="Verify the buyer account for this payment." tone="blue"><DoubleCheckFields fields={[
      { label: 'Project', value: pick(account, 'project') },
      { label: 'Unit', value: pick(account, 'unit') },
      { label: 'Buyer', value: pick(account, 'buyer'), wide: true },
      { label: 'Account Reference', value: pick(account, 'accountReference'), wide: true },
    ]} /></DoubleCheckSection> },
    { key: 'payment', title: current ? 'Payment Changes' : 'Payment Details', content: <div className="space-y-4">{current ? <DoubleCheckSection title="Currently Saved Payment" helper="Use this only to compare with the edited values." tone="slate"><DoubleCheckFields fields={paymentFields(current)} /></DoubleCheckSection> : null}<DoubleCheckSection title={current ? 'New Payment Values' : 'Payment Details'} helper="Verify every payment value that will be posted." tone="amber"><DoubleCheckFields fields={paymentFields(payment)} /></DoubleCheckSection></div> },
  ]
  return <DoubleCheckShell title={request.title || (current ? 'Review Payment Changes' : 'Review SOA Payment')} description={request.description || 'Verify the account and payment values before posting.'} confirmLabel={request.confirmLabel || (current ? 'Confirm & Save Payment Changes' : 'Confirm & Add Payment')} summary={request.summary || [pick(account, 'buyer'), pick(account, 'unit')].filter(Boolean).join(' · ')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default PaymentDoubleCheck

