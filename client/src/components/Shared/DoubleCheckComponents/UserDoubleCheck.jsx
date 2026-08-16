import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { formatDate, pick, roleLabel, statusLabel } from './core/doubleCheckFormatters'

const sellerRoles = new Set(['division_manager', 'sales_director', 'unit_manager', 'sales_agent'])

const UserDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const role = pick(data, 'role')
  const seller = sellerRoles.has(String(role))
  const steps = [
    { key: 'user', title: 'User Information', content: <DoubleCheckSection title="User Information" helper="Verify identity, contact, access role, and status." tone="blue"><DoubleCheckFields fields={[
      { label: 'First Name', value: pick(data, 'first_name', 'firstName') },
      { label: 'Middle Name', value: pick(data, 'middle_name', 'middleName') },
      { label: 'Last Name', value: pick(data, 'last_name', 'lastName') },
      { label: 'Email', value: pick(data, 'email') },
      { label: 'Contact No.', value: pick(data, 'contact_no', 'contactNo') },
      { label: 'TIN No.', value: pick(data, 'tin_no', 'tinNo') },
      { label: 'PRC No.', value: pick(data, 'prc_no', 'prcNo') },
      { label: 'Address', value: pick(data, 'address'), wide: true },
      { label: 'Role', value: role, formatter: roleLabel },
      ...(String(role) === 'admin' ? [{ label: 'Admin Type', value: pick(data, 'admin_type', 'adminType') }] : []),
      { label: 'Status', value: pick(data, 'status'), formatter: statusLabel },
      ...(request.mode === 'create' && !seller ? [{ label: 'Temporary Password', value: pick(data, 'password') ? '••••••••' : '', wide: true }] : []),
    ]} /></DoubleCheckSection> },
    { key: 'hierarchy', title: 'In-House Hierarchy', hidden: !seller, content: <DoubleCheckSection title="In-House Hierarchy" helper="Verify the group, reporting line, and accreditation date. Commission rates are inherited from the selected group." tone="violet"><DoubleCheckFields fields={[
      { label: 'In-House Group', value: pick(data, 'seller_group_name', 'sellerGroupName') || request.meta?.sellerGroupName },
      { label: 'Reports Under', value: pick(data, 'reports_under_name', 'reportsUnderName') || request.meta?.reportsUnderName || (role === 'division_manager' ? 'Direct to Developer' : '') },
      { label: 'Accreditation Date', value: pick(data, 'accreditation_date', 'accreditationDate'), formatter: formatDate },
    ]} /></DoubleCheckSection> },
  ]
  const name = [pick(data, 'first_name', 'firstName'), pick(data, 'middle_name', 'middleName'), pick(data, 'last_name', 'lastName')].filter(Boolean).join(' ')
  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review User Changes' : 'Review New User')} description={request.description || 'Verify user identity, access, and hierarchy before saving.'} confirmLabel={request.confirmLabel || (request.mode === 'edit' ? 'Confirm & Save User' : 'Confirm & Create User')} summary={name} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default UserDoubleCheck
