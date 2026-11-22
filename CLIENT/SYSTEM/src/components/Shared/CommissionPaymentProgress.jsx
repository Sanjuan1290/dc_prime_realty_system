import {commissionPaymentProgress} from '../../../../shared/financialProgress.js'

export default function CommissionPaymentProgress({entitlement, released}) {
  const progress = commissionPaymentProgress({entitlement, released})
  return <section aria-label="Total Payment Made" className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
    <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-950"><span>Total Payment Made (%)</span><span>{progress.percent.toFixed(2)}%</span></div>
    <div role="progressbar" aria-label="Released commission payments" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.barPercent} aria-valuetext={`${progress.percent.toFixed(2)}% paid`} className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${progress.barPercent}%`}}/></div>
    <p className="mt-2 text-xs text-blue-800">Successfully released payments divided by total entitlement. Pending releases and unreleased retention are excluded.</p>
  </section>
}
