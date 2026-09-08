import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const ReservationCorrectionDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const fields = [
    { label: 'Buyer', value: data.buyer },
    { label: 'Account', value: data.accountReference },
    { label: 'Wrong Unit', value: data.sourceUnit, tone: 'important' },
    { label: 'Correct Unit', value: data.destinationUnit, tone: 'important' },
    { label: 'Previous TCP', value: money(data.oldTcp) },
    { label: 'Corrected TCP', value: money(data.newTcp) },
    { label: 'Reason', value: data.reason, wide: true, tone: 'important' },
    { label: 'Cancellation Record', value: data.noCancellation ? 'None — administrative correction only' : '-' , wide: true },
  ]

  return (
    <DoubleCheckShell
      title={request.title || 'Review Reservation Correction'}
      description="This moves the active buyer account to the correct available unit and rebuilds unit-dependent pricing, SOA schedules, document requirements, and commission."
      confirmLabel={request.confirmLabel || 'Confirm Correction'}
      summary={`${data.sourceUnit || '-'} → ${data.destinationUnit || '-'}`}
      steps={[{
        key: 'review',
        title: 'Administrative Correction',
        content: (
          <DoubleCheckSection
            title="Administrative Reservation Correction"
            helper="No cancellation, refund, discontinued sale, or Buyer Account History entry will be created. The complete before/after correction is retained in Audit Logs."
            tone="red"
          >
            <DoubleCheckFields fields={fields} />
          </DoubleCheckSection>
        ),
      }]}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export default ReservationCorrectionDoubleCheck

