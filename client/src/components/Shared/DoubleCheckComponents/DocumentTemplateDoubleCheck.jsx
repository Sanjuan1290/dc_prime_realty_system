import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { pick, requirementLabel, statusLabel } from './core/doubleCheckFormatters'
import { getDocumentResponsiblePartyLabel } from '../../../utils/documentRequirement'

const DocumentTemplateDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const info = data.templateInformation || data
  const docs = Array.isArray(data.templateDocuments) ? data.templateDocuments : Array.isArray(data.documents) ? data.documents : []
  const steps = [
    { key: 'info', title: 'Template Information', content: <DoubleCheckSection title="Template Information" helper="Verify the template name, description, and status." tone="blue"><DoubleCheckFields fields={[
      { label: 'Template Name', value: pick(info, 'templateName', 'template_name'), wide: true },
      { label: 'Template Description', value: pick(info, 'templateDescription', 'template_description'), wide: true },
      { label: 'Template Status', value: pick(info, 'templateStatus', 'template_status'), formatter: statusLabel },
    ]} /></DoubleCheckSection> },
    { key: 'documents', title: 'Template Documents', content: <DoubleCheckSection title="Template Documents" helper="Verify each selected document and whether it is Required or Optional." tone="emerald" badge={`${docs.length} document${docs.length === 1 ? '' : 's'}`}>{docs.length ? <div className="space-y-3">{docs.map((document, index) => <DoubleCheckListCard key={`${pick(document, 'document_id', 'id') || index}`} title={pick(document, 'documentName', 'document_name', 'name', 'reviewTitle') || `Document ${index + 1}`} index={index} total={docs.length} fields={[
      { label: 'Requirement', value: pick(document, 'is_required', 'requirement'), formatter: requirementLabel },
      { label: 'Responsible Party', value: pick(document, 'responsibleParty', 'responsible_party'), formatter: getDocumentResponsiblePartyLabel },
      { label: 'Status', value: pick(document, 'status', 'document_status') || 'active', formatter: statusLabel },
    ]} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No documents are selected for this template.</p>}</DoubleCheckSection> },
  ]
  return <DoubleCheckShell title={request.title || (request.mode === 'edit' ? 'Review Template Changes' : 'Review New Template')} description={request.description || 'Verify template information and selected documents before saving.'} confirmLabel={request.confirmLabel || (request.mode === 'edit' ? 'Confirm & Save Template' : 'Confirm & Add Template')} summary={pick(info, 'templateName', 'template_name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default DocumentTemplateDoubleCheck

