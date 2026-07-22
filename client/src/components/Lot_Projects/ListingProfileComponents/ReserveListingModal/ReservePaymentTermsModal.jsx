import { useMemo, useState } from 'react'
import { FiAlertCircle, FiCheckCircle, FiLoader, FiSearch, FiUser } from 'react-icons/fi'
import { getPaymentCalculations, money } from './reserveUtils'
import { SectionCard, SelectInput, TextInput } from './ReserveShared'

const downpaymentTermOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const dailyPenaltyRateOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5]
const penaltyGraceDayOptions = Array.from({ length: 32 }, (_, index) => String(index))

const PreviewCard = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    red: 'border-red-200 bg-red-50 text-red-900',
  }
  const labelTones = {
    slate: 'text-slate-500',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
    red: 'text-red-700',
  }
  return <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}><p className={`text-xs font-black uppercase ${labelTones[tone] || labelTones.slate}`}>{label}</p><p className="mt-1 text-sm font-black">{value}</p></div>
}

const AgentPicker = ({
  agents,
  selectedAgent,
  selectedAgentId,
  search,
  onSearch,
  onSelect,
  isLoading,
  error,
}) => {
  const [showResults, setShowResults] = useState(false)
  return (
    <div className="relative flex flex-col gap-1.5 md:col-span-2">
      <span className="text-xs font-black text-slate-700">Assigned Sales Agent <span className="text-red-500">*</span></span>
      <div className="relative">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onFocus={() => setShowResults(true)}
          onChange={(event) => {
            onSearch(event.target.value)
            setShowResults(true)
          }}
          placeholder="Search agent by name, group, owner, or reports under..."
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
      </div>
      <p className="text-xs font-semibold text-slate-500">Only active agents with a sales commission rate for this project are available.</p>

      {selectedAgent ? (
        <div className="mt-2 flex flex-col gap-2 rounded-xl border border-blue-200 bg-blue-50 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="font-black text-blue-950">{selectedAgent.name}</p><p className="text-xs font-semibold text-blue-700">{selectedAgent.isSystemDummy ? `System agent · Owner: ${selectedAgent.ownerName}` : selectedAgent.groupName} · Reports under: {selectedAgent.reportsUnderName}</p></div>
          <span className="w-fit rounded-lg bg-white px-2.5 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-200">Direct: {Number(selectedAgent.directRate || selectedAgent.rateValue || 0).toFixed(2)}%</span>
        </div>
      ) : null}

      {showResults ? (
        <div className="absolute left-0 right-0 top-[74px] z-30 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl">
          {isLoading ? <div className="flex items-center gap-2 px-3 py-4 text-sm font-semibold text-slate-500"><FiLoader className="animate-spin" />Loading available sales agents...</div> : null}
          {error ? <div className="px-3 py-4 text-sm font-semibold text-red-700">{error}</div> : null}
          {!isLoading && !error && agents.length === 0 ? <div className="px-3 py-5 text-center"><p className="font-black text-slate-700">No active sales agents found.</p><p className="mt-1 text-xs font-semibold text-slate-500">Configure the agent’s sales commission rate from the Seller Group page.</p></div> : null}
          {!isLoading && agents.map((agent) => (
            <button
              key={agent.id}
              type="button"
              onClick={() => {
                onSelect(String(agent.id))
                onSearch(agent.name)
                setShowResults(false)
              }}
              className={`flex w-full items-start justify-between gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-blue-50 ${String(agent.id) === String(selectedAgentId) ? 'bg-blue-50' : ''}`}
            >
              <div className="flex min-w-0 items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FiUser /></span><div className="min-w-0"><p className="truncate text-sm font-black text-slate-950">{agent.name}</p><p className="truncate text-xs font-semibold text-slate-500">{agent.groupName} · Reports under: {agent.reportsUnderName}</p>{agent.isSystemDummy ? <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-blue-600">System Agent · Owner: {agent.ownerName}</p> : null}</div></div>
              <span className="shrink-0 rounded-lg bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{Number(agent.directRate || agent.rateValue || 0).toFixed(2)}%</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

const HierarchyPreview = ({ preview, isLoading, error, hasSelectedAgent }) => {
  const hierarchy = preview?.hierarchy || []

  if (!hasSelectedAgent) return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center"><p className="font-black text-slate-700">Select a sales agent to calculate the hierarchy.</p><p className="mt-1 text-sm font-semibold text-slate-500">Every direct and override recipient will appear here.</p></div>
  if (isLoading) return <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 p-8 text-sm font-black text-slate-600"><FiLoader className="animate-spin" />Calculating commission hierarchy...</div>
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800"><div className="flex gap-2"><FiAlertCircle className="mt-0.5 shrink-0" /><p>{error}</p></div></div>

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <PreviewCard label="Commission Base (Before Discount)" value={money(preview?.commissionBase)} />
        <PreviewCard label="Group Pool" value={`${Number(preview?.poolRate || 0).toFixed(2)}%`} tone="blue" />
        <PreviewCard label="Total Allocated" value={`${Number(preview?.allocatedRate || 0).toFixed(2)}%`} tone={preview?.isValid ? 'emerald' : 'red'} />
        <PreviewCard label="Unallocated" value={`${Number(preview?.unallocatedRate || 0).toFixed(2)}%`} tone="amber" />
        <PreviewCard label="Estimated Total" value={money(preview?.estimatedTotal)} tone="emerald" />
      </div>

      {preview?.warnings?.length ? <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">{preview.warnings.map((warning) => <p key={warning} className="text-sm font-semibold text-amber-800">{warning}</p>)}</div> : null}

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[780px] w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50"><tr>{['Order', 'Seller', 'Role', 'Commission Type', 'Rate', 'Estimated Amount'].map((head) => <th key={head} className="px-4 py-3 text-left text-xs font-black uppercase tracking-wide text-slate-500">{head}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100">{hierarchy.map((row) => <tr key={`${row.order}-${row.accreditedSellerId}`}><td className="px-4 py-4 font-black text-slate-500">{row.order}</td><td className="px-4 py-4"><p className="font-black text-slate-950">{row.sellerName}</p>{row.isSystemDummy ? <p className="text-xs font-semibold text-blue-600">System agent · Beneficiary: {row.beneficiaryName}</p> : row.childSellerName ? <p className="text-xs font-semibold text-slate-500">Override from: {row.childSellerName}</p> : null}</td><td className="px-4 py-4 font-semibold capitalize text-slate-700">{String(row.role || '').replaceAll('_', ' ')}</td><td className="px-4 py-4"><span className={`rounded-full px-3 py-1 text-xs font-black ${row.commissionType === 'direct' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{row.commissionType === 'direct' ? 'Direct' : 'Override'}</span></td><td className="px-4 py-4 font-black text-slate-800">{Number(row.rate || 0).toFixed(2)}%</td><td className="px-4 py-4 font-black text-slate-950">{money(row.estimatedAmount)}</td></tr>)}</tbody>
        </table>
      </div>

      <div className="grid gap-3 md:hidden">{hierarchy.map((row) => <article key={`${row.order}-${row.accreditedSellerId}`} className="rounded-xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-950">{row.order}. {row.sellerName}</p><p className="text-xs font-semibold capitalize text-slate-500">{String(row.role || '').replaceAll('_', ' ')}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-black ${row.commissionType === 'direct' ? 'bg-blue-50 text-blue-700' : 'bg-violet-50 text-violet-700'}`}>{row.commissionType}</span></div><div className="mt-3 grid grid-cols-2 gap-3"><div><p className="text-xs font-bold text-slate-500">Rate</p><p className="font-black text-slate-950">{Number(row.rate || 0).toFixed(2)}%</p></div><div><p className="text-xs font-bold text-slate-500">Estimated</p><p className="font-black text-slate-950">{money(row.estimatedAmount)}</p></div></div>{row.isSystemDummy ? <p className="mt-3 text-xs font-semibold text-blue-600">Beneficiary: {row.beneficiaryName}</p> : null}</article>)}</div>

      {preview?.isValid ? <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-800"><FiCheckCircle />Hierarchy is ready for reservation.</div> : null}
    </div>
  )
}

const ReservePaymentTermsModal = ({
  listing,
  project,
  tcp,
  contractPricing,
  paymentForm,
  updatePaymentField,
  agents = [],
  selectedAgent = null,
  agentSearch = '',
  setAgentSearch,
  isLoadingAgents = false,
  agentsError = null,
  commissionPreview = null,
  isLoadingPreview = false,
  previewError = null,
}) => {
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  const firstDueMinimum = paymentForm.startingDate && paymentForm.startingDate > today
    ? paymentForm.startingDate
    : today
  const isCash = String(paymentForm.modeOfPayment || '').toLowerCase() === 'cash'
  const lotAreaSqm = Number(
    listing?.lotAreaSqm ??
    listing?.lot_project_listing_area_sqm ??
    listing?.area ??
    0
  )
  const lotAreaLabel = lotAreaSqm > 0
    ? `${new Intl.NumberFormat('en-PH', { maximumFractionDigits: 2 }).format(lotAreaSqm)} sqm`
    : '-'
  const listingLmfRate = Number(
    listing?.lmfRate ??
    listing?.legalMiscRate ??
    listing?.lot_project_listing_lmf_rate ??
    0
  )
  const listingInterestRate = Number(
    listing?.annualInterestRate ??
    listing?.annual_interest_rate ??
    0
  )
  const paymentCalculations = useMemo(() => getPaymentCalculations(tcp, paymentForm), [tcp, paymentForm])
  const paymentPreview = paymentCalculations.preview
  const lmfTreatment = paymentPreview.legalMiscFeeMode === 'separate_soa_row' ? 'Separate SOA row' : isCash ? 'Included in cash balance' : 'Included in monthly'
  const selectedPenaltyRateOption = dailyPenaltyRateOptions.includes(Number(paymentForm.dailyPenaltyRate))
    ? String(Number(paymentForm.dailyPenaltyRate))
    : 'custom'
  const isCustomPenaltyRate = selectedPenaltyRateOption === 'custom'

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Selected Listing" description="The selected payment mode chooses the matching price per SQM." right={<span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Auto status: Reserved</span>}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <PreviewCard label="Unit" value={listing?.unit_id || listing?.unitCode || '-'} />
          <PreviewCard label="Lot Area" value={lotAreaLabel} />
          <PreviewCard label="Project" value={project?.name || listing?.project_name || listing?.projectName || '-'} />
          <PreviewCard label="Pricing Mode" value={isCash ? 'Cash' : 'Installment'} tone="blue" />
          <PreviewCard label="Selected Price / SQM" value={money(contractPricing?.pricePerSqm)} tone="blue" />
          <PreviewCard label="Base Selling Price" value={money(contractPricing?.baseSellingPrice)} />
          <PreviewCard label="Sale Discount" value={money(contractPricing?.saleDiscountAmount)} tone="amber" />
          <PreviewCard label="Net Selling Price" value={money(contractPricing?.netSellingPrice)} />
          <PreviewCard label="TCP" value={money(tcp)} tone="blue" />
        </div>
      </SectionCard>

      <SectionCard title="Reservation Setup" description="All new reservations use distributed commission generation.">
        <div className="grid gap-4 md:grid-cols-2">
          <AgentPicker agents={agents} selectedAgent={selectedAgent} selectedAgentId={paymentForm.sellerId} search={agentSearch} onSearch={setAgentSearch} onSelect={(value) => updatePaymentField('sellerId', value)} isLoading={isLoadingAgents} error={agentsError} />
          <SelectInput label="Mode of Payment" value={paymentForm.modeOfPayment} onChange={(value) => updatePaymentField('modeOfPayment', value)}><option value="installment">Installment</option><option value="cash">Cash</option></SelectInput>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-xs font-black uppercase text-emerald-700">Reservation Status</p><p className="mt-1 text-sm font-black text-emerald-900">Reserved automatically after saving</p></div>
        </div>
      </SectionCard>

      <SectionCard title={isCash ? 'Cash Payment Terms' : 'Installment Payment Terms'}>
        <div className="grid gap-4 md:grid-cols-2">
          {isCash ? <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:col-span-2"><p className="text-xs font-black uppercase text-blue-700">Cash Schedule</p><p className="mt-1 text-sm font-semibold text-blue-900">The SOA will contain the reservation fee and one full-payment balance. Downpayment, monthly terms, and installment interest are not used.</p></div> : null}
          <TextInput label="Reservation Fee" type="number" value={paymentForm.reservationFee} onChange={(value) => updatePaymentField('reservationFee', value)} placeholder="Enter reservation fee" required />
          <TextInput label="Starting Date" type="date" value={paymentForm.startingDate} onChange={(value) => updatePaymentField('startingDate', value)} min={today} helper="Today or a future date." required />
          <TextInput label={isCash ? 'Full Payment Due Date' : 'First Due Date'} type="date" value={paymentForm.firstDueDate} onChange={(value) => updatePaymentField('firstDueDate', value)} min={firstDueMinimum} helper="Must be today or later and cannot be before the starting date." required />
          <TextInput
            label="LMF Rate (%)"
            type="number"
            value={paymentForm.legalMiscFeeRate}
            onChange={(value) => updatePaymentField('legalMiscFeeRate', value)}
            min="0"
            max="100"
            step="0.01"
            placeholder="0"
            helper={`Listing default: ${listingLmfRate.toFixed(2)}%. This reservation uses the entered rate without changing the listing.`}
            required
          />
          <SelectInput label="Legal / Misc Fee Treatment" value={paymentForm.legalMiscFeeMode || paymentForm.legalMiscFee} onChange={(value) => { updatePaymentField('legalMiscFee', value); updatePaymentField('legalMiscFeeMode', value) }} helper={`Calculated LMF: ${money(paymentForm.legalMiscFeeAmount || 0)}. Pay later creates a separate SOA row.`}><option value="include_in_monthly">{isCash ? 'Include in cash balance' : 'Include in monthly'}</option><option value="separate_soa_row">Pay later as separate SOA row</option></SelectInput>
          <TextInput label="Sale Discount %" type="number" value={paymentForm.saleDiscountPercentage} onChange={(value) => updatePaymentField('saleDiscountPercentage', value)} min="0" max="100" step="0.01" placeholder="0" helper="Applied to the selected base selling price. LMF remains based on the original base selling price." />

          {!isCash ? <>
            <SelectInput label="Downpayment Percentage" value={paymentForm.downpaymentPercentageMode} onChange={(value) => updatePaymentField('downpaymentPercentageMode', value)} helper="Choose 15%, 30%, or custom percentage. Custom may be 0%." required><option value="15">15%</option><option value="30">30%</option><option value="custom">Custom</option></SelectInput>
            {paymentForm.downpaymentPercentageMode === 'custom' ? <TextInput label="Custom Downpayment Percentage" type="number" value={paymentForm.customDownpaymentPercentage} onChange={(value) => updatePaymentField('customDownpaymentPercentage', value)} placeholder="Enter 0 to 100" helper="Enter a value from 0 to 100." required /> : null}
            <SelectInput label="Downpayment Terms" value={paymentForm.downpaymentTermsMode} onChange={(value) => updatePaymentField('downpaymentTermsMode', value)} helper="Choose spot cash, 1–12 months, or custom." required><option value="spot_cash">Spot Cash</option>{downpaymentTermOptions.map((value) => <option key={value} value={value}>{value} month{value === '1' ? '' : 's'}</option>)}<option value="custom">Custom</option></SelectInput>
            {paymentForm.downpaymentTermsMode === 'custom' ? <TextInput label="Custom Downpayment Terms" type="number" value={paymentForm.customDownpaymentTerms} onChange={(value) => updatePaymentField('customDownpaymentTerms', value)} placeholder="Number of months" required /> : null}
            <SelectInput label="Reservation Fee Treatment" value={paymentForm.reservationFeeTreatment || 'separate'} onChange={(value) => updatePaymentField('reservationFeeTreatment', value)} helper="Choose if the reservation fee stays separate or counts toward the required downpayment." required><option value="separate">Separate from Downpayment</option><option value="apply_to_downpayment">Deduct Reservation Fee from Downpayment</option></SelectInput>
            <TextInput label="Downpayment Discount %" type="number" value={paymentForm.dpDiscountPercentage} onChange={(value) => updatePaymentField('dpDiscountPercentage', value)} placeholder="0" helper="Applied only to the gross downpayment. It does not change the property TCP." />
            <SelectInput label="Monthly Terms" value={paymentForm.monthlyTermsMode} onChange={(value) => updatePaymentField('monthlyTermsMode', value)} helper="Choose 12, 24, 36, 48, 60 months, or custom." required><option value="12">12 months</option><option value="24">24 months</option><option value="36">36 months</option><option value="48">48 months</option><option value="60">60 months</option><option value="custom">Custom</option></SelectInput>
            {paymentForm.monthlyTermsMode === 'custom' ? <TextInput label="Custom Monthly Terms" type="number" value={paymentForm.customMonthlyTerms} onChange={(value) => updatePaymentField('customMonthlyTerms', value)} placeholder="Number of months" required /> : null}
            <TextInput
              label="Annual Interest Rate (%)"
              type="number"
              value={paymentForm.interestRate}
              onChange={(value) => updatePaymentField('interestRate', value)}
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              helper={`Listing default: ${listingInterestRate.toFixed(2)}%. A changed value is saved as this buyer's interest-rate override.`}
              required
            />
          </> : null}

          <SelectInput
            label={isCash ? 'Daily Penalty Rate for Overdue Cash Balance (%)' : 'Daily Penalty Rate for Overdue Installment (%)'}
            value={selectedPenaltyRateOption}
            onChange={(value) => updatePaymentField('dailyPenaltyRate', value === 'custom' ? '' : value)}
            helper="Choose a preset or enter a custom rate from 0% to 100% per day."
            required
          >
            {dailyPenaltyRateOptions.map((value) => <option key={value} value={String(value)}>{value}% per day</option>)}
            <option value="custom">Custom</option>
          </SelectInput>
          {isCustomPenaltyRate ? (
            <TextInput
              label="Custom Daily Penalty Rate (%)"
              type="number"
              value={paymentForm.dailyPenaltyRate}
              onChange={(value) => updatePaymentField('dailyPenaltyRate', value)}
              min="0"
              max="100"
              step="0.01"
              placeholder="Enter 0 to 100"
              helper="Saved only for this buyer's reservation."
              required
            />
          ) : null}
          <SelectInput label="Penalty-Free Grace Period" value={paymentForm.penaltyGraceDays} onChange={(value) => updatePaymentField('penaltyGraceDays', value)} helper="Choose when daily penalties begin." required>{penaltyGraceDayOptions.map((value) => <option key={value} value={value}>{value === '0' ? 'No grace period (0 days)' : `${value} day${value === '1' ? '' : 's'}`}</option>)}</SelectInput>
          {!isCash ? <TextInput label="Monthly Amortization" value={money(paymentPreview.monthlyAmortization)} onChange={() => null} disabled helper="Calculated from the balance, interest rate, and monthly terms." /> : null}
        </div>
      </SectionCard>

      <SectionCard title="Automatic Hierarchy Commission Preview" description="Commission Base is lot area × selected price per SQM before sale discount and LMF.">
        <HierarchyPreview preview={commissionPreview} isLoading={isLoadingPreview} error={previewError} hasSelectedAgent={Boolean(paymentForm.sellerId)} />
      </SectionCard>

      <SectionCard title="Payment Preview">
        <div className="mb-3 grid gap-3 md:grid-cols-2 lg:grid-cols-5">
          <PreviewCard label="Base Selling Price" value={money(contractPricing?.baseSellingPrice)} />
          <PreviewCard label={`Sale Discount (${Number(paymentForm.saleDiscountPercentage || 0)}%)`} value={money(contractPricing?.saleDiscountAmount)} tone="amber" />
          <PreviewCard label="Net Selling Price" value={money(contractPricing?.netSellingPrice)} />
          <PreviewCard label={`LMF (${Number(contractPricing?.legalMiscRate || 0).toFixed(2)}%)`} value={money(contractPricing?.lmfAmount)} />
          <PreviewCard label="Final TCP" value={money(tcp)} tone="blue" />
        </div>
        {isCash ? <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"><PreviewCard label="Reservation" value={money(paymentPreview.reservationFee)} /><PreviewCard label="LMF Treatment" value={lmfTreatment} /><PreviewCard label="Full Payment Balance" value={money(paymentPreview.fullPaymentAmount)} tone="blue" /><PreviewCard label="Full Payment Due" value={paymentForm.firstDueDate || '-'} tone="emerald" /><PreviewCard label="Interest" value="0%" tone="emerald" /></div> : <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-9"><PreviewCard label="Reservation" value={money(paymentPreview.reservationFee)} /><PreviewCard label="LMF Treatment" value={lmfTreatment} /><PreviewCard label="DP Target" value={money(paymentPreview.dpTarget)} /><PreviewCard label="Reservation Applied to DP" value={money(paymentPreview.reservationFeeDownpaymentCredit)} tone={paymentPreview.reservationFeeAppliedToDownpayment ? 'amber' : 'slate'} /><PreviewCard label={paymentPreview.reservationFeeAppliedToDownpayment ? 'DP Less Reservation' : 'DP Gross'} value={money(paymentPreview.dpGross)} /><PreviewCard label="Downpayment Discount" value={money(paymentPreview.dpDiscountAmount)} tone="amber" /><PreviewCard label="DP Net Payable" value={money(paymentPreview.dpNet)} /><PreviewCard label="Balance" value={money(paymentPreview.balance)} tone="blue" /><PreviewCard label="Monthly" value={money(paymentPreview.monthlyAmortization)} tone="emerald" /></div>}
      </SectionCard>
    </div>
  )
}

export default ReservePaymentTermsModal
