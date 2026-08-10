import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { pick, requirementLabel, statusLabel } from './core/doubleCheckFormatters'

const cleanDocument = (document = {}) => ({
  name: pick(document, 'reviewTitle', 'name', 'document_name', 'documentName') || 'Document',
  description: pick(document, 'description', 'document_description'),
  source: pick(document, 'source') || 'Document Library',
  requirement: pick(document, 'requirement', 'is_required', 'document_is_required', 'lot_project_listing_document_is_required', 'lot_project_default_document_is_required'),
  status: pick(document, 'status', 'document_status', 'lot_project_listing_document_status', 'lot_project_default_document_status') || 'active',
})

const ListingDocumentRequirementsDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const source = request.data?.documents || request.data?.documentRequirements || request.data || []
  const documents = (Array.isArray(source) ? source : []).map(cleanDocument)
  const steps = [{
    key: 'documents',
    title: 'Document Checklist',
    content: (
      <DoubleCheckSection title="Document Checklist" helper="Verify every selected document and whether it is Required or Optional." tone="emerald" badge={`${documents.length} document${documents.length === 1 ? '' : 's'}`}>
        {documents.length ? <div className="space-y-3">{documents.map((document, index) => (
          <DoubleCheckListCard
            key={`${document.name}-${index}`}
            title={document.name}
            index={index}
            total={documents.length}
            fields={[
              { label: 'Description', value: document.description, wide: true },
              { label: 'Source', value: document.source },
              { label: 'Requirement', value: document.requirement, formatter: requirementLabel },
              { label: 'Status', value: document.status, formatter: statusLabel },
            ]}
          />
        ))}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">No documents are selected for this listing.</p>}
      </DoubleCheckSection>
    ),
  }]

  return <DoubleCheckShell title={request.title || 'Review Listing Document Requirements'} description={request.description || 'Verify the listing-specific checklist before saving it.'} confirmLabel={request.confirmLabel || 'Confirm & Save Requirements'} summary={request.summary} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default ListingDocumentRequirementsDoubleCheck

