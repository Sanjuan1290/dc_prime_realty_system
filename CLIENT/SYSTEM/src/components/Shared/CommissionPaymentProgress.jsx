export default function CommissionPaymentProgress({paymentPercent = 0}) {
  const percent = Number.isFinite(Number(paymentPercent)) ? Math.min(Math.max(Number(paymentPercent), 0), 100) : 0
  return <section aria-label="Total Payment Made" className="mt-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
    <div className="flex items-center justify-between gap-3 text-sm font-bold text-blue-950"><span>Total Payment Made (%)</span><span>{percent.toFixed(2)}%</span></div>
    <div role="progressbar" aria-label="Buyer payment progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} aria-valuetext={`${percent.toFixed(2)}% paid`} className="mt-2 h-2 overflow-hidden rounded-full bg-blue-100"><div className="h-full rounded-full bg-blue-600" style={{width:`${percent}%`}}/></div>
    <p className="mt-2 text-xs text-blue-800">Buyer payment progress toward TCP, including earned downpayment discounts.</p>
  </section>
}
