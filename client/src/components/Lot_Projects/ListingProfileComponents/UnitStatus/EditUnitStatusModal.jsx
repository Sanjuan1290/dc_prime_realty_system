import { useMemo, useState } from 'react'
import { FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const selectedProject = {
  id: 1,
  name: 'Bailen Project',
  locationCode: 'LA',
  cadastralLots: ['1306', '1314', '1315', '1316'],
}

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

const getUnitNumber = (unitId = '') => {
  const value = String(unitId || '')
  return value.includes('-') ? value.split('-').pop() : value
}

const formatMoney = (value) =>
  new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0))

const toStatusValue = (status = '') => {
  const normalized = String(status).toLowerCase()

  if (normalized.includes('pending')) return 'pending_for_cancellation'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('cancelled')) return 'cancelled'
  if (normalized.includes('sold')) return 'sold'
  if (normalized.includes('hold')) return 'hold'

  return 'available'
}

const Field = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  helper,
  required = false,
}) => (
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

const BreakdownCard = ({ label, value, highlight = false }) => (
  <div className={`rounded-xl border p-4 ${highlight ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-white'}`}>
    <p className={`text-xs font-black uppercase ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>
      {label}
    </p>
    <p className={`mt-2 text-lg font-black ${highlight ? 'text-blue-900' : 'text-slate-950'}`}>
      {value}
    </p>
  </div>
)

const EditUnitStatusModal = ({ listing, onClose, onSave }) => {
  const [form, setForm] = useState({
    cadastralLotNo: listing?.cadastral_lot_no === '-' ? '' : listing?.cadastral_lot_no || '',
    unitNumber: getUnitNumber(listing?.unit_id || listing?.unitCode || 'LA-0402'),
    oldUnitIds: listing?.old_unit_ids === '-' ? '' : listing?.old_unit_ids || '',
    sourceUnitIds: listing?.source_unit_ids === '-' ? '' : listing?.source_unit_ids || '',
    derivedUnitIds: listing?.derived_unit_ids === '-' ? '' : listing?.derived_unit_ids || '',
    lotType: (() => {
                const lotType = String(listing?.lot_type || 'Inner').toLowerCase()

                if (lotType === 'corner') return 'corner'
                if (lotType === 'end') return 'end'

                return 'inner'
            })(),
    reservationFee: String(listing?.reservationFee || 50000),
    pricePerSqm: String(listing?.pricePerSqm || parseMoney(listing?.price_per_sqm) || 0),
    lotAreaSqm: String(listing?.lotAreaSqm || parseMoney(listing?.lot_area_sqm) || 0),
    legalMiscRate: String(listing?.legalMiscRate || parsePercent(listing?.lmf_rate) || 10),
    annualInterestRate: String(listing?.annualInterestRate || parsePercent(listing?.interestRate) || 0),
    status: toStatusValue(listing?.listing_status || listing?.status),
  })

  const [alert, setAlert] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  const unitCode = useMemo(() => {
    const unitNumber = String(form.unitNumber || '').trim()
    return unitNumber ? `${selectedProject.locationCode}-${unitNumber}` : `${selectedProject.locationCode}-`
  }, [form.unitNumber])

  const priceBreakdown = useMemo(() => {
    const pricePerSqm = Number(form.pricePerSqm || 0)
    const lotAreaSqm = Number(form.lotAreaSqm || 0)
    const legalMiscRate = Number(form.legalMiscRate || 0)
    const reservationFee = Number(form.reservationFee || 0)
    const annualInterestRate = Number(form.annualInterestRate || 0)

    const netSellingPrice = pricePerSqm * lotAreaSqm
    const lmfAmount = netSellingPrice * (legalMiscRate / 100)
    const tcp = netSellingPrice + lmfAmount

    return {
      netSellingPrice,
      lmfAmount,
      tcp,
      reservationFee,
      annualInterestRate,
    }
  }, [form])

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))

    if (alert?.type === 'error') {
      setAlert(null)
    }
  }

  const handleSubmit = (event) => {
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

    const statusLabel = statusOptions.find((item) => item.value === form.status)?.label || 'Available'
    const lotTypeLabel = lotTypes.find((item) => item.value === form.lotType)?.label || 'Inner'
    const today = new Date().toISOString().slice(0, 10)

    const payload = {
      ...listing,

      unit_id: unitCode,
      unitCode,

      project_name: selectedProject.name,
      projectName: selectedProject.name,

      cadastral_lot_no: form.cadastralLotNo || '-',
      old_unit_ids: form.oldUnitIds || '-',
      source_unit_ids: form.sourceUnitIds || '-',
      derived_unit_ids: form.derivedUnitIds || '-',

      lot_type: lotTypeLabel,
      listing_status: statusLabel,
      status: statusLabel,

      lot_area_sqm: `${Number(form.lotAreaSqm || 0)} sqm`,
      lotAreaSqm: Number(form.lotAreaSqm || 0),

      price_per_sqm: formatMoney(form.pricePerSqm),
      pricePerSqm: Number(form.pricePerSqm || 0),

      net_selling_price: formatMoney(priceBreakdown.netSellingPrice),
      netSellingPrice: priceBreakdown.netSellingPrice,

      lmf_rate: `${Number(form.legalMiscRate || 0)}%`,
      legalMiscRate: Number(form.legalMiscRate || 0),

      lmf_amount: formatMoney(priceBreakdown.lmfAmount),
      lmfAmount: priceBreakdown.lmfAmount,

      tcp: formatMoney(priceBreakdown.tcp),
      tcpAmount: priceBreakdown.tcp,

      reservationFee: Number(form.reservationFee || 0),
      annualInterestRate: Number(form.annualInterestRate || 0),
      interestRate: `${Number(form.annualInterestRate || 0).toFixed(2)}%`,

      updated_at: today,
    }

    setIsSaving(true)
    setAlert({ type: 'loading', message: 'Saving unit details in mock mode...' })

    window.setTimeout(() => {
      setIsSaving(false)
      onSave?.(payload)
    }, 600)
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
              <p className="text-xs font-black uppercase tracking-wide text-blue-700">
                Current Project
              </p>
              <p className="mt-1 text-lg font-black text-slate-950">
                {selectedProject.name}
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Unit prefix is locked to {selectedProject.locationCode}-
              </p>
            </div>

            <SelectField
              label="Cadastral Lot No."
              value={form.cadastralLotNo}
              onChange={(value) => updateField('cadastralLotNo', value)}
              helper="Only cadastral lots from Bailen Project are shown."
            >
              <option value="">Select cadastral lot number</option>
              {selectedProject.cadastralLots.map((lot) => (
                <option key={lot} value={lot}>
                  {lot}
                </option>
              ))}
            </SelectField>

            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-black text-slate-700">
                Unit ID <span className="text-red-500">*</span>
              </span>

              <div className="flex h-11 overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-50">
                <span className="flex w-24 items-center justify-center border-r border-slate-300 bg-slate-100 text-sm font-black text-blue-700">
                  {selectedProject.locationCode}-
                </span>
                <input
                  value={form.unitNumber}
                  onChange={(event) => updateField('unitNumber', event.target.value)}
                  placeholder="1001"
                  className="min-w-0 flex-1 px-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>

              <p className="text-xs font-semibold text-slate-500">
                Project code is locked. Admin only types the unit number after the prefix.
              </p>
            </label>

            <Field
              label="Old Unit IDs"
              value={form.oldUnitIds}
              onChange={(value) => updateField('oldUnitIds', value)}
              placeholder="Example: LA-204, Lot 204 old survey ID"
            />

            <SelectField
              label="Lot Type"
              value={form.lotType}
              onChange={(value) => updateField('lotType', value)}
            >
              {lotTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </SelectField>

            <Field
              label="Reservation Fee"
              type="number"
              value={form.reservationFee}
              onChange={(value) => updateField('reservationFee', value)}
              placeholder="50000"
            />

            <Field
              label="Price / SQM"
              type="number"
              value={form.pricePerSqm}
              onChange={(value) => updateField('pricePerSqm', value)}
              placeholder="0"
              required
            />

            <Field
              label="Lot Area SQM"
              type="number"
              value={form.lotAreaSqm}
              onChange={(value) => updateField('lotAreaSqm', value)}
              placeholder="0"
              required
            />

            <Field
              label="Legal / Misc Rate (%)"
              type="number"
              value={form.legalMiscRate}
              onChange={(value) => updateField('legalMiscRate', value)}
              placeholder="10"
              helper="Enter percentage only. Example: 10 means 10%."
            />

            <Field
              label="Annual Interest Rate (%)"
              type="number"
              value={form.annualInterestRate}
              onChange={(value) => updateField('annualInterestRate', value)}
              placeholder="0"
              helper="Used for monthly amortization and SOA interest view."
            />

            <SelectField
              label="Status"
              value={form.status}
              onChange={(value) => updateField('status', value)}
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </SelectField>
          </section>

          <section className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-black text-slate-950">Live Price Breakdown</h3>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <BreakdownCard label="Net Selling Price" value={formatMoney(priceBreakdown.netSellingPrice)} />
              <BreakdownCard label="LMF Amount" value={formatMoney(priceBreakdown.lmfAmount)} />
              <BreakdownCard label="TCP" value={formatMoney(priceBreakdown.tcp)} highlight />
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
      </form>
    </div>
  )
}

export default EditUnitStatusModal