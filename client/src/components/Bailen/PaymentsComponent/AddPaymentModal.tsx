import { FiAlertCircle, FiX } from "react-icons/fi";

type Props = {
  onClose: () => void;
};

const AddPaymentModal = ({ onClose }: Props) => {
  const handleSave = () => {
    alert("Design only: payment will be saved to this listing and reflected in SOA once connected to backend.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Add Listing Payment
            </h3>
            <p className="text-sm text-slate-500">
              Payments are encoded inside the listing. The Payments page is only for audit/logs.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto px-6 py-5 md:grid-cols-2">
          <Input label="Unit / Listing" placeholder="LA-0205" />

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">Payment Type</span>
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="reservation">Reservation</option>
              <option value="downpayment">Downpayment</option>
              <option value="monthly_amortization">Monthly Amortization</option>
              <option value="legal_misc">Legal / Miscellaneous</option>
              <option value="full_payment">Full Payment</option>
              <option value="advance_payment">Advance Payment</option>
              <option value="balloon_payment">Balloon Payment</option>
              <option value="other">Other</option>
            </select>
          </label>

          <Input label="Amount" type="number" placeholder="50000" />

          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">Payment Method</span>
            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="online">Online</option>
            </select>
          </label>

          <Input label="Payment Date" type="date" />
          <Input label="Reference ID" placeholder="Auto for cash / manual for bank" />

          <label className="md:col-span-2 flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">Remarks</span>
            <textarea
              rows={4}
              placeholder="Notes for verification, SOA, advance, offset, or balloon payment."
              className="resize-none rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 md:col-span-2">
            <div className="flex gap-3">
              <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
              <div>
                <p className="font-bold text-blue-900">Payment rules reminder</p>
                <p className="mt-1 text-sm leading-6 text-blue-700">
                  Advance payment should reduce the remaining duration, not the fixed monthly amortization.
                  Balloon payment is a contracted end payment. Cash reference can be auto-generated later by backend.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Save Payment
          </button>
        </div>
      </div>
    </div>
  );
};

type InputProps = {
  label: string;
  type?: string;
  placeholder?: string;
};

const Input = ({ label, type = "text", placeholder = "" }: InputProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <input
      type={type}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

export default AddPaymentModal;
