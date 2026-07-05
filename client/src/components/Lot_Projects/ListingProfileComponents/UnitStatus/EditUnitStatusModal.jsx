import { useMemo, useState } from 'react'
import { FiLoader, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const parseNumber = (value) => Number(String(value || '').replace(/[₱,%\s,]/g, '').replace('sqm', '')) || 0

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
  if (normalized.includes('fully')) return 'fully_paid'
  if (normalized.includes('pending')) return 'pending_for_cancellation'
  if (normalized.includes('available')) return 'available'
  if (normalized.includes('cancelled')) return 'cancelled'
  if (normalized.includes('sold')) return 'sold'
  if (normalized.includes('hold')) return 'hold'
  return status || 'available'
}

const Field = ({ label, value, onChange, placeholder, type = 'text', helper, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-black text-slate-700">{label} {required ? <span className="text-red-500">*</span> : null}</span>
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
    <span className="text-sm font-black text-slate-700">{label} {required ? <span className="text-red-500">*</span> : null}</span>
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
    <p className={`text-xs font-black uppercase ${highlight ? 'text-blue-700' : 'text-slate-500'}`}>{label}</p>
    <p className={`mt-2 text-lg font-black ${highlight ? 'text-blue-900' : 'text-slate-950'}`}>{value}</p>
  </div>
)

const EditUnitStatusModal = ({ listing = {}, onClose, onSave, isSaving = false }) => {
  const locationCode = String(listing.lot_project_location_code || listing.locationCode || listing.unit_id?.split('-')?.[0] || '').toUpperCase()
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({
    unitNumber: getUnitNumber(listing.unit_id || listing.unitCode),
    unitCode: listing.unit_id || listing.unitCode || '',
    oldUnitIds: listing.old_unit_ids === '-' ? '' : listing.old_unit_ids || '',
    lotType: listing.lot_type || 'Inner',
    status: toStatusValue(listing.rawStatus || listing.listing_status),
    lotAreaSqm: String(listing.lotAreaSqm || parseNumber(listing.lot_area_sqm)),
    pricePerSqm: String(listing.pricePerSqm || parseNumber(listing.price_per_sqm)),
    legalMiscRate: String(listing.legalMiscRate || parseNumber(listing.lmf_rate)),
    reservationFee: String(listing.reservationFee || 0),
    cancellationType: listing.lot_project_listing_cancellation_type || '',
  })

  const computed = useMemo(() => {
    const area = Number(form.lotAreaSqm || 0)
    const price = Number(form.pricePerSqm || 0)
    const lmfRate = Number(form.legalMiscRate || 0)
    const netSelling = area * price
    const lmfAmount = netSelling * (lmfRate / 100)
    return { netSelling, lmfAmount, tcp: netSelling + lmfAmount }
  }, [form.lotAreaSqm, form.pricePerSqm, form.legalMiscRate])

  const updateField = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value }
      if (key === 'unitNumber') next.unitCode = `${locationCode || 'UNIT'}-${value}`.toUpperCase()
      return next
    })
    if (alert?.type === 'error') setAlert(null)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!form.unitCode.trim()) return setAlert({ type: 'error', message: 'Unit ID is required.' })
    if (Number(form.lotAreaSqm) <= 0) return setAlert({ type: 'error', message: 'Lot area must be greater than 0.' })
    if (Number(form.pricePerSqm) <= 0) return setAlert({ type: 'error', message: 'Price per SQM must be greater than 0.' })

    await onSave?.({
      unitCode: form.unitCode,
      oldUnitIds: form.oldUnitIds,
      lotType: form.lotType,
      status: form.status,
      lotAreaSqm: Number(form.lotAreaSqm),
      pricePerSqm: Number(form.pricePerSqm),
      legalMiscRate: Number(form.legalMiscRate),
      reservationFee: Number(form.reservationFee),
      cancellationType: form.cancellationType || null,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-black text-slate-950">Edit Unit & Status</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">Update the listing, pricing, and status saved in the database.</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} className="mb-4" /> : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Unit Number" value={form.unitNumber} onChange={(value) => updateField('unitNumber', value)} placeholder="Example: 0402" required helper={`Auto-generates Unit ID using ${locationCode || 'project location code'}.`} />
            <Field label="Unit ID" value={form.unitCode} onChange={(value) => updateField('unitCode', value.toUpperCase())} placeholder="Example: LA-0402" required />
            <Field label="Old Unit IDs" value={form.oldUnitIds} onChange={(value) => updateField('oldUnitIds', value)} placeholder="Example: LA-0302, LA-0303" />
            <SelectField label="Lot Type" value={form.lotType} onChange={(value) => updateField('lotType', value)} required>
              <option value="Inner">Inner</option>
              <option value="Corner">Corner</option>
              <option value="End">End</option>
            </SelectField>
            <SelectField label="Listing Status" value={form.status} onChange={(value) => updateField('status', value)} required>
              <option value="available">Available</option>
              <option value="hold">Hold</option>
              <option value="sold">Sold / Active</option>
              <option value="fully_paid">Fully Paid</option>
              <option value="pending_for_cancellation">Pending for Cancellation</option>
              <option value="cancelled">Cancelled</option>
              <option value="superseded">Superseded</option>
            </SelectField>
            <SelectField label="Cancellation Type" value={form.cancellationType} onChange={(value) => updateField('cancellationType', value)} helper="Required only for cancelled units.">
              <option value="">None</option>
              <option value="refunded">Refunded</option>
              <option value="discontinued">Discontinued</option>
            </SelectField>
            <Field label="Lot Area SQM" type="number" value={form.lotAreaSqm} onChange={(value) => updateField('lotAreaSqm', value)} placeholder="Example: 120" required />
            <Field label="Price per SQM" type="number" value={form.pricePerSqm} onChange={(value) => updateField('pricePerSqm', value)} placeholder="Example: 3000" required />
            <Field label="LMF Rate %" type="number" value={form.legalMiscRate} onChange={(value) => updateField('legalMiscRate', value)} placeholder="Example: 10" />
            <Field label="Reservation Fee" type="number" value={form.reservationFee} onChange={(value) => updateField('reservationFee', value)} placeholder="Example: 50000" />
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <BreakdownCard label="Net Selling Price" value={formatMoney(computed.netSelling)} />
            <BreakdownCard label="LMF Amount" value={formatMoney(computed.lmfAmount)} />
            <BreakdownCard label="TCP" value={formatMoney(computed.tcp)} highlight />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">Cancel</button>
          <button type="submit" disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-blue-300">
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditUnitStatusModal
