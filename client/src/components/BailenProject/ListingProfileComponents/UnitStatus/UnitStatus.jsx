import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FiSave } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetchPut } from '../../../../utils/useFetch'
import { formatMoney } from '../../../../utils/formatMoney'

const UnitStatus = ({ listing }) => {
  const queryClient = useQueryClient()
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState({})

  useEffect(() => {
    setForm({
      unit_code: listing?.unit_code || '',
      lot_area_sqm: listing?.lot_area_sqm || 0,
      price_per_sqm: listing?.price_per_sqm || 0,
      net_selling_price: listing?.net_selling_price || 0,
      legal_misc_rate: listing?.legal_misc_rate || 10,
      lmf_amount: listing?.lmf_amount || 0,
      tcp: listing?.tcp || 0,
      reservation_fee: listing?.reservation_fee || 50000,
      annual_interest_rate: listing?.annual_interest_rate || 0,
      status: listing?.status || 'available',
      description: listing?.description || '',
    })
  }, [listing])

  const calculated = useMemo(() => {
    const net = Number(form.lot_area_sqm || 0) * Number(form.price_per_sqm || 0)
    const lmf = net * (Number(form.legal_misc_rate || 0) / 100)
    return { net, lmf, tcp: net + lmf }
  }, [form.lot_area_sqm, form.price_per_sqm, form.legal_misc_rate])

  const updateForm = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: () => useFetchPut(`/bailen/listing-profile/${listing.bailen_listing_id}/unit-status`, { ...form, net_selling_price: calculated.net, lmf_amount: calculated.lmf, tcp: calculated.tcp }),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving unit details...' }),
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Unit details saved.' })
      queryClient.invalidateQueries({ queryKey: ['bailen-listing-profile'] })
      queryClient.invalidateQueries({ queryKey: ['bailen-listings'] })
    },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to save unit details.' }),
  })

  const locked = listing?.has_client || listing?.status === 'sold'

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Unit & Status</h2>
          <p className="text-sm font-semibold text-slate-500">Edit unit number, property description, price details, and status.</p>
        </div>
        <button type="button" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"><FiSave className="h-4 w-4" />{saveMutation.isPending ? 'Saving...' : 'Save Changes'}</button>
      </div>

      {locked ? <StatusAlert type="warning" message="This listing already has a buyer or SOA. Price changes should be handled by Super Admin only." className="mt-4" /> : null}
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mt-4" /> : null}

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        {[['Unit Code', 'unit_code'], ['Lot Area (sqm)', 'lot_area_sqm'], ['Price per SQM', 'price_per_sqm'], ['Reservation Fee', 'reservation_fee'], ['Legal / Misc Rate (%)', 'legal_misc_rate'], ['Annual Interest Rate (%)', 'annual_interest_rate']].map(([label, key]) => (
          <label key={key} className="flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">{label}</span>
            <input value={form[key] ?? ''} onChange={(event) => updateForm(key, event.target.value)} disabled={locked && ['unit_code','lot_area_sqm','price_per_sqm','legal_misc_rate'].includes(key)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none transition disabled:bg-slate-50 disabled:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
          </label>
        ))}
        <label className="flex flex-col gap-2">
          <span className="text-sm font-bold text-slate-700">Status</span>
          <select value={form.status || 'available'} onChange={(event) => updateForm('status', event.target.value)} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
            <option value="available">Available</option>
            <option value="hold">Hold</option>
            <option value="sold">Sold</option>
            <option value="pending_for_cancellation">Pending Cancellation</option>
            <option value="cancelled">Cancelled</option>
            <option value="superseded">Superseded</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 md:col-span-2">
          <span className="text-sm font-bold text-slate-700">Description / Improvements</span>
          <textarea value={form.description || ''} onChange={(event) => updateForm('description', event.target.value)} rows={4} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
        </label>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          ['Net Selling Price', calculated.net],
          ['LMF Amount', calculated.lmf],
          ['TCP', calculated.tcp],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 text-lg font-black text-slate-950">{formatMoney(value)}</p></div>)}
      </div>
    </section>
  )
}

export default UnitStatus
