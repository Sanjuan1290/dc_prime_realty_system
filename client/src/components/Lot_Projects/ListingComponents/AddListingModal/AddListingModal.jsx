import { useEffect, useMemo, useState } from 'react'
import { FiFileText, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import EditListingDocumentsModal from '../EditListingDocumentsModal/EditListingDocumentsModal'

const Field = ({ label, value, onChange, placeholder, type = 'text', helper, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const SelectField = ({ label, value, onChange, children, helper, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    >
      {children}
    </select>

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const money = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const normalizeDocument = (document) => ({
  ...document,
  id: document.id || document.document_id,
  document_id: document.document_id || document.id,
  name: document.name || document.document_name,
  description: document.description || document.document_description || 'Project Default',
  source: document.source || 'Project Default',
  requirement: document.requirement || (document.lot_project_default_document_is_required ? 'required' : 'optional'),
  status: document.status || document.lot_project_default_document_status || document.document_status || 'active',
})

const AddListingModal = ({ project = {}, projectDefaultDocuments = [], libraryDocuments = [], isLoadingDefaults = false, onClose, onSave, isSaving = false }) => {
  const selectedProject = useMemo(() => ({
    id: project.id || project.lot_project_id,
    name: project.name || project.lot_project_name || 'Lot Project',
    locationCode: project.locationCode || project.lot_project_location_code || 'LOT',
    cadastralLots: (project.cadastralLots || []).map((lot) => lot.lotNumber || lot.lot_project_cadastral_lot_number || lot).filter(Boolean),
  }), [project])

  const [form, setForm] = useState({
    cadastralLotNo: '',
    unitNumber: '',
    oldUnitIds: '',
    lotType: 'inner',
    reservationFee: '50000',
    pricePerSqm: '0',
    lotAreaSqm: '0',
    legalMiscRate: '10',
    annualInterestRate: '0',
    status: 'available',
  })

  const [documentRequirements, setDocumentRequirements] = useState(() => projectDefaultDocuments.map(normalizeDocument))
  const [showEditDocumentsModal, setShowEditDocumentsModal] = useState(false)
  const [alert, setAlert] = useState(null)
  const [isSavingDraft, setIsSavingDraft] = useState(false)

  useEffect(() => {
    if (projectDefaultDocuments.length) {
      setDocumentRequirements(projectDefaultDocuments.map(normalizeDocument))
    }
  }, [projectDefaultDocuments])

  const unitCode = useMemo(() => {
    const number = String(form.unitNumber || '').trim()
    return number ? `${selectedProject.locationCode}-${number}` : `${selectedProject.locationCode}-`
  }, [form.unitNumber, selectedProject.locationCode])

  const priceBreakdown = useMemo(() => {
    const pricePerSqm = Number(form.pricePerSqm || 0)
    const lotAreaSqm = Number(form.lotAreaSqm || 0)
    const legalMiscRate = Number(form.legalMiscRate || 0)
    const reservationFee = Number(form.reservationFee || 0)
    const annualInterestRate = Number(form.annualInterestRate || 0)

    const netSellingPrice = pricePerSqm * lotAreaSqm
    const lmfAmount = netSellingPrice * (legalMiscRate / 100)
    const tcp = netSellingPrice + lmfAmount

    return { netSellingPrice, lmfAmount, tcp, reservationFee, annualInterestRate }
  }, [form])

  const requiredCount = useMemo(
    () => documentRequirements.filter((document) => document.requirement === 'required').length,
    [documentRequirements]
  )

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))

    if (alert?.type === 'error') {
      setAlert(null)
    }
  }

  const handleDocumentsChange = (nextDocuments) => {
    setDocumentRequirements(nextDocuments.map(normalizeDocument))
    setAlert({ type: 'success', message: 'Listing document requirements updated.' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.unitNumber.trim()) {
      setAlert({ type: 'error', message: 'Unit number is required.' })
      return
    }

    if (Number(form.pricePerSqm || 0) <= 0) {
      setAlert({ type: 'error', message: 'Price per SQM must be greater than 0.' })
      return
    }

    if (Number(form.lotAreaSqm || 0) <= 0) {
      setAlert({ type: 'error', message: 'Lot area SQM must be greater than 0.' })
      return
    }

    const payload = {
      ...form,
      projectId: selectedProject.id,
      projectName: selectedProject.name,
      locationCode: selectedProject.locationCode,
      unitCode,
      cadastralLots: form.cadastralLotNo ? [form.cadastralLotNo] : [],
      documentRequirements,
      priceBreakdown,
    }

    if (onSave) {
      try {
        await onSave(payload)
      } catch (error) {
        setAlert({ type: 'error', message: error?.message || 'Failed to add listing.' })
      }
      return
    }

    setIsSavingDraft(true)
    setAlert({ type: 'loading', message: 'Adding listing...' })

    window.setTimeout(() => {
      setIsSavingDraft(false)
      setAlert({ type: 'success', message: `${unitCode} added successfully.` })
    }, 700)
  }

  const saveDisabled = isSaving || isSavingDraft

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-lg font-black text-slate-950">Add Listing</h2>

          <button
            type="button"
            onClick={onClose}
            disabled={saveDisabled}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close add listing modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          {isSaving ? <StatusAlert type="loading" message="Saving listing to database..." className="mb-4" /> : null}
          {isLoadingDefaults ? <StatusAlert type="loading" message="Loading project default documents..." className="mb-4" /> : null}

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Current Project</p>
              <p className="mt-1 text-lg font-black text-slate-950">{selectedProject.name}</p>
              <p className="mt-1 text-sm font-semibold text-slate-600">Unit prefix is locked to {selectedProject.locationCode}-</p>
            </div>

            <SelectField label="Cadastral Lot No." value={form.cadastralLotNo} onChange={(value) => updateField('cadastralLotNo', value)} helper="Only cadastral lots from this project are shown.">
              <option value="">Select cadastral lot number</option>
              {selectedProject.cadastralLots.map((lot) => <option key={lot} value={lot}>{lot}</option>)}
            </SelectField>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">Unit ID <span className="text-red-500">*</span></span>
              <div className="flex h-11 overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                <span className="flex w-24 items-center justify-center border-r border-slate-300 bg-slate-100 text-sm font-black text-blue-700">{selectedProject.locationCode}-</span>
                <input value={form.unitNumber} onChange={(event) => updateField('unitNumber', event.target.value)} placeholder="1001" className="min-w-0 flex-1 px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400" />
              </div>
              <p className="text-xs font-semibold text-slate-500">Project code is locked. Admin only types the unit number after the prefix.</p>
            </label>

            <Field label="Old Unit IDs" value={form.oldUnitIds} onChange={(value) => updateField('oldUnitIds', value)} placeholder={`Example: ${selectedProject.locationCode}-204, Lot 204 old survey ID`} />

            <SelectField label="Lot Type" value={form.lotType} onChange={(value) => updateField('lotType', value)}>
              <option value="inner">Inner</option>
              <option value="corner">Corner</option>
              <option value="end">End</option>
            </SelectField>

            <Field label="Reservation Fee" type="number" value={form.reservationFee} onChange={(value) => updateField('reservationFee', value)} placeholder="50000" />
            <Field label="Price / SQM" type="number" value={form.pricePerSqm} onChange={(value) => updateField('pricePerSqm', value)} placeholder="0" required />
            <Field label="Lot Area SQM" type="number" value={form.lotAreaSqm} onChange={(value) => updateField('lotAreaSqm', value)} placeholder="0" required />
            <Field label="Legal / Misc Rate (%)" type="number" value={form.legalMiscRate} onChange={(value) => updateField('legalMiscRate', value)} placeholder="10" helper="Enter percentage only. Example: 10 means 10%." />
            <Field label="Annual Interest Rate (%)" type="number" value={form.annualInterestRate} onChange={(value) => updateField('annualInterestRate', value)} placeholder="0" helper="Used for monthly amortization and SOA interest view." />

            <SelectField label="Status" value={form.status} onChange={(value) => updateField('status', value)}>
              <option value="available">Available</option>
              <option value="hold">Hold</option>
              <option value="sold">Sold</option>
              <option value="pending_for_cancellation">Pending for Cancellation</option>
              <option value="cancelled">Cancelled</option>
            </SelectField>
          </section>

          <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-950">Listing Document Requirements</h3>
                <p className="mt-1 text-xs font-semibold text-slate-600">Click Edit Documents to set this listing&apos;s checklist before saving. Leave empty to use project defaults.</p>
              </div>

              <button type="button" onClick={() => setShowEditDocumentsModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]">
                <FiFileText className="h-4 w-4" />
                Edit Documents
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">{documentRequirements.length} docs</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{requiredCount} required</span>
            </div>
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Live Price Breakdown</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Net Selling Price</p><p className="mt-2 text-lg font-black text-slate-950">{money(priceBreakdown.netSellingPrice)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">LMF Amount</p><p className="mt-2 text-lg font-black text-slate-950">{money(priceBreakdown.lmfAmount)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">TCP</p><p className="mt-2 text-lg font-black text-slate-950">{money(priceBreakdown.tcp)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Reservation Fee</p><p className="mt-2 text-lg font-black text-slate-950">{money(priceBreakdown.reservationFee)}</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Annual Interest Rate</p><p className="mt-2 text-lg font-black text-slate-950">{Number(priceBreakdown.annualInterestRate || 0)}%</p></div>
              <div className="rounded-xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Preview Unit Code</p><p className="mt-2 text-lg font-black text-blue-700">{unitCode}</p></div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} disabled={saveDisabled} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={saveDisabled} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><FiSave className="h-4 w-4" />{saveDisabled ? 'Saving...' : 'Add Listing'}</button>
        </div>

        {showEditDocumentsModal ? (
          <EditListingDocumentsModal
            selectedDocuments={documentRequirements}
            setSelectedDocuments={handleDocumentsChange}
            libraryDocuments={libraryDocuments}
            projectDefaultDocuments={projectDefaultDocuments}
            onClose={() => setShowEditDocumentsModal(false)}
          />
        ) : null}
      </form>
    </div>
  )
}

export default AddListingModal

