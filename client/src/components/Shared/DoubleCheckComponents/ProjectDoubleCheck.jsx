import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { pick, requirementLabel, statusLabel } from './core/doubleCheckFormatters'
import { getDocumentResponsiblePartyLabel } from '../../../utils/documentRequirement'

const ProjectDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const data = request.data || {}
  const cadastralLots = Array.isArray(data.cadastralLots) ? data.cadastralLots : []
  const documents = Array.isArray(data.defaultDocuments) ? data.defaultDocuments : []
  const mode = request.mode || (request.action === 'edit' ? 'edit' : 'create')

  const steps = [
    {
      key: 'information',
      title: 'Project Information',
      content: (
        <DoubleCheckSection title="Project Information" helper="Verify the project identity and status." tone="blue">
          <DoubleCheckFields fields={[
            { label: 'Project Name', value: pick(data, 'name', 'lot_project_name'), wide: true },
            { label: 'Location', value: pick(data, 'location', 'lot_project_location') },
            { label: 'Location Code', value: pick(data, 'locationCode', 'lot_project_location_code') },
            { label: 'Administrator', value: pick(data, 'administrator', 'lot_project_administrator_name') },
            { label: 'Tax Declaration No.', value: pick(data, 'taxDeclarationNo', 'lot_project_tax_declaration_no') },
            { label: 'Title Number', value: pick(data, 'titleNumber', 'lot_project_title_number') },
            { label: 'PIN', value: pick(data, 'pin', 'lot_project_pin') },
            { label: 'Status', value: pick(data, 'status', 'lot_project_status'), formatter: statusLabel },
          ]} />
        </DoubleCheckSection>
      ),
    },
    {
      key: 'cadastral',
      title: 'Cadastral Lots',
      content: (
        <DoubleCheckSection title="Cadastral Lots" helper="Verify every cadastral lot number assigned to this project." tone="cyan" badge={`${cadastralLots.length} lot${cadastralLots.length === 1 ? '' : 's'}`}>
          {cadastralLots.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {cadastralLots.map((lot, index) => (
                <DoubleCheckListCard key={`${lot}-${index}`} title={`Cadastral Lot ${lot}`} index={index} total={cadastralLots.length} />
              ))}
            </div>
          ) : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">No cadastral lot numbers were added.</p>}
        </DoubleCheckSection>
      ),
    },
    {
      key: 'documents',
      title: 'Default Documents',
      content: (
        <DoubleCheckSection title="Default Documents" helper="Verify each document and its Required / Optional and Active / Inactive setting." tone="emerald" badge={`${documents.length} document${documents.length === 1 ? '' : 's'}`}>
          {documents.length ? <div className="space-y-3">{documents.map((document, index) => (
            <DoubleCheckListCard
              key={`${pick(document, 'document_id', 'id') || index}`}
              title={pick(document, 'reviewTitle', 'name', 'document_name') || `Default Document ${index + 1}`}
              index={index}
              total={documents.length}
              fields={[
                { label: 'Requirement', value: pick(document, 'requirement', 'is_required'), formatter: requirementLabel },
                { label: 'Responsible Party', value: pick(document, 'responsibleParty', 'responsible_party'), formatter: getDocumentResponsiblePartyLabel },
                { label: 'Status', value: pick(document, 'status', 'document_status'), formatter: statusLabel },
              ]}
            />
          ))}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">No default documents are selected for this project.</p>}
        </DoubleCheckSection>
      ),
    },
  ]

  return <DoubleCheckShell title={request.title || (mode === 'edit' ? 'Review Project Changes' : 'Review New Project')} description={request.description || 'Review project information, cadastral lots, and default documents before saving.'} confirmLabel={request.confirmLabel || (mode === 'edit' ? 'Confirm & Save Project' : 'Confirm & Add Project')} summary={pick(data, 'name', 'lot_project_name')} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default ProjectDoubleCheck

