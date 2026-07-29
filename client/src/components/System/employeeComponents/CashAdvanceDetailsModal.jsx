import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiDollarSign, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPatch, useFetchPost } from '../../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(value || 0))

const CashAdvanceDetailsModal = ({ advanceId, canManage, onClose, onUpdated }) => {
  const queryClient = useQueryClient()
  const query = useQuery({ queryKey: ['employee-cash-advance', advanceId], queryFn: () => useFetch(`/employee-cash-advances/${advanceId}`), enabled: Boolean(advanceId) })
  const data = query.data?.data
  const statusMutation = useMutation({
    mutationFn: (action) => useFetchPatch(`/employee-cash-advances/${advanceId}/${action}`, {}),
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ['employee-cash-advances'] }); queryClient.invalidateQueries({ queryKey: ['employee-cash-advance', advanceId] }); onUpdated?.(result?.message || 'Cash advance updated.') },
  })
  const deductionMutation = useMutation({
    mutationFn: ({ amount, date }) => useFetchPost(`/employee-cash-advances/${advanceId}/deductions`, { amount, deduction_date: date, notes: 'Manual salary deduction' }),
    onSuccess: (result) => { queryClient.invalidateQueries({ queryKey: ['employee-cash-advances'] }); queryClient.invalidateQueries({ queryKey: ['employee-cash-advance', advanceId] }); onUpdated?.(result?.message || 'Deduction recorded.') },
  })
  const act = (action, label) => { if (window.confirm(`${label} ${data?.reference_number}?`)) statusMutation.mutate(action) }
  const manualDeduction = () => {
    const amount = window.prompt(`Deduction amount. Remaining balance: ${money(data?.remaining_balance)}`)
    if (!amount) return
    const date = window.prompt('Deduction date (YYYY-MM-DD)', new Date().toISOString().slice(0, 10))
    if (!date) return
    deductionMutation.mutate({ amount: Number(amount), date })
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"><div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
    <header className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-700"><FiDollarSign /></span><div><h2 className="text-xl font-black">Cash Advance Details</h2><p className="text-sm font-semibold text-slate-500">Approval, outstanding balance, and deduction history.</p></div></div><button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-slate-100"><FiX /></button></header>
    <div className="flex-1 overflow-y-auto p-5">
      {query.isLoading ? <StatusAlert type="loading" message="Loading cash advance details..." /> : null}
      {query.isError ? <StatusAlert type="error" message={query.error?.message || 'Failed to load cash advance.'} /> : null}
      {statusMutation.isError ? <StatusAlert type="error" message={statusMutation.error?.message || 'Failed to change status.'} className="mb-4" /> : null}
      {deductionMutation.isError ? <StatusAlert type="error" message={deductionMutation.error?.message || 'Failed to record deduction.'} className="mb-4" /> : null}
      {data ? <>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[
          ['Reference', data.reference_number], ['Employee', data.full_name], ['Amount', money(data.amount)], ['Remaining', money(data.remaining_balance)],
          ['Status', String(data.cash_advance_status).toUpperCase()], ['Request Date', data.request_date], ['Approved At', data.approved_at || 'Not yet approved'], ['Total Deducted', money(Number(data.amount || 0) - Number(data.remaining_balance || 0))],
        ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">{label}</p><p className="mt-2 break-words text-sm font-black text-slate-950">{value}</p></div>)}</section>
        {data.notes ? <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-black uppercase text-slate-500">Notes</p><p className="mt-2 text-sm font-semibold text-slate-700">{data.notes}</p></div> : null}
        <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-semibold text-blue-800">After approval, the system deducts as much of the outstanding balance as the next salary release can cover. Any unpaid balance carries forward automatically.</div>
        <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200"><div className="border-b border-slate-200 bg-slate-50 px-4 py-3"><h3 className="font-black">Deduction History</h3></div><div className="overflow-x-auto"><table className="min-w-[650px] w-full text-sm"><thead><tr>{['Date', 'Payroll Period', 'Amount', 'Remaining', 'Notes'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase text-slate-500">{head}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{!data.deductions?.length ? <tr><td colSpan={5} className="px-4 py-10 text-center font-semibold text-slate-500">No deductions recorded.</td></tr> : data.deductions.map((item) => <tr key={item.employee_cash_advance_deduction_id}><td className="px-4 py-3">{item.deduction_date}</td><td className="px-4 py-3">{item.period_label || 'Manual'}</td><td className="px-4 py-3 font-black">{money(item.amount)}</td><td className="px-4 py-3">{money(item.remaining_balance_after)}</td><td className="px-4 py-3 text-slate-600">{item.notes || '-'}</td></tr>)}</tbody></table></div></section>
      </> : null}
    </div>
    <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 p-4">{canManage && data?.cash_advance_status === 'pending' ? <><button type="button" onClick={() => act('reject', 'Reject')} disabled={statusMutation.isPending} className="h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700">Reject</button><button type="button" onClick={() => act('approve', 'Approve')} disabled={statusMutation.isPending} className="h-10 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white">Approve</button></> : null}{canManage && ['approved', 'active'].includes(data?.cash_advance_status) ? <><button type="button" onClick={manualDeduction} disabled={deductionMutation.isPending} className="h-10 rounded-xl border border-blue-200 bg-blue-50 px-4 text-sm font-black text-blue-700">Record Deduction</button><button type="button" onClick={() => act('cancel', 'Cancel')} disabled={statusMutation.isPending} className="h-10 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700">Cancel</button></> : null}<button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-300 px-4 text-sm font-black">Close</button></footer>
  </div></div>
}

export default CashAdvanceDetailsModal
