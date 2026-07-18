import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiLoader, FiUsers, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'

const NewGroupModal = ({ setShowNewGroupModal, onSaved }) => {
  const queryClient = useQueryClient()
  const [notice, setNotice] = useState(null)
  const [form, setForm] = useState({
    seller_group_name: '',
    seller_group_head_user_id: '',
    seller_group_description: '',
    seller_group_status: 'active',
  })

  const parentsQuery = useQuery({
    queryKey: ['parent-sellers'],
    queryFn: () => useFetch('/accredited/parents'),
  })
  const parentSellers = parentsQuery.data?.data || []

  const mutation = useMutation({
    mutationFn: () => useFetchPost('/seller-groups/create', form),
    onMutate: () => setNotice({ type: 'loading', message: 'Creating seller group...' }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['seller-groups'] })
      queryClient.invalidateQueries({ queryKey: ['seller-group-options'] })
      setShowNewGroupModal(false)
      onSaved?.(data?.message || 'Seller group created successfully.')
    },
    onError: (error) => setNotice({ type: 'error', message: error?.message || 'Failed to create seller group.' }),
  })

  const updateForm = (field, value) => {
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
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div className="flex items-start gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><FiUsers /></span><div><h2 className="text-xl font-black text-slate-950">New Seller Group</h2><p className="mt-1 text-sm font-semibold text-slate-500">Create the group first, then manage project pools and rates from its page.</p></div></div>
          <button type="button" onClick={() => setShowNewGroupModal(false)} disabled={mutation.isPending} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 disabled:opacity-50" aria-label="Close"><FiX /></button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="grid gap-5">
            {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={notice.type === 'loading' ? undefined : () => setNotice(null)} /> : null}
            {parentsQuery.isLoading ? <StatusAlert type="loading" message="Loading available group heads..." /> : null}
            {parentsQuery.isError ? <StatusAlert type="error" message={parentsQuery.error?.message || 'Failed to load group heads.'} /> : null}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4"><p className="font-black text-blue-950">Project pools start at 8.00%</p><p className="mt-1 text-sm font-semibold text-blue-800">Open the group after creation to choose each project and update its pool, direct rates, and overrides.</p></div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Group Name <span className="text-red-500">*</span></span><input autoFocus value={form.seller_group_name} onChange={(event) => updateForm('seller_group_name', event.target.value)} placeholder="Example: Prime External Realty" disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>
              <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Group Head</span><select value={form.seller_group_head_user_id} onChange={(event) => updateForm('seller_group_head_user_id', event.target.value)} disabled={mutation.isPending || parentsQuery.isLoading} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="">No head assigned</option>{parentSellers.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name} · {String(seller.role || '').replaceAll('_', ' ')}</option>)}</select></label>
            </div>

            <label className="flex flex-col gap-1.5"><span className="text-xs font-black text-slate-700">Description</span><textarea rows={4} value={form.seller_group_description} onChange={(event) => updateForm('seller_group_description', event.target.value)} placeholder="Describe the group, territory, or internal team..." disabled={mutation.isPending} className="resize-none rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100" /></label>

            <label className="flex flex-col gap-1.5 md:max-w-xs"><span className="text-xs font-black text-slate-700">Status</span><select value={form.seller_group_status} onChange={(event) => updateForm('seller_group_status', event.target.value)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
          </div>
        </div>

        <footer className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowNewGroupModal(false)} disabled={mutation.isPending} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 hover:bg-slate-100 disabled:opacity-50">Cancel</button><button type="submit" disabled={mutation.isPending || parentsQuery.isLoading} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white hover:bg-blue-700 disabled:bg-blue-300">{mutation.isPending ? <FiLoader className="animate-spin" /> : null}{mutation.isPending ? 'Creating...' : 'Create Group'}</button></footer>
      </form>
    </div>
  )
}

export default NewGroupModal
