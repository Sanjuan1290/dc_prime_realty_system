import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { FiAlertTriangle, FiArrowRight, FiCheckCircle, FiRefreshCw, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { getDoubleCheckNotice, useFetch, useFetchPost } from '../../../../utils/useFetch'

const money = (value) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  minimumFractionDigits: 2,
}).format(Number(value || 0))

const fieldClass = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-500'

const NumberField = ({ label, value, onChange, min = 0, max, step = '0.01', disabled = false }) => (
  <label className="block">
    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">{label}</span>
    <input
      type="number"
      min={min}
      max={max}
      step={step}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className={fieldClass}
    />
  </label>
)

const ComparisonRow = ({ label, before, after, currency = false }) => (
  <div className="grid grid-cols-[1fr_1fr_28px_1fr] items-center gap-2 border-b border-slate-100 py-2.5 text-sm last:border-0">
    <span className="font-bold text-slate-600">{label}</span>
    <span className="text-right font-black text-slate-700">{currency ? money(before) : before ?? '-'}</span>
    <FiArrowRight className="mx-auto text-blue-500" />
    <span className="text-right font-black text-blue-700">{currency ? money(after) : after ?? '-'}</span>
  </div>
)

const ReservationCorrectionModal = ({ open, projectSlug, listingId, onClose, onCorrected }) => {
  const [destinationListingId, setDestinationListingId] = useState('')
  const [terms, setTerms] = useState(null)
  const [preview, setPreview] = useState(null)
  const [previewFingerprint, setPreviewFingerprint] = useState('')
  const [reason, setReason] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [notice, setNotice] = useState(null)

  const optionsQuery = useQuery({
    queryKey: ['reservation-correction-options', projectSlug, listingId],
    queryFn: () => useFetch(`/projects/lot-projects/${projectSlug}/listings/${listingId}/reservation-correction`),
    enabled: Boolean(open && projectSlug && listingId),
    retry: false,
  })

  const data = optionsQuery.data?.data || {}
  const normalizedTerms = terms || data.terms || {}
  const fingerprint = useMemo(
    () => JSON.stringify({ destinationListingId: Number(destinationListingId || 0), terms: normalizedTerms }),
    [destinationListingId, normalizedTerms]
  )
  const previewIsCurrent = Boolean(preview && previewFingerprint === fingerprint)

  const updateTerm = (key, value) => {
    setTerms((current) => ({ ...(current || data.terms || {}), [key]: value }))
    setPreview(null)
  }

  const previewMutation = useMutation({
    mutationFn: () => useFetchPost(
      `/projects/lot-projects/${projectSlug}/listings/${listingId}/reservation-correction/preview`,
      { destinationListingId: Number(destinationListingId), terms: normalizedTerms },
      { confirmationHandled: 'technical' }
    ),
    onMutate: () => setNotice({ type: 'loading', message: 'Recalculating the reservation using the correct unit...' }),
    onSuccess: (result) => {
      setPreview(result?.data || null)
      setPreviewFingerprint(fingerprint)
      setNotice({ type: 'success', message: 'Correct-unit computation is ready for review.' })
    },
    onError: (error) => setNotice(getDoubleCheckNotice(error, 'Unable to preview this reservation correction.')),
  })

  const correctionMutation = useMutation({
    mutationFn: () => useFetchPost(
      `/projects/lot-projects/${projectSlug}/listings/${listingId}/reservation-correction`,
      {
        destinationListingId: Number(destinationListingId),
        terms: normalizedTerms,
        reason: reason.trim(),
      },
      {
        doubleCheck: {
          type: 'reservation-correction',
          summary: `${preview?.before?.unitId || listingId} → ${preview?.after?.unitId || destinationListingId}`,
          data: {
            buyer: preview?.before?.buyerName,
            accountReference: preview?.before?.accountReference,
            sourceUnit: preview?.before?.unitId,
            destinationUnit: preview?.after?.unitId,
            oldTcp: preview?.before?.tcp,
            newTcp: preview?.after?.tcp,
            oldMonthly: preview?.before?.estimatedMonthlyAmortization,
            newMonthly: preview?.after?.estimatedMonthlyAmortization,
            reason: reason.trim(),
            noCancellation: true,
          },
        },
      }
    ),
    onMutate: () => setNotice({ type: 'loading', message: 'Correcting the reservation in one database transaction...' }),
    onSuccess: (result) => {
      setNotice({ type: 'success', message: result?.message || 'Reservation corrected successfully.' })
      onCorrected?.(result)
    },
    onError: (error) => setNotice(getDoubleCheckNotice(error, 'Reservation correction failed. No changes were saved.')),
  })

  if (!open) return null

  const termsValue = normalizedTerms
  const source = data.source || {}
  const blockers = data.blockers || []
  const destinations = data.destinations || []
  const selectedDestination = destinations.find((row) => Number(row.id) === Number(destinationListingId))
  const busy = optionsQuery.isLoading || previewMutation.isPending || correctionMutation.isPending

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/60 p-3 sm:p-5">
      <div className="max-h-[96vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-600">Administrative Correction</p>
            <h2 className="mt-1 text-xl font-black text-slate-950">Correct Reservation Unit</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Fix an incorrectly selected unit without creating cancellation or Buyer Account History.</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {notice ? <StatusAlert type={notice.type} message={notice.message} onClose={() => setNotice(null)} /> : null}
          {optionsQuery.isError ? <StatusAlert type="error" message={optionsQuery.error?.message || 'Unable to load correction options.'} /> : null}

          {blockers.length ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-start gap-3">
                <FiAlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                <div>
                  <h3 className="font-black text-red-900">Simple correction is blocked</h3>
                  <p className="mt-1 text-sm font-semibold text-red-700">Financial activity or unit-specific files must not be silently rewritten.</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm font-semibold text-red-700">
                    {blockers.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}

          {!optionsQuery.isLoading && !blockers.length ? (
            <>
              <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="grid gap-3 sm:grid-cols-4">
                  <div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Buyer</p><p className="mt-1 font-black text-slate-950">{source.buyerName || '-'}</p></div>
                  <div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Account</p><p className="mt-1 font-black text-slate-950">{source.accountReference || '-'}</p></div>
                  <div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Wrong Unit</p><p className="mt-1 font-black text-red-700">{source.unitId || '-'}</p></div>
                  <div><p className="text-[10px] font-black uppercase tracking-wide text-slate-500">Current TCP</p><p className="mt-1 font-black text-slate-950">{money(source.tcp)}</p></div>
                </div>
              </section>

              <section className="rounded-2xl border border-blue-200 bg-blue-50/40 p-4 sm:p-5">
                <h3 className="font-black text-slate-950">1. Choose the correct unit</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Only currently Available units from this project are shown. The backend checks availability again when you confirm.</p>
                <select
                  value={destinationListingId}
                  onChange={(event) => { setDestinationListingId(event.target.value); setPreview(null) }}
                  className={`${fieldClass} mt-3 bg-white`}
                >
                  <option value="">Select correct available unit...</option>
                  {destinations.map((row) => (
                    <option key={row.id} value={row.id}>{row.unitId} · {row.areaSqm} sqm</option>
                  ))}
                </select>
                {selectedDestination ? (
                  <p className="mt-2 text-xs font-bold text-blue-700">{selectedDestination.unitId}: {selectedDestination.areaSqm} sqm · Installment {money(selectedDestination.installmentPricePerSqm)}/sqm · Cash {money(selectedDestination.cashPricePerSqm)}/sqm</p>
                ) : null}
              </section>

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-black text-slate-950">2. Review carried payment terms</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">The buyer profile and selected terms are carried forward. Unit-dependent amounts are recalculated from the correct unit.</p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">Mode of Payment</span>
                    <select value={termsValue.modeOfPayment || 'installment'} onChange={(event) => updateTerm('modeOfPayment', event.target.value)} className={fieldClass}>
                      <option value="installment">Installment</option>
                      <option value="cash">Cash</option>
                    </select>
                  </label>
                  <NumberField label="Sale Discount (%)" max={100} value={termsValue.saleDiscountPercentage ?? 0} onChange={(value) => updateTerm('saleDiscountPercentage', value)} />
                  <NumberField label="DP Discount (%)" max={100} value={termsValue.dpDiscountPercentage ?? 0} onChange={(value) => updateTerm('dpDiscountPercentage', value)} />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">DP Input</span>
                    <select value={termsValue.downpaymentInputMode || 'percentage'} onChange={(event) => updateTerm('downpaymentInputMode', event.target.value)} className={fieldClass}>
                      <option value="percentage">Percentage</option>
                      <option value="amount">Amount</option>
                    </select>
                  </label>
                  {termsValue.downpaymentInputMode === 'amount' ? (
                    <NumberField label="Downpayment Amount" value={termsValue.downpaymentAmount ?? 0} onChange={(value) => updateTerm('downpaymentAmount', value)} />
                  ) : (
                    <NumberField label="Downpayment (%)" max={100} value={termsValue.downpaymentPercentage ?? 30} onChange={(value) => updateTerm('downpaymentPercentage', value)} />
                  )}
                  <NumberField label="DP Terms" step="1" value={termsValue.downpaymentTerms ?? 3} onChange={(value) => updateTerm('downpaymentTerms', value)} />
                  <NumberField label="Monthly Terms" min={1} step="1" value={termsValue.monthlyTerms ?? 36} onChange={(value) => updateTerm('monthlyTerms', value)} />
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wide text-slate-600">LMF Treatment</span>
                    <select value={termsValue.legalMiscFeeMode || 'include_in_monthly'} onChange={(event) => updateTerm('legalMiscFeeMode', event.target.value)} className={fieldClass}>
                      <option value="include_in_monthly">Include in Monthly</option>
                      <option value="separate_soa_row">Separate SOA Row</option>
                    </select>
                  </label>
                  <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3">
                    <input type="checkbox" checked={Boolean(termsValue.interestRateOverridden)} onChange={(event) => updateTerm('interestRateOverridden', event.target.checked)} className="h-4 w-4" />
                    <span className="text-sm font-black text-slate-700">Keep custom interest rate</span>
                  </label>
                  {termsValue.interestRateOverridden ? (
                    <NumberField label="Annual Interest (%)" max={100} value={termsValue.annualInterestRate ?? 0} onChange={(value) => updateTerm('annualInterestRate', value)} />
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => previewMutation.mutate()}
                  disabled={!destinationListingId || previewMutation.isPending}
                  className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                >
                  <FiRefreshCw className={`h-4 w-4 ${previewMutation.isPending ? 'animate-spin' : ''}`} />
                  Recalculate & Preview
                </button>
              </section>

              {previewIsCurrent ? (
                <section className="rounded-2xl border border-emerald-200 bg-emerald-50/30 p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                    <div className="w-full">
                      <h3 className="font-black text-slate-950">3. Verify the corrected computation</h3>
                      <p className="mt-1 text-sm font-semibold text-slate-500">SOA schedules, pricing snapshots, and commission will be rebuilt from these destination values.</p>
                      <div className="mt-4 rounded-xl border border-slate-200 bg-white px-4">
                        <ComparisonRow label="Unit" before={preview.before?.unitId} after={preview.after?.unitId} />
                        <ComparisonRow label="Price / SQM" before={preview.before?.pricePerSqm} after={preview.after?.pricePerSqm} currency />
                        <ComparisonRow label="Base Selling Price" before={preview.before?.baseSellingPrice} after={preview.after?.baseSellingPrice} currency />
                        <ComparisonRow label="LMF" before={preview.before?.lmfAmount} after={preview.after?.lmfAmount} currency />
                        <ComparisonRow label="TCP" before={preview.before?.tcp} after={preview.after?.tcp} currency />
                        <ComparisonRow label="DP Discount" before={preview.before?.dpDiscountAmount} after={preview.after?.dpDiscountAmount} currency />
                        <ComparisonRow label="Est. Monthly" before={preview.before?.estimatedMonthlyAmortization} after={preview.after?.estimatedMonthlyAmortization} currency />
                      </div>
                    </div>
                  </div>
                </section>
              ) : null}

              <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
                <h3 className="font-black text-slate-950">4. Administrative reason</h3>
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="Example: Admin selected LA-0102 instead of LA-0101 during reservation."
                  className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                />
                <label className="mt-3 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <input type="checkbox" checked={acknowledged} onChange={(event) => setAcknowledged(event.target.checked)} className="mt-0.5 h-4 w-4" />
                  <span className="text-sm font-bold text-amber-900">I confirm this is an administrative data-entry error. The buyer did not legitimately reserve the wrong unit and later change their decision.</span>
                </label>
              </section>
            </>
          ) : null}
        </div>

        <div className="sticky bottom-0 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          <button type="button" onClick={onClose} disabled={busy} className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:opacity-50">Cancel</button>
          <button
            type="button"
            onClick={() => correctionMutation.mutate()}
            disabled={!previewIsCurrent || reason.trim().length < 5 || !acknowledged || correctionMutation.isPending || blockers.length > 0}
            className="h-11 rounded-xl bg-red-600 px-5 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
          >
            {correctionMutation.isPending ? 'Correcting Reservation...' : 'Review & Correct Reservation'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ReservationCorrectionModal
