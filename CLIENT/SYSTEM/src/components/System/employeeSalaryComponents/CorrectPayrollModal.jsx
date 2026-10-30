import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { FiEdit3, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'
import { useFetch, useFetchPost } from '../../../utils/useFetch'
import { money } from './payrollFormatters'

// A single correction form replaces the redundant Before/After table and checkbox.
// Server-side review_hash, snapshots, audit log and permissions still apply.
const CorrectPayrollModal = ({ payrollId, onClose, onCorrected }) => {
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const reviewQuery = useQuery({
    queryKey: ['employee-salary', 'correction-review', payrollId],
    queryFn: () => useFetch(`/employee-payroll/payrolls/${payrollId}/correction-review`),
    enabled: Boolean(payrollId),
  })
  const review = reviewQuery.data?.data || null
  const canSubmit = reason.trim().length >= 5 && Boolean(review?.has_changes && review?.review_hash)
  const mutation = useMutation({
    mutationFn: () => useFetchPost(`/employee-payroll/payrolls/${payrollId}/corrections`, {
      reason: reason.trim(),
      review_hash: review.review_hash,
    }, { confirmationHandled: 'compact' }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['employee-salary'] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-detail', payrollId] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-receipt', payrollId] })
      queryClient.invalidateQueries({ queryKey: ['employee-salary-history'] })
      onCorrected?.(result)
      onClose?.()
    },
    onError: (error) => {
      if (error?.code === 'PAYROLL_CORRECTION_REVIEW_STALE' || error?.statusCode === 409) {
        queryClient.invalidateQueries({ queryKey: ['employee-salary', 'correction-review', payrollId] })
      }
    },
  })

  return (
    <div className="fixed inset-0 z-[96] flex items-center justify-center bg-slate-950/70 p-3 sm:p-5">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div>
            <div className="flex items-center gap-2 text-violet-700"><FiEdit3 /><span className="text-xs font-black uppercase tracking-wider">Salary Correction</span></div>
            <h2 className="mt-1 text-lg font-black text-slate-950">Update Finalized Salary</h2>
            <p className="mt-1 text-sm text-slate-600">Recalculate using the current approved Attendance and payroll settings.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
        </header>

        <div className="space-y-4 p-5">
          {reviewQuery.isLoading ? <StatusAlert type="loading" message="Checking the latest salary values..." /> : null}
          {reviewQuery.isError ? <StatusAlert type="error" message={reviewQuery.error?.message || 'Unable to check the salary calculation.'} /> : null}
          {mutation.isError ? <StatusAlert type="error" message={mutation.error?.message || 'Unable to save the correction. Reload the current values and try again.'} /> : null}
          {review && !review.has_changes ? <StatusAlert type="info" message="No changes were found. The finalized salary is already up to date." /> : null}
          {review?.has_changes ? <>
            <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-700">Recalculated take-home pay</p>
              <p className="mt-1 text-2xl font-black text-violet-950">{money(review.after_snapshot?.net_fund_release)}</p>
              <p className="mt-2 text-xs font-semibold leading-5 text-violet-800">Your previous official payroll is retained in Correction History and the Audit Log. Released payroll cannot be edited here.</p>
            </div>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-600">Reason for correction *</span>
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} rows={3} maxLength={2000} placeholder="Example: Correct 10-hour compressed shift attendance" className="mt-2 w-full rounded-xl border border-slate-300 p-3 text-sm outline-none focus:border-violet-500" />
            </label>
          </> : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700">Cancel</button>
          <button type="button" disabled={!canSubmit || mutation.isPending || reviewQuery.isFetching} onClick={() => mutation.mutate()} className="h-10 rounded-xl bg-violet-700 px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{mutation.isPending ? 'Saving...' : 'Save Salary Correction'}</button>
        </footer>
      </div>
    </div>
  )
}

export default CorrectPayrollModal

