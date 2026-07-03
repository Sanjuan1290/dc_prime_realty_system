import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiSearch, FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../../utils/useFetch'
import { formatMoney } from '../../../../utils/formatMoney'

const paymentTypes = [
  ['reservation', 'Reservation'],
  ['downpayment', 'Downpayment'],
  ['monthly', 'Monthly'],
  ['advance_payment', 'Advance Payment'],
  ['balloon', 'Balloon'],
  ['full_payment', 'Full Payment'],
  ['other', 'Other'],
]

const today = () => new Date().toISOString().slice(0, 10)

const AddPaymentModal = ({ setShowAddPaymentModal, defaultListingId }) => {
  const queryClient = useQueryClient()
  const [alert, setAlert] = useState(null)
  const [search, setSearch] = useState('')
  const [selectedListing, setSelectedListing] = useState(null)
  const [form, setForm] = useState({
    listing_id: defaultListingId || '',
    soa_row_id: '',
    payment_type: 'monthly',
    amount: '',
    payment_date: today(),
    payment_method: 'cash',
    reference_id: '',
    remarks: '',
  })

  const { data: searchData, isFetching: isSearching } = useQuery({
    queryKey: ['bailen-payment-client-search', search, defaultListingId],
    queryFn: () => useFetch(`/bailen/payments/search-client-units?search=${encodeURIComponent(search)}${defaultListingId ? `&listing_id=${defaultListingId}` : ''}`),
    enabled: search.trim().length >= 1 || Boolean(defaultListingId),
  })

  const searchResults = searchData?.data || []

  useEffect(() => {
    if (defaultListingId && searchResults.length === 1 && !selectedListing) {
      setSelectedListing(searchResults[0])
      setForm((current) => ({ ...current, listing_id: searchResults[0].bailen_listing_id }))
    }
  }, [defaultListingId, searchResults, selectedListing])

  const { data: suggestionData, isFetching: isSuggesting } = useQuery({
    queryKey: ['bailen-payment-suggestion', form.listing_id, form.payment_type],
    queryFn: () => useFetch(`/bailen/payments/suggest-amount?listing_id=${form.listing_id}&payment_type=${form.payment_type}`),
    enabled: Boolean(form.listing_id && form.payment_type),
  })

  useEffect(() => {
    if (suggestionData?.suggested_amount && !form.amount) {
      setForm((current) => ({ ...current, amount: String(suggestionData.suggested_amount), soa_row_id: suggestionData.soa_row_id || '' }))
    }
  }, [suggestionData, form.amount])

  const selectedSoaRows = selectedListing?.soa_rows || []
  const selectedUnitText = selectedListing ? `${selectedListing.unit_code} • ${selectedListing.project_bailen_name} • ${selectedListing.status?.replaceAll('_', ' ')}` : 'Select one result before saving the payment.'

  const isReferenceDisabled = form.payment_method === 'cash'
  const helperText = useMemo(() => {
    if (isReferenceDisabled) return 'Cash payments will get a reference like CASH-YYYYMMDD-LA0402-0001 after saving.'
    return 'Enter the bank OR, transaction number, or payment reference.'
  }, [isReferenceDisabled])

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const addMutation = useMutation({
    mutationFn: () => useFetchPost('/bailen/payments', form),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving payment...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Payment saved and verified.' })
      queryClient.invalidateQueries({ queryKey: ['bailen-payments'] })
      queryClient.invalidateQueries({ queryKey: ['bailen-payment-logs'] })
      queryClient.invalidateQueries({ queryKey: ['bailen-listing-profile'] })
      queryClient.invalidateQueries({ queryKey: ['bailen-commissions'] })
      queryClient.invalidateQueries({ queryKey: ['bailen-dashboard'] })
      setTimeout(() => setShowAddPaymentModal(false), 650)
    },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to save payment.' }),
  })

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <h3 className="text-xl font-bold text-slate-950">Add Payment</h3>
          <button type="button" onClick={() => setShowAddPaymentModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">Search Client Unit</span>
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search client, unit, project, seller..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </div>
          </label>

          <div className="mt-2 space-y-2">
            {isSearching ? <StatusAlert type="loading" message="Searching client units..." /> : null}
            {searchResults.map((item) => (
              <button key={item.bailen_listing_id} type="button" onClick={() => { setSelectedListing(item); setForm((current) => ({ ...current, listing_id: item.bailen_listing_id, amount: '', soa_row_id: '' })) }} className={`block w-full rounded-xl border p-3 text-left transition ${Number(form.listing_id) === Number(item.bailen_listing_id) ? 'border-blue-300 bg-blue-50 ring-4 ring-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <p className="font-bold text-slate-950">{item.buyer_name || 'No client name'}</p>
                <p className="text-sm font-semibold text-slate-500">{item.unit_code} • {item.project_bailen_name} • {item.status?.replaceAll('_', ' ')}</p>
              </button>
            ))}
          </div>
          <p className={`mt-2 text-sm font-bold ${selectedListing ? 'text-emerald-700' : 'text-orange-600'}`}>{selectedUnitText}</p>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Payment Type</span>
              <select value={form.payment_type} onChange={(event) => updateForm('payment_type', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                {paymentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Amount</span>
              <input value={form.amount} onChange={(event) => updateForm('amount', event.target.value)} placeholder={isSuggesting ? 'Loading suggested amount...' : ''} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              <p className="text-xs font-semibold text-slate-500">{suggestionData?.suggested_amount ? `Suggested amount: ${formatMoney(suggestionData.suggested_amount)}` : 'Select a client unit and payment type to load a suggested amount.'}</p>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Payment Date</span>
              <input type="date" value={form.payment_date} onChange={(event) => updateForm('payment_date', event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              <p className="text-xs font-semibold text-slate-500">Future dates are blocked. To pay ahead of a monthly due, choose Advance Payment instead.</p>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Payment Method</span>
              <select value={form.payment_method} onChange={(event) => updateForm('payment_method', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="online">Online</option>
                <option value="check">Check</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Reference ID / OR No. / Transaction No.</span>
              <input value={form.reference_id} disabled={isReferenceDisabled} onChange={(event) => updateForm('reference_id', event.target.value)} placeholder={isReferenceDisabled ? 'Auto-generated after saving' : 'BDO-874612'} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              <p className="text-xs font-semibold text-slate-500">{helperText}</p>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">SOA Row</span>
              <select value={form.soa_row_id} onChange={(event) => updateForm('soa_row_id', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option value="">Auto-match unpaid row</option>
                {selectedSoaRows.map((row) => <option key={row.soa_row_id} value={row.soa_row_id}>{row.due_date} • {row.description} • {formatMoney(row.due_amount)}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-bold text-slate-700">Remarks</span>
              <textarea value={form.remarks} onChange={(event) => updateForm('remarks', event.target.value)} rows={3} placeholder="Optional payment note" className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
          </div>

          <p className="mt-5 text-sm font-semibold leading-6 text-slate-500">Verified payments affect collection percentage and commission release eligibility. Excess monthly payment covers the unpaid portion from saved overpayment credits.</p>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowAddPaymentModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Cancel</button>
          <button type="button" onClick={() => addMutation.mutate()} disabled={addMutation.isPending || !form.listing_id} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><FiSave className="h-4 w-4" />{addMutation.isPending ? 'Saving...' : 'Add Payment'}</button>
        </div>
      </div>
    </div>
  )
}

export default AddPaymentModal
