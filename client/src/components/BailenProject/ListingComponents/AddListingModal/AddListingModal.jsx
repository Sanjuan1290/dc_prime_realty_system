import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiFileText, FiPlus, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../../utils/useFetch'
import { formatMoney } from '../../../../utils/formatMoney'
import EditListingDocumentsModal from '../EditListingDocumentsModal/EditListingDocumentsModal'

const AddListingModal = ({ setShowAddListingModal }) => {
  const queryClient = useQueryClient()
  const [alert, setAlert] = useState(null)
  const [showDocumentsModal, setShowDocumentsModal] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [form, setForm] = useState({
    project_bailen_id: '',
    cadastral_lot_number_ids: [],
    unit_number: '',
    old_unit_ids: '',
    lot_type: 'inner',
    reservation_fee: '50000',
    price_per_sqm: '0',
    lot_area_sqm: '0',
    legal_misc_rate: '10',
    annual_interest_rate: '0',
    status: 'available',
  })

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bailen-create-listing-options'],
    queryFn: () => useFetch('/bailen/listings/create-options'),
  })

  const project = data?.project
  const documents = data?.documents || []
  const projectDefaults = data?.project_default_documents || []
  const cadastralLots = data?.cadastral_lot_numbers || []

  useEffect(() => {
    if (project?.project_bailen_id) {
      setForm((current) => ({ ...current, project_bailen_id: project.project_bailen_id }))
    }
  }, [project])

  const prefix = project?.project_bailen_location_code || 'LA'
  const unitCode = `${prefix}-${form.unit_number || ''}`

  const priceBreakdown = useMemo(() => {
    const area = Number(form.lot_area_sqm || 0)
    const price = Number(form.price_per_sqm || 0)
    const lmfRate = Number(form.legal_misc_rate || 0)
    const netSellingPrice = area * price
    const lmfAmount = netSellingPrice * (lmfRate / 100)
    return {
      net_selling_price: netSellingPrice,
      lmf_amount: lmfAmount,
      tcp: netSellingPrice + lmfAmount,
    }
  }, [form.lot_area_sqm, form.price_per_sqm, form.legal_misc_rate])

  const selectedDocCount = selectedDocuments.length || projectDefaults.length
  const requiredDocCount = selectedDocuments.length ? selectedDocuments.filter((item) => item.requirement === 'required').length : projectDefaults.filter((item) => item.requirement === 'required').length

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const addMutation = useMutation({
    mutationFn: () => useFetchPost('/bailen/listings', {
      ...form,
      unit_code: unitCode,
      net_selling_price: priceBreakdown.net_selling_price,
      lmf_amount: priceBreakdown.lmf_amount,
      tcp: priceBreakdown.tcp,
      document_requirements: selectedDocuments.map((item) => ({
        document_id: item.document_id,
        requirement: item.requirement,
        status: item.status,
      })),
    }),
    onMutate: () => setAlert({ type: 'loading', message: 'Adding listing...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Listing added.' })
      queryClient.invalidateQueries({ queryKey: ['bailen-listings'] })
      queryClient.invalidateQueries({ queryKey: ['bailen-dashboard'] })
      setTimeout(() => setShowAddListingModal(false), 650)
    },
    onError: (mutationError) => setAlert({ type: 'error', message: mutationError.message || 'Failed to add listing.' }),
  })

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-950">Add Listing</h3>
          <button type="button" onClick={() => setShowAddListingModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6">
          {isLoading ? <StatusAlert type="loading" message="Loading project options..." className="mb-4" /> : null}
          {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load project options.'} className="mb-4" /> : null}
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Project Name</span>
              <select value={form.project_bailen_id} onChange={(event) => updateForm('project_bailen_id', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                {project ? <option value={project.project_bailen_id}>{project.project_bailen_location_code} - {project.project_bailen_name}</option> : <option value="">Loading project...</option>}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Cadastral Lot No.</span>
              <select multiple value={form.cadastral_lot_number_ids} onChange={(event) => updateForm('cadastral_lot_number_ids', Array.from(event.target.selectedOptions).map((option) => option.value))} className="min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                {cadastralLots.length === 0 ? <option value="">Add cadastral lot numbers in Projects to show a dropdown</option> : cadastralLots.map((lot) => <option key={lot.bailen_cadastral_lot_number_id} value={lot.bailen_cadastral_lot_number_id}>{lot.bailen_cadastral_lot_number}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Unit ID <span className="text-red-600">*</span></span>
              <div className="flex overflow-hidden rounded-xl border border-slate-200 focus-within:border-blue-300 focus-within:ring-4 focus-within:ring-blue-50">
                <span className="flex h-11 w-24 items-center justify-center border-r border-slate-200 bg-slate-100 text-sm font-black text-slate-700">{prefix}-</span>
                <input value={form.unit_number} onChange={(event) => updateForm('unit_number', event.target.value.replace(/[^0-9A-Za-z-]/g, ''))} placeholder="1001" className="h-11 min-w-0 flex-1 px-3 text-sm font-semibold outline-none" />
              </div>
              <p className="text-xs font-semibold text-slate-500">Project code is locked. Admin can only type the unit number after the prefix.</p>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Old Unit IDs</span>
              <input value={form.old_unit_ids} onChange={(event) => updateForm('old_unit_ids', event.target.value)} placeholder="Example: LA-204, Lot 204 old survey ID" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Lot Type</span>
              <select value={form.lot_type} onChange={(event) => updateForm('lot_type', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="inner">Inner</option>
                <option value="corner">Corner</option>
                <option value="commercial">Commercial</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Reservation Fee</span>
              <input value={form.reservation_fee} onChange={(event) => updateForm('reservation_fee', event.target.value)} placeholder="50000" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Price / SQM</span>
              <input value={form.price_per_sqm} onChange={(event) => updateForm('price_per_sqm', event.target.value)} placeholder="0" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Lot Area SQM</span>
              <input value={form.lot_area_sqm} onChange={(event) => updateForm('lot_area_sqm', event.target.value)} placeholder="0" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Legal / Misc Rate (%)</span>
              <input value={form.legal_misc_rate} onChange={(event) => updateForm('legal_misc_rate', event.target.value)} placeholder="10" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              <p className="text-xs font-semibold text-slate-500">Enter percentage only. Example: 10 means 10%.</p>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Annual Interest Rate (%)</span>
              <input value={form.annual_interest_rate} onChange={(event) => updateForm('annual_interest_rate', event.target.value)} placeholder="0" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              <p className="text-xs font-semibold text-slate-500">Used for reserve monthly amortization and SOA interest view.</p>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Status</span>
              <select value={form.status} onChange={(event) => updateForm('status', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="available">Available</option>
                <option value="hold">Hold</option>
                <option value="superseded">Superseded</option>
              </select>
            </label>
          </div>

          <section className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-bold text-slate-950">Listing Document Requirements</h4>
                <p className="text-sm font-semibold text-slate-600">Click Edit Documents to set this listing's checklist before saving. Leave empty to use project defaults.</p>
                <p className="mt-1 text-xs font-bold text-blue-700">{selectedDocCount} docs • {requiredDocCount} required</p>
              </div>
              <button type="button" onClick={() => setShowDocumentsModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">
                <FiFileText className="h-4 w-4" />
                Edit Documents
              </button>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-bold text-slate-950">Live Price Breakdown</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {[
                ['NET SELLING PRICE', formatMoney(priceBreakdown.net_selling_price)],
                ['LMF AMOUNT', formatMoney(priceBreakdown.lmf_amount)],
                ['TCP', formatMoney(priceBreakdown.tcp)],
                ['RESERVATION FEE', formatMoney(form.reservation_fee)],
                ['ANNUAL INTEREST RATE', `${Number(form.annual_interest_rate || 0)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-2 text-lg font-black text-slate-950">{value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowAddListingModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
            {addMutation.isPending ? <FiSave className="h-4 w-4 animate-pulse" /> : <FiPlus className="h-4 w-4" />}
            {addMutation.isPending ? 'Adding...' : 'Add Listing'}
          </button>
        </div>
      </div>

      {showDocumentsModal ? <EditListingDocumentsModal documents={documents} projectDefaults={projectDefaults} selectedDocuments={selectedDocuments} setSelectedDocuments={setSelectedDocuments} onClose={() => setShowDocumentsModal(false)} /> : null}
    </div>
  )
}

export default AddListingModal
