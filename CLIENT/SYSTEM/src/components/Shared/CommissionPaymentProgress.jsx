import {commissionPaymentProgress} from '../../../../shared/financialProgress.js'

export default function CommissionPaymentProgress({entitlement, released, paymentPercent, label = 'Commission Released (%)'}) {
  const isBuyerPayment = paymentPercent !== undefined && paymentPercent !== null
  const buyerPercent = Number.isFinite(Number(paymentPercent)) ? Math.min(Math.max(Number(paymentPercent), 0), 100) : 0
  const progress = isBuyerPayment
    ? {percent: buyerPercent, barPercent: buyerPercent}
    : commissionPaymentProgress({entitlement, released})
  const title = isBuyerPayment ? 'Total Payment Made (%)' : label
  return <section aria-label={isBuyerPayment ? 'Total Payment Made' : label} className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
    <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-950"><span>{title}</span><span>{progress.percent.toFixed(2)}%</span></div>
    <div role="progressbar" aria-label={isBuyerPayment ? 'Buyer payment progress' : 'Released commission payments'} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.barPercent} aria-valuetext={`${progress.percent.toFixed(2)}% paid`} className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${progress.barPercent}%`}}/></div>
    <p className="mt-2 text-xs text-blue-800">{isBuyerPayment ? 'Buyer payment progress toward TCP, including earned downpayment discounts.' : 'Successfully released payments divided by total entitlement. Pending releases and unreleased retention are excluded.'}</p>
  </section>
}
