import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetchPut } from '../../../utils/useFetch'

const EditSystemUserModal = ({ user, onClose, onSaved }) => {
  const [form, setForm] = useState({
    first_name: user?.first_name || '', middle_name: user?.middle_name || '', last_name: user?.last_name || '',
    email: user?.email || '', contact_no: user?.contact_no || '', tin_no: user?.tin_no || '', prc_no: user?.prc_no || '', address: user?.address || '',
    role: user?.role || '', status: user?.status || 'active',
  })
  const [alert, setAlert] = useState(null)
  const mutation = useMutation({
    mutationFn: () => useFetchPut(`/user/editUser/${user.id}`, form, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: 'loading', message: 'Saving user details...' }),
    onSuccess: (result) => { onSaved?.(result.message || 'User updated successfully.'); onClose?.() },
    onError: (error) => setAlert({ type: 'error', message: error.message || 'Failed to update user.' }),
  })
  const input = (name, label, required = false, type = 'text') => <label className="grid gap-1.5 text-sm font-bold text-slate-700">{label}{required ? ' *' : ''}<input type={type} required={required} value={form[name]} onChange={(e) => setForm((v) => ({ ...v, [name]: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3" /></label>
  return <div className="fixed inset-0 z-[80] overflow-y-auto bg-slate-950/50 p-4"><div className="mx-auto my-10 max-w-3xl rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b p-5"><div><h2 className="text-xl font-black">Edit User Details</h2><p className="text-sm text-slate-500">{user.account_code || user.email} · Role is locked after creation.</p></div><button onClick={onClose} type="button" className="px-3 py-2 font-black">✕</button></div><form onSubmit={(e) => { e.preventDefault(); mutation.mutate() }} className="grid gap-5 p-5">{alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} /> : null}<div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm"><strong>Role:</strong> {user.role.replaceAll('_',' ')} <span className="ml-2 text-slate-500">To change position, use Change Position / Create New Account.</span></div><div className="grid gap-4 md:grid-cols-2">{input('first_name','First Name',true)}{input('last_name','Last Name',true)}{input('middle_name','Middle Name')}{input('email','Email',true,'email')}{input('contact_no','Contact No.')}{input('tin_no','TIN')}{input('prc_no','PRC No.')}{input('address','Address')}</div><div className="flex justify-end gap-3 border-t pt-4"><button type="button" onClick={onClose} className="h-11 rounded-xl border px-5 font-bold">Cancel</button><button type="submit" disabled={mutation.isPending} className="h-11 rounded-xl bg-blue-600 px-5 font-black text-white disabled:opacity-50">Save Details</button></div></form></div></div>
}
export default EditSystemUserModal
