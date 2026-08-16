import { useEffect, useMemo, useState } from 'react'
import { FiFileText, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import EditListingDocumentsModal from '../../ListingComponents/EditListingDocumentsModal/EditListingDocumentsModal'
import { calculateContractPricing } from '../../../../utils/listingPricing.js'
import { resolveDocumentRequirement } from '../../../../utils/documentRequirement.js'

const statusOptions = [
  { value: 'available', label: 'Available' },
  { value: 'hold', label: 'Hold' },
  { value: 'sold', label: 'Sold' },
  { value: 'pending_for_cancellation', label: 'Pending for Cancellation' },
  { value: 'cancelled', label: 'Cancelled' },
]

const lotTypes = [
  { value: 'inner', label: 'Inner' },
  { value: 'corner', label: 'Corner' },
  { value: 'end', label: 'End' },
]

const parseMoney = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace(/[₱,%\s,]/g, '').replace('sqm', '')) || 0
}

const parsePercent = (value) => {
  if (typeof value === 'number') return value
  return Number(String(value || '').replace('%', '').trim()) || 0
}

const getUnitNumber = (unitId = '', locationCode = '') => {
  const value = String(unitId || '')
  const prefix = `${locationCode}-`
  if (locationCode && value.startsWith(prefix)) return value.slice(prefix.length)
  return value.includes('-') ? value.split('-').pop() : value
}

const formatMoney = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const toStatusValue = (status = '', rawStatus = '') => {
  const raw = String(rawStatus || '').toLowerCase()
  if (['available', 'hold', 'sold', 'pending_for_cancellation', 'cancelled'].includes(raw)) return raw

  const normalized = String(status).toLowerCase()
  if (normalized.includes('pending')) return 'pending_for_cancellation'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('cancelled')) return 'cancelled'
  if (normalized.includes('sold') || normalized.includes('fully')) return 'sold'
  if (normalized.includes('hold')) return 'hold'

  return 'available'
}

const splitLots = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const getLotNumberValue = (lot) =>
  String(lot?.lotNumber || lot?.lot_project_cadastral_lot_number || lot?.value || lot || '').trim()

const normalizeListingDocument = (document = {}) => ({
  id: Number(document.document_id || document.id || 0) || null,
  document_id: Number(document.document_id || document.id || 0) || null,
  name: document.name || document.document_name || 'Document',
  description: document.description || document.document_description || '',
  source: document.source || 'Listing Requirement',
  requirement: resolveDocumentRequirement(document),
  status: String(
    document.lot_project_listing_document_status ||
    document.lot_project_default_document_status ||
    document.document_status ||
    document.status ||
    'active'
  ).toLowerCase() === 'inactive' ? 'inactive' : 'active',
})

const normalizeOldUnitIds = (value = '') =>
  String(value || '')
    .split(/[,;\n]+/)
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)

const hasOldUnitId = (value, unitId) =>
  Boolean(unitId) && normalizeOldUnitIds(value).includes(String(unitId).trim().toUpperCase())

const appendOldUnitId = (value, unitId) => {
  const cleanUnitId = String(unitId || '').trim().toUpperCase()
  if (!cleanUnitId || hasOldUnitId(value, cleanUnitId)) return String(value || '').trim()
  const current = String(value || '').trim()
  return current ? `${current}, ${cleanUnitId}` : cleanUnitId
}

