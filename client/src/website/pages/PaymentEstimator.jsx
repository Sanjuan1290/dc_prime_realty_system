import { useMemo, useState } from 'react'
import { FiInfo } from 'react-icons/fi'
import { FaCalculator } from "react-icons/fa6";

import PageHero from '../components/PageHero'
import SectionHeading from '../components/SectionHeading'
import usePageMeta from '../hooks/usePageMeta'

const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', maximumFractionDigits: 2 })

const PaymentEstimator = () => {
  const [form, setForm] = useState({ area: '150', pricePerSqm: '2500', reservation: '10000', downpaymentRate: '20', months: '36', discountRate: '0' })
  const update = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }))
  const result = useMemo(() => {
    const area = Math.max(Number(form.area) || 0, 0)
    const pricePerSqm = Math.max(Number(form.pricePerSqm) || 0, 0)
    const reservation = Math.max(Number(form.reservation) || 0, 0)
    const discountRate = Math.min(Math.max(Number(form.discountRate) || 0, 0), 100)
    const downpaymentRate = Math.min(Math.max(Number(form.downpaymentRate) || 0, 0), 100)
    const months = Math.max(Number(form.months) || 1, 1)
    const base = area * pricePerSqm
    const discounted = base * (1 - discountRate / 100)
    const downpayment = discounted * (downpaymentRate / 100)
    const balance = Math.max(discounted - downpayment - reservation, 0)
    return { base, discounted, downpayment, balance, monthly: balance / months }
  }, [form])

  usePageMeta({ title: 'Sample Property Payment Estimator | D&C Prime Realty', description: 'Create a sample property payment estimate using your own lot area, price and payment terms.' })

  return <><PageHero eyebrow="Buyer Tool" title="Sample payment estimator" description="Use your own sample figures to understand a possible payment breakdown before requesting an official quotation." image="/website/images/company/office-team-collage.jpg" /><section className="px-5 py-14 lg:px-8 lg:py-18"><div className="mx-auto grid max-w-[1120px] gap-8 lg:grid-cols-[0.9fr_1.1fr]"><div><SectionHeading eyebrow="Estimate inputs" title="Enter sample property figures" description="This calculator does not use live project pricing and does not include interest, LMF or other possible charges." /><div className="mt-6 grid gap-4 sm:grid-cols-2"><label><span className="website-label">Lot area (m²)</span><input type="number" min="0" className="website-input" value={form.area} onChange={update('area')} /></label><label><span className="website-label">Sample price per m²</span><input type="number" min="0" className="website-input" value={form.pricePerSqm} onChange={update('pricePerSqm')} /></label><label><span className="website-label">Reservation fee</span><input type="number" min="0" className="website-input" value={form.reservation} onChange={update('reservation')} /></label><label><span className="website-label">Sample discount (%)</span><input type="number" min="0" max="100" className="website-input" value={form.discountRate} onChange={update('discountRate')} /></label><label><span className="website-label">Downpayment (%)</span><input type="number" min="0" max="100" className="website-input" value={form.downpaymentRate} onChange={update('downpaymentRate')} /></label><label><span className="website-label">Months</span><input type="number" min="1" className="website-input" value={form.months} onChange={update('months')} /></label></div></div><div className="rounded-[18px] border border-[#ded9ce] bg-white p-6 shadow-[0_12px_38px_rgba(44,36,20,0.06)]"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#f3ead3] text-[#806014]"><FaCalculator /></span><h2 className="text-[24px]">Sample breakdown</h2></div><div className="mt-6 grid gap-3">{[['Base property value', result.base], ['After sample discount', result.discounted], ['Sample downpayment', result.downpayment], ['Estimated financed balance', result.balance], ['Estimated monthly amount', result.monthly]].map(([label, value], index) => <div key={label} className={`flex items-center justify-between gap-4 rounded-xl px-4 py-3 ${index === 4 ? 'bg-[#17130a] text-white' : 'bg-[#f7f4ed]'}`}><span className="text-[12px]">{label}</span><strong className="text-[14px]">{money.format(value)}</strong></div>)}</div><div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-[12px] leading-5 text-amber-900"><FiInfo className="mt-0.5 shrink-0" />This is a sample calculation only. Request the latest official quotation and full fee breakdown from D&C Prime Realty.</div></div></div></section></>
}

export default PaymentEstimator


