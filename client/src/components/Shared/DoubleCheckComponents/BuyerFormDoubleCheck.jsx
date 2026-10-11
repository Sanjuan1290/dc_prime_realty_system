import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import BuyerProfileDoubleCheck from './BuyerProfileDoubleCheck'
import { pick } from './core/doubleCheckFormatters'

const BuyerFormDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  if (!request.variant || request.variant === 'submission') {
    const profile = data.clientProfile || data.buyerProfile || data
    const consentStep = {
      key: 'consent',
      title: 'Privacy Consent',
      content: (
        <DoubleCheckSection title="Privacy Consent" helper="Verify the consent choice that will be submitted with the buyer information." tone="emerald">
          <DoubleCheckFields fields={[
            { label: 'Privacy Consent', value: Boolean(data.privacyConsent) ? 'Yes — consent provided' : 'No — consent not provided', wide: true },
          ]} />
        </DoubleCheckSection>
      ),
    }
    return <BuyerProfileDoubleCheck request={{ ...request, data: profile, title: request.title || 'Review Buyer Information', description: request.description || 'Double-check the buyer information and privacy consent before submitting.', confirmLabel: request.confirmLabel || 'Confirm & Submit Buyer Information' }} additionalSteps={[consentStep]} onConfirm={onConfirm} onCancel={onCancel} />
  }

  const steps = [{ key: 'buyer-form', title: 'Buyer Form Action', content: <DoubleCheckSection title="Buyer Form Action" helper="Verify the unit, recipient, expiry, and action." tone="blue"><DoubleCheckFields fields={[
    { label: 'Unit', value: pick(data, 'unit', 'unitId') || request.meta?.unit },
    { label: 'Recipient Email', value: pick(data, 'recipientEmail') },
    { label: 'Recipient Mobile Number', value: pick(data, 'recipientMobileNumber') },
    { label: 'Expiry (Hours)', value: pick(data, 'expiresHours') },
    { label: 'Send Email Automatically', value: pick(data, 'sendEmail') },
    { label: 'Reason', value: pick(data, 'reason'), wide: true },
  ]} /></DoubleCheckSection> }]
  return <DoubleCheckShell title={request.title || 'Review Buyer Form Action'} description={request.description || 'Verify the buyer-form action before saving it.'} confirmLabel={request.confirmLabel || 'Confirm & Continue'} summary={pick(data, 'unit', 'unitId') || request.meta?.unit} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default BuyerFormDoubleCheck