const documentRequirementSignature = (documents = []) =>
  documents
    .map(normalizeListingDocument)
    .filter((document) => document.id)
    .map((document) => `${document.id}:${document.requirement}:${document.status}`)
    .sort()
    .join('|')

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  helper,
  required = false,
  min,
  step,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      min={min}
      step={step}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const SelectField = ({ label, value, onChange, children, helper, required = false, multiple = false, disabled = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <select
      multiple={multiple}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        if (multiple) {
          onChange(Array.from(event.target.selectedOptions).map((option) => option.value))
          return
        }
        onChange(event.target.value)
      }}
      className={`${multiple ? 'min-h-28 py-2' : 'h-11'} rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50`}
    >
      {children}
    </select>

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const BreakdownCard = ({ label, value, highlight = false }) => (
  <div className={`rounded-xl border p-4 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
    <p className={`text-xs font-black uppercase ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-2 text-lg font-black ${highlight ? 'text-blue-900' : 'text-slate-950'}`}>{value}</p>
  </div>
)

const EditUnitStatusModal = ({ listing, project = {}, listingDocuments = [], libraryDocuments = [], projectDefaultDocuments = [], onClose, onSave, isSaving = false }) => {
  const locationCode = project.locationCode || project.lot_project_location_code || listing?.locationCode || 'LA'
  const selectedLotNumber = Array.isArray(listing?.cadastralLots)
    ? getLotNumberValue(listing.cadastralLots[0])
    : splitLots(listing?.cadastral_lot_no === '-' ? '' : listing?.cadastral_lot_no)[0] || ''

  const cadastralOptions = useMemo(() => {
    const options = Array.isArray(project.cadastralLots)
      ? project.cadastralLots
          .map(getLotNumberValue)
          .filter(Boolean)
      : []

    if (selectedLotNumber && !options.includes(selectedLotNumber)) {
      return [selectedLotNumber, ...options]
    }

    return options
  }, [project.cadastralLots, selectedLotNumber])

  const currentStatus = toStatusValue(listing?.listing_status || listing?.status, listing?.rawStatus)
  const allowedStatusOptions = useMemo(() => {
    if (currentStatus === 'sold') {
      return statusOptions.filter((status) =>
        ['sold', 'pending_for_cancellation'].includes(status.value)
      )
    }

    return statusOptions.filter((status) => status.value === currentStatus)
  }, [currentStatus])

  const statusHelper = currentStatus === 'sold'
    ? 'A sold unit can only move to Pending for Cancellation here. Complete Settlement before returning it to Available.'
    : currentStatus === 'pending_for_cancellation'
      ? 'Status is locked here. Use Settlement or Cancel Cancellation on Unit & Status.'
      : currentStatus === 'cancelled'
        ? 'Status is locked. Use Close Account & Make Available to retain the cancelled buyer history and release the unit for a new account.'
        : currentStatus === 'hold'
          ? 'Status is locked. Use Unhold or complete the pending buyer form review.'
          : 'Status is locked. Use Hold or Reserve from the Listing Profile actions.'

  const [form, setForm] = useState({
    cadastralLotNo: selectedLotNumber,
    unitNumber: getUnitNumber(listing?.unit_id || listing?.unitCode || '', locationCode),
    oldUnitIds: listing?.old_unit_ids === '-' ? '' : listing?.old_unit_ids || '',
    lotType: (() => {
      const lotType = String(listing?.lot_type || 'Inner').toLowerCase()
      if (lotType === 'corner') return 'corner'
      if (lotType === 'end') return 'end'
      return 'inner'
    })(),
    reservationFee: String(listing?.reservationFee || 0),
    installmentPricePerSqm: String(listing?.installmentPricePerSqm || listing?.pricePerSqm || parseMoney(listing?.price_per_sqm) || 0),
    cashPricePerSqm: String(listing?.cashPricePerSqm || listing?.installmentPricePerSqm || listing?.pricePerSqm || parseMoney(listing?.price_per_sqm) || 0),
    lotAreaSqm: String(listing?.lotAreaSqm || parseMoney(listing?.lot_area_sqm) || 0),
    legalMiscRate: String(listing?.legalMiscRate || parsePercent(listing?.lmf_rate) || 0),
    annualInterestRate: String(listing?.annualInterestRate || parsePercent(listing?.interestRate) || 0),
    status: currentStatus,
  })

  const initialDocumentRequirements = useMemo(() => {
    const sourceDocuments = listingDocuments.length ? listingDocuments : projectDefaultDocuments
    return sourceDocuments
      .map((document) => normalizeListingDocument({
        ...document,
        source: listingDocuments.length ? 'Listing Requirement' : 'Project Default',
      }))
      .filter((document) => document.id && document.status === 'active')
  }, [listingDocuments, projectDefaultDocuments])
  const [documentRequirements, setDocumentRequirements] = useState(() => initialDocumentRequirements)
  const [showEditDocumentsModal, setShowEditDocumentsModal] = useState(false)
  const [showOldUnitIdConfirm, setShowOldUnitIdConfirm] = useState(false)
  const [lastSuggestedUnitCode, setLastSuggestedUnitCode] = useState('')
  const [alert, setAlert] = useState(null)
  const originalUnitCode = String(listing?.unit_id || listing?.unitCode || '').trim().toUpperCase()

  const unitCode = useMemo(() => {
    const unitNumber = String(form.unitNumber || '').trim().toUpperCase()
    return unitNumber ? `${locationCode}-${unitNumber}` : `${locationCode}-`
  }, [form.unitNumber, locationCode])

  const unitIdChanged = Boolean(originalUnitCode && unitCode !== originalUnitCode)
  const cadastralChanged = String(form.cadastralLotNo || '') !== String(selectedLotNumber || '')
  const documentsChanged = documentRequirementSignature(documentRequirements) !== documentRequirementSignature(initialDocumentRequirements)
  const previousUnitIdRetained = !unitIdChanged || hasOldUnitId(form.oldUnitIds, originalUnitCode)

  useEffect(() => {
    if (!unitIdChanged || !originalUnitCode || lastSuggestedUnitCode === unitCode) return
    setForm((current) => ({
      ...current,
      oldUnitIds: appendOldUnitId(current.oldUnitIds, originalUnitCode),
    }))
    setLastSuggestedUnitCode(unitCode)
  }, [lastSuggestedUnitCode, originalUnitCode, unitCode, unitIdChanged])

  const priceBreakdown = useMemo(() => {
    const shared = {
      lotAreaSqm: Number(form.lotAreaSqm || 0),
      legalMiscRate: Number(form.legalMiscRate || 0),
    }

    return {
      installment: calculateContractPricing({
        ...shared,
        pricePerSqm: Number(form.installmentPricePerSqm || 0),
      }),
      cash: calculateContractPricing({
        ...shared,
        pricePerSqm: Number(form.cashPricePerSqm || 0),
      }),
      reservationFee: Number(form.reservationFee || 0),
      annualInterestRate: Number(form.annualInterestRate || 0),
    }
  }, [form])

  const requiredDocumentCount = useMemo(
    () => documentRequirements.filter((document) => document.requirement === 'required' && document.status === 'active').length,
    [documentRequirements]
  )

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    if (alert?.type === 'error') setAlert(null)
  }

  const handleDocumentsChange = (nextDocuments) => {
    setDocumentRequirements(nextDocuments.map(normalizeListingDocument))
    setAlert({ type: 'success', message: 'Listing document requirements updated. Save Changes to apply them.' })
  }

  const validateForm = () => {
    if (!form.unitNumber.trim()) {
      setAlert({ type: 'error', message: 'Unit number is required.' })
      return false
    }

    if (Number(form.installmentPricePerSqm || 0) <= 0) {
      setAlert({ type: 'error', message: 'Installment price per SQM must be greater than 0.' })
      return false
    }

    if (Number(form.cashPricePerSqm || 0) <= 0) {
      setAlert({ type: 'error', message: 'Cash price per SQM must be greater than 0.' })
      return false
    }

    if (Number(form.lotAreaSqm || 0) <= 0) {
      setAlert({ type: 'error', message: 'Lot area SQM must be greater than 0.' })
      return false
    }

    const allowedStatusValues = new Set(allowedStatusOptions.map((status) => status.value))
    if (!allowedStatusValues.has(form.status)) {
      setAlert({
        type: 'error',
        message: 'This status change is blocked. Follow the cancellation and settlement process instead.',
      })
      return false
    }

    return true
  }

  const saveChanges = async ({ confirmSkipPreviousUnitId = false, oldUnitIdsOverride } = {}) => {
    const lotTypeLabel = lotTypes.find((item) => item.value === form.lotType)?.label || 'Inner'
    const oldUnitIds = oldUnitIdsOverride ?? form.oldUnitIds
    const payload = {
      unitCode,
      unit_id: unitCode,
      oldUnitIds,
      old_unit_ids: oldUnitIds,
      lotType: lotTypeLabel,
      lot_type: lotTypeLabel,
      status: form.status,
      lotAreaSqm: Number(form.lotAreaSqm || 0),
      pricePerSqm: Number(form.installmentPricePerSqm || 0),
      installmentPricePerSqm: Number(form.installmentPricePerSqm || 0),
      cashPricePerSqm: Number(form.cashPricePerSqm || 0),
      legalMiscRate: Number(form.legalMiscRate || 0),
      annualInterestRate: Number(form.annualInterestRate || 0),
      reservationFee: Number(form.reservationFee || 0),
      confirmSkipPreviousUnitId,
    }

    // Relationship arrays are submitted only when the user actually changed them.
    // The backend independently verifies the diff before mutating anything.
    if (cadastralChanged) {
      payload.cadastralLots = form.cadastralLotNo ? [form.cadastralLotNo] : []
      payload.cadastral_lot_no = form.cadastralLotNo
    }
    if (documentsChanged) {
      payload.documentRequirements = documentRequirements
    }

    try {
      setShowOldUnitIdConfirm(false)
      setAlert({
        type: 'loading',
        message: unitIdChanged
          ? `Updating Unit ID from ${originalUnitCode} to ${unitCode}...`
          : 'Saving unit details to database...',
      })
      await onSave?.(payload)
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save unit details.' })
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validateForm()) return

    if (unitIdChanged && !hasOldUnitId(form.oldUnitIds, originalUnitCode)) {
      setShowOldUnitIdConfirm(true)
      return
    }

    await saveChanges()
  }

  const addPreviousUnitIdAndContinue = async () => {
    const nextOldUnitIds = appendOldUnitId(form.oldUnitIds, originalUnitCode)
    setForm((current) => ({ ...current, oldUnitIds: nextOldUnitIds }))
    await saveChanges({ oldUnitIdsOverride: nextOldUnitIds })
  }

  const continueWithoutPreviousUnitId = async () => {
    await saveChanges({ confirmSkipPreviousUnitId: true })
  }


  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-lg font-black text-slate-950">Edit Listing</h2>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close modal"
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

          <section className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">Current Project</p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {project.name || project.lot_project_name || listing?.project_name || 'Lot Project'}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Unit prefix is locked to {locationCode}-
              </p>
            </div>

            <SelectField
              label="Cadastral Lot No."
              value={form.cadastralLotNo}
              onChange={(value) => updateField('cadastralLotNo', value)}
              helper="Only cadastral lots from this project are shown."
            >
              <option value="">Select cadastral lot number</option>
              {cadastralOptions.map((lotNumber) => (
                <option key={lotNumber} value={lotNumber}>
                  {lotNumber}
                </option>
              ))}
            </SelectField>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">
                Unit ID <span className="text-red-500">*</span>
              </span>

              <div className="flex h-11 overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                <span className="flex w-24 items-center justify-center border-r border-slate-300 bg-slate-100 text-sm font-black text-blue-700">
                  {locationCode}-
                </span>
                <input
                  value={form.unitNumber}
                  onChange={(event) => updateField('unitNumber', event.target.value)}
                  placeholder="1001"
                  className="min-w-0 flex-1 px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <p className="text-xs font-semibold text-slate-500">
                Project code is locked. Type only the unit number after the prefix.
              </p>

            </label>

            <div className="flex flex-col gap-1.5">
              <Field
                label="Old Unit IDs"
                value={form.oldUnitIds}
                onChange={(value) => updateField('oldUnitIds', value)}
                placeholder="Example: LA-204, Lot 204 old survey ID"
                helper={unitIdChanged
                  ? `Recommended: keep ${originalUnitCode} so the previous Unit ID remains searchable in listing history.`
                  : 'Optional historical Unit IDs or survey references for this listing.'}
              />
              {unitIdChanged && previousUnitIdRetained ? (
                <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
                  {originalUnitCode} was recommended automatically because the Unit ID changed.
                </p>
              ) : null}
              {unitIdChanged && !previousUnitIdRetained ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
                  The previous Unit ID {originalUnitCode} is not being retained. You will be asked to confirm this before saving.
                </p>
              ) : null}
            </div>

            <SelectField label="Lot Type" value={form.lotType} onChange={(value) => updateField('lotType', value)}>
              {lotTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </SelectField>

            <Field
              label="Reservation Fee"
              type="number"
              min="0"
              step="0.01"
              value={form.reservationFee}
              onChange={(value) => updateField('reservationFee', value)}
              placeholder="50000"
            />

            <Field
              label="Price / SQM — Installment"
              type="number"
              min="0"
              step="0.01"
              value={form.installmentPricePerSqm}
              onChange={(value) => updateField('installmentPricePerSqm', value)}
              placeholder="0"
              helper="Used when the reservation mode is Installment."
              required
            />

            <Field
              label="Price / SQM — Cash"
              type="number"
              min="0"
              step="0.01"
              value={form.cashPricePerSqm}
              onChange={(value) => updateField('cashPricePerSqm', value)}
              placeholder="0"
              helper="Used when the reservation mode is Cash."
              required
            />

            <Field
              label="Lot Area SQM"
              type="number"
              min="0"
              step="0.01"
              value={form.lotAreaSqm}
              onChange={(value) => updateField('lotAreaSqm', value)}
              placeholder="0"
              required
            />

            <Field
              label="Legal / Misc Rate (%)"
              type="number"
              min="0"
              step="0.01"
              value={form.legalMiscRate}
              onChange={(value) => updateField('legalMiscRate', value)}
              placeholder="10"
              helper="Enter percentage only. Example: 10 means 10%."
            />

            <Field
              label="Annual Interest Rate (%)"
              type="number"
              min="0"
              step="0.01"
              value={form.annualInterestRate}
              onChange={(value) => updateField('annualInterestRate', value)}
              placeholder="0"
              helper="Used for monthly amortization and SOA interest view."
            />

            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => updateField('status', value)}
              disabled={allowedStatusOptions.length === 1}
              helper={statusHelper}
            >
              {allowedStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </SelectField>
          </section>

          <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-950">Listing Document Requirements</h3>
                <p className="mt-1 text-xs font-semibold text-slate-600">These are the saved requirements used automatically by Review Buyer Form &amp; Reserve. Edit them here, then click Save Changes.</p>
              </div>

              <button
                type="button"
                onClick={() => setShowEditDocumentsModal(true)}
                disabled={isSaving}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiFileText className="h-4 w-4" />
                Edit Documents
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-black text-blue-700">{documentRequirements.filter((document) => document.status === 'active').length} docs</span>
              <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-700">{requiredDocumentCount} required</span>
            </div>
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Live Price Breakdown</h3>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {[['Installment', priceBreakdown.installment], ['Cash', priceBreakdown.cash]].map(([label, pricing]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-blue-700">{label} Pricing</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <BreakdownCard label="Base Selling Price" value={formatMoney(pricing.baseSellingPrice)} />
                    <BreakdownCard label="LMF Amount" value={formatMoney(pricing.lmfAmount)} />
                    <BreakdownCard label="TCP" value={formatMoney(pricing.tcp)} highlight />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <BreakdownCard label="Reservation Fee" value={formatMoney(priceBreakdown.reservationFee)} />
              <BreakdownCard label="Annual Interest Rate" value={`${Number(priceBreakdown.annualInterestRate || 0)}%`} />
              <BreakdownCard label="Preview Unit Code" value={unitCode} highlight />
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiSave className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {showEditDocumentsModal ? (
          <EditListingDocumentsModal
            selectedDocuments={documentRequirements}
            setSelectedDocuments={handleDocumentsChange}
            libraryDocuments={libraryDocuments}
            projectDefaultDocuments={projectDefaultDocuments}
            title="Edit Listing Document Requirements"
            subtitle="Changes stay in this Edit Listing form until you click Save Changes. Reset to project defaults only when you intentionally want to replace the listing-specific checklist."
            saveLabel="Apply to Listing"
            isSaving={isSaving}
            onClose={() => setShowEditDocumentsModal(false)}
          />
        ) : null}


        {showOldUnitIdConfirm ? (
          <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4">
            <div role="dialog" aria-modal="true" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <h3 className="text-lg font-black text-slate-950">No Old Unit ID Recorded</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                You changed the Unit ID from <strong className="text-slate-950">{originalUnitCode}</strong> to <strong className="text-slate-950">{unitCode}</strong>, but the previous Unit ID is not in Old Unit IDs.
              </p>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-600">
                Keeping it helps preserve listing history and makes older records easier to identify. You can still continue without it if the old value was simply incorrect.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={continueWithoutPreviousUnitId}
                  disabled={isSaving}
                  className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  Continue Without Old Unit ID
                </button>
                <button
                  type="button"
                  onClick={addPreviousUnitIdAndContinue}
                  disabled={isSaving}
                  className="h-11 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  Add {originalUnitCode} &amp; Continue
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </form>
    </div>
  )
}

export default EditUnitStatusModal
