const ListingPriceBreakdown = ({pricing,money}) => (
  <div className="mt-4 grid gap-4 lg:grid-cols-2">
    {[['Installment',pricing.installment],['Cash',pricing.cash]].map(([label,values])=>(
      <section key={label} aria-label={`${label} pricing`} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
        <h4 className="text-sm font-bold text-blue-800">{label} Pricing</h4>
        <dl className="mt-3 space-y-3">
          {[['Base Selling Price',values.baseSellingPrice],['Legal / Misc Fee',values.lmfAmount],['Total Contract Price (TCP)',values.tcp]].map(([name,value],index)=>(
            <div key={name} className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 ${index===2?'border-t border-blue-100 pt-3':''}`}>
              <dt className="text-xs font-semibold text-slate-600">{name}</dt>
              <dd className={`min-w-0 break-words text-sm font-bold tabular-nums ${index===2?'text-blue-800':'text-slate-950'}`}>{money(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    ))}
  </div>
)

export default ListingPriceBreakdown
