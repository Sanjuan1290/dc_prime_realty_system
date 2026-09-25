import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import { pick, requirementLabel, statusLabel } from './core/doubleCheckFormatters'
import { getDocumentResponsiblePartyLabel } from '../../../utils/documentRequirement'

const DocumentDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const steps = [{ key: 'document', title: 'Document Information', content: <DoubleCheckSection title="Document Information" helper="Verify the reusable Document Library item and its default requirement." tone="blue"><DoubleCheckFields fields={[
    { label: 'Document Name', value: pick(data, 'document_name', 'name'), wide: true },
    { label: 'Document Code', value: pick(data, 'document_code', 'code'), wide: true },
    { label: 'Description', value: pick(data, 'document_description', 'description'), wide: true },
    { label: 'Requirement', value: pick(data, 'document_is_required', 'requirement'), formatter: requirementLabel },
    { label: 'Responsible Party', value: pick(data, 'document_responsible_party', 'responsibleParty'), formatter: getDocumentResponsiblePartyLabel },
    { label: 'Status', value: pick(data, 'document_status', 'status'), formatter: statusLabel },
  ]} /></DoubleCheckSection> }]
  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review Document Changes' : 'Review Document')} description={request.description || 'Verify the Document Library information before saving.'} confirmLabel={request.confirmLabel || 'Confirm & Save Document'} summary={pick(data, 'document_name', 'name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default DocumentDoubleCheck

