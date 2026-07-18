import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiLoader, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPut } from '../../../utils/useFetch'

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved }) => {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    seller_group_name: '',
    seller_group_head_user_id: '',
    seller_group_description: '',
    seller_group_status: 'active',
  })

  useEffect(() => {
    setForm({
      seller_group_name: selectedGroup?.seller_group_name || '',
      seller_group_head_user_id: selectedGroup?.seller_group_head_user_id ? String(selectedGroup.seller_group_head_user_id) : '',
      seller_group_description: selectedGroup?.seller_group_description || '',
      seller_group_status: selectedGroup?.seller_group_status || 'active',
    })
    setNotice(null)
  }, [selectedGroup?.seller_group_id])

  const parentsQuery = useQuery({
    queryKey: ['parent-sellers'],
    queryFn: () => useFetch('/accredited/parents'),
  })
  const parentSellers = parentsQuery.data?.data || []

  const mutation = useMutation({
    // Project rates are intentionally omitted. They are managed per project on
    // the routed Seller Group page and must not be overwritten by this modal.
    mutationFn: () => useFetchPut(`/seller-groups/edit/${selectedGroup.seller_group_id}`, form),
    onMutate: () => setNotice({ type: 'loading', message: 'Saving seller group...' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-project-configuration', Number(selectedGroup.seller_group_id)] })
      setShowEditGroupModal(false)
      onSaved?.(data?.message || 'Seller group updated successfully.')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to save seller group.' }),
  })

  const update = (field, value) => {
    setNotice(null)
    setForm((current) => ({ ...current, [field]: value }))
  }

  const submit = (event) => {
    event.preventDefault()
    if (!form.seller_group_name.trim()) {
      setNotice({ type: 'error', message: 'Seller group name is required.' })
      return
    }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-5">
      <form onSubmit={submit} aria-busy={mutation.isPending} className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4"><div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiUsers /></span><div><h2 className="text-xl font-black text-slate-950">Edit Seller Group</h2><p className="mt-1 text-sm font-semibold text-slate-500">Update group information. Project rates remain unchanged.</p></div></div><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close"><FiX /></button></header>
        <div className="overflow-y-auto p-5"><div className="grid gap-5">{notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}{parentsQuery.isLoading ? <StatusAlert type="loading" message="Loading available group heads..." /> : null}{parentsQuery.isError ? <StatusAlert type="error" message={parentsQuery.error?.message || 'Failed to load group heads.'} /> : null}<div className="grid gap-4 md:grid-cols-2"><label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Group Name <span className="text-red-500">*</span></span><input autoFocus value={form.seller_group_name} onChange={(event) => update('seller_group_name', event.target.value)} placeholder="Enter seller group name" disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label><label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Group Head</span><select value={form.seller_group_head_user_id} onChange={(event) => update('seller_group_head_user_id', event.target.value)} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="">No head assigned</option>{parentSellers.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {String(seller.role || '').replaceAll('_', ' ')}</option>)}</select></label></div><label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Description</span><textarea rows={4} value={form.seller_group_description} onChange={(event) => update('seller_group_description', event.target.value)} placeholder="Describe the seller group..." disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label><label className="flex flex-col gap-1.5 md:max-w-xs"><span className="text-xs font-black text-slate-700">Status</span><select value={form.seller_group_status} onChange={(event) => update('seller_group_status', event.target.value)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="active">Active</option><option value="inactive">Inactive</option></select></label></div></div>
        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button><button type="submit" disabled={mutation.isPending || parentsQuery.isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">{mutation.isPending ? <FiLoader className="animate-spin" /> : null}{mutation.isPending ? 'Saving...' : 'Save Group'}</button></footer>
      </form>
    </div>
  )
}

export default EditGroupModal
