import { useMemo } from 'react'
import { getPaymentCalculations, money } from './reserveUtils'
import { SectionCard, SelectInput, TextInput } from './ReserveShared'

const downpaymentTermOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))
const dailyPenaltyRateOptions = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 2, 3, 4, 5]
const penaltyGraceDayOptions = Array.from({ length: 31 }, (_, index) => String(index + 1))

const PreviewCard = ({ label, value, tone = 'slate' }) => {
  const tones = {
    slate: 'border-slate-200 bg-slate-50 text-slate-950',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }

  const labelTones = {
    slate: 'text-slate-500',
    blue: 'text-blue-700',
    amber: 'text-amber-700',
    emerald: 'text-emerald-700',
  }

  return (
    <div className={`rounded-xl border p-4 ${tones[tone] || tones.slate}`}>
      <p className={`text-xs font-black uppercase ${labelTones[tone] || labelTones.slate}`}>{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  )
}

const ReservePaymentTermsModal = ({
  listing,
  tcp,
  paymentForm,
  updatePaymentField,
  sellerOptions = [],
}) => {
  const sellers = sellerOptions
  const isCash = String(paymentForm.modeOfPayment || '').toLowerCase() === 'cash'
  const selectedSeller = useMemo(
    () => sellers.find((seller) => String(seller.id) === String(paymentForm.sellerId)) || sellers[0] || { name: '-', role: '-', rate: '0%', allocation: 'No seller selected' },
    [sellers, paymentForm.sellerId]
  )

  const paymentCalculations = useMemo(
    () => getPaymentCalculations(tcp, paymentForm),
    [tcp, paymentForm]
  )

  const paymentPreview = paymentCalculations.preview
  const lmfTreatment = paymentPreview.legalMiscFeeMode === 'separate_soa_row'
    ? 'Separate SOA row'
    : isCash
      ? 'Included in cash balance'
      : 'Included in monthly'

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Selected Listing"
        description="This reservation is for the current listing profile."
        right={
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            Auto status: Reserved
          </span>
        }
      >
        <div className="grid gap-3 md:grid-cols-4">
          <PreviewCard label="Unit" value={listing?.unit_id || listing?.unitCode || '-'} />
          <PreviewCard label="Project" value={listing?.project_name || listing?.projectName || 'Bailen Project'} />
          <PreviewCard label="Lot Type" value={listing?.lot_type || '-'} />
          <PreviewCard label="TCP" value={money(tcp)} tone="blue" />
        </div>
      </SectionCard>

      <SectionCard title="Reservation Setup">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectInput
            label="Assigned Seller / Unit Manager"
            value={paymentForm.sellerId}
            onChange={(value) => updatePaymentField('sellerId', value)}
            required
          >
            <option value="">Select accredited seller</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.name} · {seller.role}
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="Mode of Payment"
            value={paymentForm.modeOfPayment}
            onChange={(value) => updatePaymentField('modeOfPayment', value)}
          >
            <option value="installment">Installment</option>
            <option value="cash">Cash</option>
          </SelectInput>

          <SelectInput
            label="Sale Channel"
            value={paymentForm.saleChannel}
            onChange={(value) => updatePaymentField('saleChannel', value)}
          >
            <option value="distributed">Distributed</option>
            <option value="direct_to_developer">Direct to Developer</option>
          </SelectInput>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase text-emerald-700">Reservation Status</p>
            <p className="mt-1 text-sm font-black text-emerald-900">
              Reserved automatically after saving
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={isCash ? 'Cash Payment Terms' : 'Installment Payment Terms'}>
        <div className="grid gap-4 md:grid-cols-2">
          {isCash ? (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
              <p className="text-xs font-black uppercase text-blue-700">Cash Schedule</p>
              <p className="mt-1 text-sm font-semibold text-blue-900">
                The SOA will contain the reservation fee and one full-payment balance. Downpayment, monthly terms, and installment interest are not used.
              </p>
            </div>
          ) : null}

          <TextInput
            label="Reservation Fee"
            type="number"
            value={paymentForm.reservationFee}
            onChange={(value) => updatePaymentField('reservationFee', value)}
            placeholder="50000"
            required
          />

          <TextInput
            label="Starting Date"
            type="date"
            value={paymentForm.startingDate}
            onChange={(value) => updatePaymentField('startingDate', value)}
          />

          <TextInput
            label={isCash ? 'Full Payment Due Date' : 'First Due Date'}
            type="date"
            value={paymentForm.firstDueDate}
            onChange={(value) => updatePaymentField('firstDueDate', value)}
          />

          <SelectInput
            label="Legal / Misc Fee"
            value={paymentForm.legalMiscFeeMode || paymentForm.legalMiscFee}
            onChange={(value) => {
              updatePaymentField('legalMiscFee', value)
              updatePaymentField('legalMiscFeeMode', value)
            }}
            helper={`LMF amount: ${money(paymentForm.legalMiscFeeAmount || 0)}. Pay later creates a separate SOA row.`}
          >
            <option value="include_in_monthly">{isCash ? 'Include in cash balance' : 'Include in monthly'}</option>
            <option value="separate_soa_row">Pay later as separate SOA row</option>
          </SelectInput>

          {!isCash ? (
            <>
              <SelectInput
                label="Downpayment Percentage"
                value={paymentForm.downpaymentPercentageMode}
                onChange={(value) => updatePaymentField('downpaymentPercentageMode', value)}
                helper="Choose 15%, 30%, or custom percentage. Custom may be 0% for deferred cash."
                required
              >
                <option value="15">15%</option>
                <option value="30">30%</option>
                <option value="custom">Custom</option>
              </SelectInput>

              {paymentForm.downpaymentPercentageMode === 'custom' ? (
                <TextInput
                  label="Custom Downpayment Percentage"
                  type="number"
                  value={paymentForm.customDownpaymentPercentage}
                  onChange={(value) => updatePaymentField('customDownpaymentPercentage', value)}
                  placeholder="Example: 0"
                  helper="Enter a value from 0 to 100."
                  required
                />
              ) : null}

              <SelectInput
                label="Downpayment Terms"
                value={paymentForm.downpaymentTermsMode}
                onChange={(value) => updatePaymentField('downpaymentTermsMode', value)}
                helper="Choose spot cash, 1-12 months, or custom."
                required
              >
                <option value="spot_cash">Spot Cash</option>
                {downpaymentTermOptions.map((value) => (
                  <option key={value} value={value}>
                    {value} month{value === '1' ? '' : 's'}
                  </option>
                ))}
                <option value="custom">Custom</option>
              </SelectInput>

              {paymentForm.downpaymentTermsMode === 'custom' ? (
                <TextInput
                  label="Custom Downpayment Terms"
                  type="number"
                  value={paymentForm.customDownpaymentTerms}
                  onChange={(value) => updatePaymentField('customDownpaymentTerms', value)}
                  placeholder="Number of months"
                  required
                />
              ) : null}

              <SelectInput
                label="Reservation Fee Treatment"
                value={paymentForm.reservationFeeTreatment || 'separate'}
                onChange={(value) => updatePaymentField('reservationFeeTreatment', value)}
                helper="Choose if the reservation fee stays separate or counts toward the required downpayment."
                required
              >
                <option value="separate">Separate from Downpayment</option>
                <option value="apply_to_downpayment">Deduct Reservation Fee from Downpayment</option>
              </SelectInput>

              <TextInput
                label="DP Discount %"
                type="number"
                value={paymentForm.dpDiscountPercentage}
                onChange={(value) => updatePaymentField('dpDiscountPercentage', value)}
                placeholder="0"
                helper="Use 0 when there is no discount."
              />

              <SelectInput
                label="Monthly Terms"
                value={paymentForm.monthlyTermsMode}
                onChange={(value) => updatePaymentField('monthlyTermsMode', value)}
                helper="Choose 12, 24, 36, 48, 60 months, or custom."
                required
              >
                <option value="12">12 months</option>
                <option value="24">24 months</option>
                <option value="36">36 months</option>
                <option value="48">48 months</option>
                <option value="60">60 months</option>
                <option value="custom">Custom</option>
              </SelectInput>

              {paymentForm.monthlyTermsMode === 'custom' ? (
                <TextInput
                  label="Custom Monthly Terms"
                  type="number"
                  value={paymentForm.customMonthlyTerms}
                  onChange={(value) => updatePaymentField('customMonthlyTerms', value)}
                  placeholder="Number of months"
                  required
                />
              ) : null}

              <TextInput
                label="Interest Rate"
                value={`${paymentForm.interestRate}%`}
                onChange={() => null}
                disabled
                helper="This is set from the selected listing. Edit the listing to change it."
              />
            </>
          ) : null}

          <SelectInput
            label={isCash ? 'Daily Penalty Rate for Overdue Cash Balance (%)' : 'Daily Penalty Rate for Overdue Installment (%)'}
            value={paymentForm.dailyPenaltyRate}
            onChange={(value) => updatePaymentField('dailyPenaltyRate', value)}
            helper="Saved with this buyer's reservation. It will not change when project policies change later."
            required
          >
            {dailyPenaltyRateOptions.map((value) => (
              <option key={value} value={String(value)}>
                {value}% per day
              </option>
            ))}
          </SelectInput>

          <SelectInput
            label="Penalty-Free Grace Period"
            value={paymentForm.penaltyGraceDays}
            onChange={(value) => updatePaymentField('penaltyGraceDays', value)}
            helper="Penalty begins on the next calendar day after this grace period ends."
            required
          >
            {penaltyGraceDayOptions.map((value) => (
              <option key={value} value={value}>
                {value} day{value === '1' ? '' : 's'}
              </option>
            ))}
          </SelectInput>

          {!isCash ? (
            <TextInput
              label="Monthly Amortization"
              value={money(paymentPreview.monthlyAmortization)}
              onChange={() => null}
              disabled
              helper="Automatically calculated from balance and monthly terms."
            />
          ) : null}
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Main Seller Commission">
          <div className="grid gap-3 md:grid-cols-3">
            <PreviewCard label="Seller" value={selectedSeller.name} />
            <PreviewCard label="Role" value={selectedSeller.role} />
            <PreviewCard label="Rate" value={selectedSeller.rate} tone="blue" />
          </div>
        </SectionCard>

        <SectionCard
          title="Automatic Hierarchy Commission Preview"
          description="Distributed sales use seller hierarchy and saved pool/split rates."
        >
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase text-blue-700">{selectedSeller.allocation}</p>
            <p className="mt-2 text-sm font-black text-slate-950">{selectedSeller.name}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              {selectedSeller.role} · {selectedSeller.rate}
            </p>
          </div>
        </SectionCard>
      </div>

      <SectionCard title="Payment Preview">
        {isCash ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <PreviewCard label="TCP" value={money(tcp)} />
            <PreviewCard label="Reservation" value={money(paymentPreview.reservationFee)} />
            <PreviewCard label="LMF Treatment" value={lmfTreatment} />
            <PreviewCard label="Full Payment Balance" value={money(paymentPreview.fullPaymentAmount)} tone="blue" />
            <PreviewCard label="Full Payment Due" value={paymentForm.firstDueDate || '-'} tone="emerald" />
            <PreviewCard label="Interest" value="0%" tone="emerald" />
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-10">
            <PreviewCard label="TCP" value={money(tcp)} />
            <PreviewCard label="Reservation" value={money(paymentPreview.reservationFee)} />
            <PreviewCard label="LMF Treatment" value={lmfTreatment} />
            <PreviewCard label="DP Target" value={money(paymentPreview.dpTarget)} />
            <PreviewCard
              label="Reservation Applied to DP"
              value={money(paymentPreview.reservationFeeDownpaymentCredit)}
              tone={paymentPreview.reservationFeeAppliedToDownpayment ? 'amber' : 'slate'}
            />
            <PreviewCard
              label={paymentPreview.reservationFeeAppliedToDownpayment ? 'DP Less Reservation' : 'DP Gross'}
              value={money(paymentPreview.dpGross)}
            />
            <PreviewCard label="DP Discount" value={money(paymentPreview.dpDiscountAmount)} tone="amber" />
            <PreviewCard label="DP Net Payable" value={money(paymentPreview.dpNet)} />
            <PreviewCard label="Balance" value={money(paymentPreview.balance)} tone="blue" />
            <PreviewCard label="Monthly" value={money(paymentPreview.monthlyAmortization)} tone="emerald" />
          </div>
        )}
      </SectionCard>
    </div>
  )
}

export default ReservePaymentTermsModal
