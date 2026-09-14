import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { titleCase } from './core/doubleCheckFormatters'

const dayOfMonth = (value) => {
  const number = Number(value || 0)
  if (!Number.isInteger(number) || number < 1 || number > 31) return 'Not provided'
  const suffix = [11, 12, 13].includes(number % 100)
    ? 'th'
    : number % 10 === 1
      ? 'st'
      : number % 10 === 2
        ? 'nd'
        : number % 10 === 3
          ? 'rd'
          : 'th'
  return `${number}${suffix} of the month`
}

const sameValue = (left, right) => String(left ?? '') === String(right ?? '')

const buildChangeFields = (before = {}, after = {}, definitions = []) => definitions.flatMap(({ key, label, formatter }) => {
  if (sameValue(before?.[key], after?.[key])) return []
  return [
    { label: `${label} — Before`, value: before?.[key], formatter },
    { label: `${label} — After`, value: after?.[key], formatter, tone: 'important' },
  ]
})

const systemChangeDefinitions = [
  { key: 'companyName', label: 'Company Name' },
  { key: 'companyTin', label: 'Company TIN' },
  { key: 'companyEmail', label: 'Company Email' },
  { key: 'companyContactNumber', label: 'Company Contact Number' },
  { key: 'companyAddress', label: 'Company Address' },
  { key: 'reservationContactName', label: 'Reservation Contact Name' },
  { key: 'reservationContactEmail', label: 'Reservation Contact Email' },
  { key: 'reservationContactNumber', label: 'Reservation Contact Number' },
  { key: 'defaultReleaseDayOne', label: 'Default Release Day 1', formatter: dayOfMonth },
  { key: 'defaultReleaseDayTwo', label: 'Default Release Day 2', formatter: dayOfMonth },
  { key: 'systemStatus', label: 'System Status', formatter: titleCase },
  { key: 'maintenanceMessage', label: 'Maintenance Message' },
]

const projectChangeDefinitions = [
  { key: 'releaseDayOne', label: 'First Release Day', formatter: dayOfMonth },
  { key: 'releaseDayTwo', label: 'Second Release Day', formatter: dayOfMonth },
  { key: 'reservationContactName', label: 'Reservation Contact Name' },
  { key: 'reservationContactEmail', label: 'Reservation Contact Email' },
  { key: 'reservationContactNumber', label: 'Reservation Contact Number' },
  { key: 'companyName', label: 'Company Name' },
  { key: 'companyEmail', label: 'Company Email' },
  { key: 'companyContactNumber', label: 'Company Contact Number' },
]

const SystemSettingsReview = ({ data }) => [
  {
    key: 'company',
    title: 'Company Profile',
    content: (
      <DoubleCheckSection title="Company Profile" helper="Verify the company identity and contact details used by system printouts and notifications." tone="blue">
        <DoubleCheckFields fields={[
          { label: 'Company Name', value: data.companyName },
          { label: 'Company TIN', value: data.companyTin },
          { label: 'Company Email', value: data.companyEmail },
          { label: 'Company Contact Number', value: data.companyContactNumber },
          { label: 'Company Address', value: data.companyAddress, wide: true },
        ]} />
      </DoubleCheckSection>
    ),
  },
  {
    key: 'defaults',
    title: 'Reservation & Commission Defaults',
    content: (
      <DoubleCheckSection title="Reservation & Commission Defaults" helper="Verify the global reservation contact and fallback commission release days." tone="emerald">
        <DoubleCheckFields fields={[
          { label: 'Reservation Contact Name', value: data.reservationContactName },
          { label: 'Reservation Contact Email', value: data.reservationContactEmail },
          { label: 'Reservation Contact Number', value: data.reservationContactNumber },
          { label: 'Default Release Day 1', value: data.defaultReleaseDayOne, formatter: dayOfMonth },
          { label: 'Default Release Day 2', value: data.defaultReleaseDayTwo, formatter: dayOfMonth },
        ]} />
      </DoubleCheckSection>
    ),
  },
  {
    key: 'system-status',
    title: 'System Status',
    content: (
      <DoubleCheckSection title="System Status" helper="Verify whether the portal remains active or enters maintenance mode, including the message shown during maintenance." tone="amber">
        <DoubleCheckFields fields={[
          { label: 'System Status', value: data.systemStatus, formatter: titleCase, tone: 'important' },
          { label: 'Maintenance Message', value: data.maintenanceMessage, wide: true },
        ]} />
      </DoubleCheckSection>
    ),
  },
]

const ProjectSettingsReview = ({ data }) => [
  {
    key: 'release-days',
    title: 'Commission Release Days',
    content: (
      <DoubleCheckSection title="Commission Release Days" helper="Verify the two project-specific days when eligible commissions may be released." tone="blue">
        <DoubleCheckFields fields={[
          { label: 'First Release Day', value: data.releaseDayOne, formatter: dayOfMonth },
          { label: 'Second Release Day', value: data.releaseDayTwo, formatter: dayOfMonth },
        ]} />
      </DoubleCheckSection>
    ),
  },
  {
    key: 'reservation-contact',
    title: 'Reservation Contact',
    content: (
      <DoubleCheckSection title="Reservation Contact" helper="Verify the project-specific contact shown for reservation assistance." tone="emerald">
        <DoubleCheckFields fields={[
          { label: 'Contact Name', value: data.reservationContactName },
          { label: 'Contact Email', value: data.reservationContactEmail },
          { label: 'Contact Number', value: data.reservationContactNumber },
        ]} />
      </DoubleCheckSection>
    ),
  },
  {
    key: 'company-information',
    title: 'Company Information',
    content: (
      <DoubleCheckSection title="Company Information" helper="Verify the company details used for this project's printouts and headers." tone="violet">
        <DoubleCheckFields fields={[
          { label: 'Company Name', value: data.companyName },
          { label: 'Company Email', value: data.companyEmail },
          { label: 'Company Contact Number', value: data.companyContactNumber },
        ]} />
      </DoubleCheckSection>
    ),
  },
]

const SettingsDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const before = request.before || {}
  const scope = request.scope === 'project' ? 'project' : 'system'
  const changeFields = buildChangeFields(
    before,
    data,
    scope === 'project' ? projectChangeDefinitions : systemChangeDefinitions
  )
  const authorizationStep = {
    key: 'owner-authorization',
    title: 'Owner Authorization',
    content: (
      <DoubleCheckSection title="Owner Authorization" helper="Confirm why this protected settings change is being made and review every changed value before saving." tone="amber">
        <DoubleCheckFields fields={[
          { label: 'Reason for Change', value: data.reason, wide: true, tone: 'important' },
          ...(changeFields.length ? changeFields : [{ label: 'Changed Values', value: 'No settings value changed.' }]),
        ]} />
      </DoubleCheckSection>
    ),
  }
  const detailSteps = scope === 'project'
    ? ProjectSettingsReview({ data })
    : SystemSettingsReview({ data })
  const steps = [authorizationStep, ...detailSteps]

  return (
    <DoubleCheckShell
      title={request.title || (scope === 'project' ? 'Review Project Settings' : 'Review System Settings')}
      description={request.description || 'Verify every setting being changed before saving.'}
      confirmLabel={request.confirmLabel || 'Confirm & Save Settings'}
      summary={request.summary}
      steps={steps}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  )
}

export default SettingsDoubleCheck

