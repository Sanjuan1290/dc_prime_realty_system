import { FiX } from "react-icons/fi";

type Props = {
  onClose: () => void;
};

const rateOptions = [6, 7, 8, 9, 10, 11, 12];

const AddListingModal = ({ onClose }: Props) => {
  const handleSave = () => {
    alert("Design only: listing will be saved once connected to backend.");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Add Bailen Listing
            </h3>
            <p className="text-sm text-slate-500">
              Add unit inventory first. Client profile can be added later from Details.
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

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-bold text-slate-950">Unit Information</h4>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Input label="Unit Number" placeholder="0203" />
                <Input label="Display Unit Code" placeholder="LA-0203" />
                <Input label="Old Unit IDs" placeholder="LA-0204, LA-0202" />

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700">Lot Type</span>
                  <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                    <option value="inner">Inner</option>
                    <option value="corner">Corner</option>
                    <option value="end">End</option>
                  </select>
                </label>

                <Input label="Area SQM" type="number" placeholder="1000" />
                <Input label="Price Per SQM" type="number" placeholder="555" />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="font-bold text-slate-950">Pricing Setup</h4>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Input label="Reservation Fee" type="number" placeholder="50000" />

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    Legal Misc. Rate
                  </span>
                  <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                    {rateOptions.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                </label>

                <Input label="Annual Interest Rate" type="number" placeholder="7.5" />
              </div>
            </section>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <p className="font-bold text-blue-800">Next step after adding</p>
              <p className="mt-1 text-sm text-blue-700">
                Open Details to encode buyer profile, payment terms, seller, and document checklist.
              </p>
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
            Save Listing
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

export default AddListingModal;
