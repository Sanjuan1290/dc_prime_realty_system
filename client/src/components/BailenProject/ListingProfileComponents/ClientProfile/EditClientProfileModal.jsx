import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiSave, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch, useFetchPut } from '../../../../utils/useFetch'

const emptyForm = {
  buyer_type: 'single', buyer_name: '', contact_no: '', email: '', address: '', occupation: '', employer_business_name: '',
  seller_user_id: '', second_buyer_name: '', second_buyer_contact_no: '', second_buyer_email: '', second_buyer_occupation: '', second_buyer_employer_business_name: '', profile_status: 'complete'
}

const EditClientProfileModal = ({ listing, client, onClose }) => {
  const queryClient = useQueryClient()
  const [alert, setAlert] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const { data } = useQuery({ queryKey: ['bailen-seller-options'], queryFn: () => useFetch('/bailen/listing-profile/seller-options') })
  const sellers = data?.data || []

  useEffect(() => { if (client) setForm({ ...emptyForm, ...client, seller_user_id: client.seller_user_id || '' }) }, [client])
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))

  const saveMutation = useMutation({
    mutationFn: () => useFetchPut(`/bailen/listing-profile/${listing.bailen_listing_id}/client-profile`, form),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving client profile...' }),
    onSuccess: (result) => { setAlert({ type: 'success', message: result?.message || 'Client profile saved.' }); queryClient.invalidateQueries({ queryKey: ['bailen-listing-profile'] }); queryClient.invalidateQueries({ queryKey: ['bailen-listings'] }); queryClient.invalidateQueries({ queryKey: ['bailen-commissions'] }); setTimeout(onClose, 650) },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to save client profile.' }),
  })

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[94vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4"><h3 className="text-xl font-bold text-slate-950">Edit Client Profile</h3><button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"><FiX /></button></div>
        <div className="max-h-[72vh] overflow-y-auto p-6">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}
          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2"><span className="text-sm font-bold text-slate-700">Buyer Type</span><select value={form.buyer_type} onChange={(e)=>update('buyer_type', e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="single">Single</option><option value="spouses">Spouses</option><option value="and_account">And Account</option></select></label>
            <label className="flex flex-col gap-2"><span className="text-sm font-bold text-slate-700">Accredited Seller</span><select value={form.seller_user_id} onChange={(e)=>update('seller_user_id', e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="">No seller selected</option>{sellers.map((s)=><option key={s.user_id} value={s.user_id}>{s.full_name} • {s.role?.replaceAll('_',' ')}</option>)}</select></label>
            {[
              ['Buyer Name','buyer_name'],['Contact No.','contact_no'],['Email','email'],['Address','address'],['Occupation','occupation'],['Employer / Business','employer_business_name']
            ].map(([label,key]) => <label key={key} className="flex flex-col gap-2"><span className="text-sm font-bold text-slate-700">{label}</span><input value={form[key] || ''} onChange={(e)=>update(key, e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>)}
          </div>
          {form.buyer_type !== 'single' ? <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4"><h4 className="font-bold text-slate-950">Second Buyer Work / Business Information</h4><div className="mt-4 grid gap-4 md:grid-cols-2">{[['Second Buyer Name','second_buyer_name'],['Second Contact No.','second_buyer_contact_no'],['Second Email','second_buyer_email'],['Second Occupation','second_buyer_occupation'],['Second Employer / Business','second_buyer_employer_business_name']].map(([label,key])=><label key={key} className="flex flex-col gap-2"><span className="text-sm font-bold text-slate-700">{label}</span><input value={form[key] || ''} onChange={(e)=>update(key,e.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>)}</div></div> : null}
        </div>
        <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4"><button onClick={onClose} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button><button onClick={()=>saveMutation.mutate()} disabled={saveMutation.isPending} className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"><FiSave />{saveMutation.isPending ? 'Saving...' : 'Save Client'}</button></div>
      </div>
    </div>
  )
}

export default EditClientProfileModal
