import DoubleCheckShell from './core/DoubleCheckShell'
import DoubleCheckSection from './core/DoubleCheckSection'
import DoubleCheckFields from './core/DoubleCheckFields'
import DoubleCheckListCard from './core/DoubleCheckListCard'
import { money, percent, pick, requirementLabel, statusLabel, titleCase } from './core/doubleCheckFormatters'

const cleanDocument = (document = {}) => ({
  name: document.name || 'Document',
  description: document.description || '',
  source: document.source || 'Document Library',
  requirement: document.requirement,
  status: document.status || 'active',
})

const ListingDoubleCheck = ({ request, onConfirm, onCancel }) => {
  const payload = request.data || {}
  const current = payload.currentListing || null
  const data = payload.newValues || payload
  const documents = (Array.isArray(data.documentRequirements) ? data.documentRequirements : Array.isArray(data.documents) ? data.documents : []).map(cleanDocument)
  const cadastralLots = Array.isArray(data.cadastralLots) ? data.cadastralLots : [pick(data, 'cadastralLotNo', 'cadastral_lot_no')].filter(Boolean)
  const pricing = data.priceBreakdown || {}
  const installment = pricing.installment || {}
  const cash = pricing.cash || {}
  const mode = request.mode || (current ? 'edit' : 'create')

  const infoFields = [
    { label: 'Project', value: pick(data, 'projectName', 'project_name') || request.meta?.projectName, wide: true },
    { label: 'Unit', value: pick(data, 'unitCode', 'unit_id', 'unitNumber') || request.meta?.unit },
    { label: 'Lot Type', value: pick(data, 'lotType', 'lot_type'), formatter: titleCase },
    { label: 'Lot Area (SQM)', value: pick(data, 'lotAreaSqm', 'areaSqm', 'lot_project_listing_area_sqm') },
    { label: 'Old Unit IDs', value: pick(data, 'oldUnitIds', 'old_unit_ids') },
    { label: 'Status', value: pick(data, 'status', 'listing_status'), formatter: statusLabel },
  ]

  const pricingFields = [
    { label: 'Reservation Fee', value: pick(data, 'reservationFee') || pricing.reservationFee, formatter: money, tone: 'financial' },
    { label: 'Installment Price / SQM', value: pick(data, 'installmentPricePerSqm', 'pricePerSqm'), formatter: money, tone: 'financial' },
    { label: 'Cash Price / SQM', value: pick(data, 'cashPricePerSqm'), formatter: money, tone: 'financial' },
    { label: 'Legal / Misc Rate', value: pick(data, 'legalMiscRate'), formatter: percent, tone: 'financial' },
    { label: 'Annual Interest Rate', value: pick(data, 'annualInterestRate'), formatter: percent, tone: 'financial' },
  ]
  if (Object.keys(installment).length) {
    pricingFields.push(
      { label: 'Installment Base Selling Price', value: installment.baseSellingPrice, formatter: money, tone: 'financial' },
      { label: 'Installment LMF', value: installment.lmfAmount, formatter: money, tone: 'financial' },
      { label: 'Installment TCP', value: installment.tcp, formatter: money, tone: 'financial' },
    )
  }
  if (Object.keys(cash).length) {
    pricingFields.push(
      { label: 'Cash Base Selling Price', value: cash.baseSellingPrice, formatter: money, tone: 'financial' },
      { label: 'Cash LMF', value: cash.lmfAmount, formatter: money, tone: 'financial' },
      { label: 'Cash TCP', value: cash.tcp, formatter: money, tone: 'financial' },
    )
  }

  const steps = [
    {
      key: 'information', title: 'Listing Information', content: (
        <DoubleCheckSection title="Listing Information" helper="Verify the unit, property details, and status." tone="blue">
          {current ? <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase tracking-wide text-slate-500">Currently Saved</p><DoubleCheckFields fields={[
            { label: 'Unit', value: pick(current, 'unit', 'unitCode') },
            { label: 'Cadastral Lot', value: pick(current, 'cadastralLot') },
            { label: 'Lot Type', value: pick(current, 'lotType'), formatter: titleCase },
            { label: 'Area (SQM)', value: pick(current, 'areaSqm') },
            { label: 'Status', value: pick(current, 'status'), formatter: statusLabel },
          ]} /></div> : null}
          <DoubleCheckFields fields={infoFields} />
        </DoubleCheckSection>
      )
    },
    {
      key: 'cadastral', title: 'Cadastral Lots', content: (
        <DoubleCheckSection title="Cadastral Lots" helper="Verify the selected cadastral lot." tone="cyan">
          {cadastralLots.length ? <div className="grid gap-3 sm:grid-cols-2">{cadastralLots.map((lot, index) => <DoubleCheckListCard key={`${lot}-${index}`} title={`Cadastral Lot ${lot}`} index={index} total={cadastralLots.length} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No cadastral lot is selected.</p>}
        </DoubleCheckSection>
      )
    },
    {
      key: 'documents', title: 'Document Checklist', content: (
        <DoubleCheckSection title="Document Checklist" helper="Project-default and manually added documents use the same review format." tone="emerald" badge={`${documents.length} document${documents.length === 1 ? '' : 's'}`}>
          {documents.length ? <div className="space-y-3">{documents.map((document, index) => <DoubleCheckListCard key={`${document.name}-${index}`} title={document.name} subtitle={document.source} index={index} total={documents.length} fields={[
            { label: 'Requirement', value: document.requirement, formatter: requirementLabel },
            { label: 'Status', value: document.status, formatter: statusLabel },
            ...(document.description ? [{ label: 'Description', value: document.description, wide: true }] : []),
          ]} />)}</div> : <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm font-semibold text-slate-500">No documents are selected for this listing.</p>}
        </DoubleCheckSection>
      )
    },
    {
      key: 'pricing', title: 'Price Breakdown', content: (
        <DoubleCheckSection title="Price Breakdown" helper="Verify only the pricing inputs and calculated totals relevant to this listing." tone="amber"><DoubleCheckFields fields={pricingFields} /></DoubleCheckSection>
      )
    },
  ]

  return <DoubleCheckShell title={request.title || (mode === 'edit' ? 'Review Listing Changes' : 'Review New Listing')} description={request.description || 'Review listing information, documents, and pricing before saving.'} confirmLabel={request.confirmLabel || (mode === 'edit' ? 'Confirm & Save Listing' : 'Confirm & Add Listing')} summary={pick(data, 'unitCode', 'unit_id') || request.meta?.unit} steps={steps} onConfirm={onConfirm} onCancel={onCancel} />
}

export default ListingDoubleCheck

