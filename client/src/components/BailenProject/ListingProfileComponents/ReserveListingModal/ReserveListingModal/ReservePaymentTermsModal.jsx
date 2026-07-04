import { useMemo } from 'react'
import { sellers } from './reserveData'
import { getPaymentCalculations, money } from './reserveUtils'
import { SectionCard, SelectInput, TextInput } from './ReserveShared'

const downpaymentTermOptions = Array.from({ length: 12 }, (_, index) => String(index + 1))

const ReservePaymentTermsModal = ({
  listing,
  tcp,
  paymentForm,
  updatePaymentField,
}) => {
  const selectedSeller = useMemo(
    () => sellers.find((seller) => String(seller.id) === String(paymentForm.sellerId)) || sellers[0],
    [paymentForm.sellerId]
  )

  const paymentCalculations = useMemo(
    () => getPaymentCalculations(tcp, paymentForm),
    [tcp, paymentForm]
  )

  const paymentPreview = paymentCalculations.preview

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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Unit</p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {listing?.unit_id || listing?.unitCode || '-'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Project</p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {listing?.project_name || listing?.projectName || 'Bailen Project'}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Lot Type</p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {listing?.lot_type || '-'}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase text-blue-700">TCP</p>
            <p className="mt-1 text-sm font-black text-blue-900">{money(tcp)}</p>
          </div>
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

      <SectionCard title="Payment Terms">
        <div className="grid gap-4 md:grid-cols-2">
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
            label="First Due Date"
            type="date"
            value={paymentForm.firstDueDate}
            onChange={(value) => updatePaymentField('firstDueDate', value)}
          />

          <SelectInput
            label="Legal / Misc Fee"
            value={paymentForm.legalMiscFee}
            onChange={(value) => updatePaymentField('legalMiscFee', value)}
            helper="Pay later means a separate SOA row will be created."
          >
            <option value="include_in_monthly">Include in monthly</option>
            <option value="separate_soa_row">Pay later as separate SOA row</option>
          </SelectInput>

          <SelectInput
            label="Downpayment Percentage"
            value={paymentForm.downpaymentPercentageMode}
            onChange={(value) => updatePaymentField('downpaymentPercentageMode', value)}
            helper="Choose 15%, 30%, or custom percentage."
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
              placeholder="Example: 25"
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

          <TextInput
            label="Monthly Amortization"
            value={money(paymentPreview.monthlyAmortization)}
            onChange={() => null}
            disabled
            helper="Automatically calculated from balance and monthly terms."
          />
        </div>
      </SectionCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard title="Main Seller Commission">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Seller</p>
              <p className="mt-1 text-sm font-black text-slate-950">{selectedSeller.name}</p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-black uppercase text-slate-500">Role</p>
              <p className="mt-1 text-sm font-black text-slate-950">{selectedSeller.role}</p>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-black uppercase text-blue-700">Rate</p>
              <p className="mt-1 text-sm font-black text-blue-900">{selectedSeller.rate}</p>
            </div>
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
        <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">TCP</p>
            <p className="mt-1 text-sm font-black text-slate-950">{money(tcp)}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">Reservation</p>
            <p className="mt-1 text-sm font-black text-slate-950">
              {money(paymentPreview.reservationFee)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-500">DP Gross</p>
            <p className="mt-1 text-sm font-black text-slate-950">{money(paymentPreview.dpGross)}</p>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-xs font-black uppercase text-amber-700">DP Discount</p>
            <p className="mt-1 text-sm font-black text-amber-900">
              {money(paymentPreview.dpDiscountAmount)}
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-black uppercase text-blue-700">Balance</p>
            <p className="mt-1 text-sm font-black text-blue-900">{money(paymentPreview.balance)}</p>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-xs font-black uppercase text-emerald-700">Monthly</p>
            <p className="mt-1 text-sm font-black text-emerald-900">
              {money(paymentPreview.monthlyAmortization)}
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}

export default ReservePaymentTermsModal
