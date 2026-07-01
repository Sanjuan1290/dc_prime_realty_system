import { useMemo, useState } from "react";
import { FiAlertCircle, FiX } from "react-icons/fi";
import { cadastralLotNumberOptions } from "../../../pages/Bailen/bailenSampleData";

type Props = {
  onClose: () => void;
};

const legalMiscRateOptions = [6, 7, 8, 9, 10, 11, 12];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const toNumber = (value: string) => {
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const AddListingModal = ({ onClose }: Props) => {
  const [areaSqm, setAreaSqm] = useState("0");
  const [pricePerSqm, setPricePerSqm] = useState("0");
  const [legalMiscRate, setLegalMiscRate] = useState("10");
  const [reservationFee, setReservationFee] = useState("50000");
  const [annualInterestRate, setAnnualInterestRate] = useState("0");
  const [selectedCadastralIds, setSelectedCadastralIds] = useState<number[]>([]);

  const priceBreakdown = useMemo(() => {
    const netSellingPrice = toNumber(areaSqm) * toNumber(pricePerSqm);
    const lmfAmount = netSellingPrice * (toNumber(legalMiscRate) / 100);
    const tcp = netSellingPrice + lmfAmount;

    return {
      netSellingPrice,
      lmfAmount,
      tcp,
      reservationFee: toNumber(reservationFee),
      annualInterestRate: toNumber(annualInterestRate),
    };
  }, [annualInterestRate, areaSqm, legalMiscRate, pricePerSqm, reservationFee]);

  const toggleCadastral = (id: number) => {
    setSelectedCadastralIds((prevIds) =>
      prevIds.includes(id)
        ? prevIds.filter((item) => item !== id)
        : [...prevIds, id]
    );
  };

  const handleSave = () => {
    alert(
      "Design only: listing will be saved once connected to backend. Cadastral numbers and price breakdown are ready for API payload."
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Add Bailen Listing
            </h3>
            <p className="text-sm text-slate-500">
              Add unit inventory first. Buyer profile, payments, SOA, and documents are handled from the listing page.
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
              <div>
                <h4 className="font-bold text-slate-950">Unit Information</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Unit code still follows the Bailen location code, for example LA-0203.
                </p>
              </div>

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

                <Input
                  label="Area SQM"
                  type="number"
                  value={areaSqm}
                  onChange={setAreaSqm}
                  placeholder="1000"
                />

                <Input
                  label="Price Per SQM"
                  type="number"
                  value={pricePerSqm}
                  onChange={setPricePerSqm}
                  placeholder="555"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h4 className="font-bold text-slate-950">Cadastral Lot Numbers</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Select one or more cadastral numbers connected to this listing.
                </p>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {cadastralLotNumberOptions.map((item) => {
                  const isSelected = selectedCadastralIds.includes(item.id);

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleCadastral(item.id)}
                      className={`rounded-xl border px-4 py-3 text-left text-sm font-bold transition ${
                        isSelected
                          ? "border-blue-300 bg-blue-50 text-blue-700"
                          : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <h4 className="font-bold text-slate-950">Pricing Setup</h4>
                <p className="mt-1 text-sm text-slate-500">
                  Breakdown updates as you type. This is only for design until backend is connected.
                </p>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <Input
                  label="Reservation Fee"
                  type="number"
                  value={reservationFee}
                  onChange={setReservationFee}
                  placeholder="50000"
                />

                <label className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700">
                    Legal Misc. Rate
                  </span>
                  <select
                    value={legalMiscRate}
                    onChange={(event) => setLegalMiscRate(event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  >
                    {legalMiscRateOptions.map((rate) => (
                      <option key={rate} value={rate}>
                        {rate}%
                      </option>
                    ))}
                  </select>
                </label>

                <Input
                  label="Annual Interest Rate"
                  type="number"
                  value={annualInterestRate}
                  onChange={setAnnualInterestRate}
                  placeholder="0"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="mb-4 flex items-start gap-3">
                <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                <div>
                  <h4 className="font-bold text-blue-900">Price Breakdown</h4>
                  <p className="text-sm text-blue-700">
                    These values will be saved with the listing so the SOA, Offer to Buy, and commissions can reuse the same snapshot.
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <BreakdownCard label="Net Selling Price" value={formatMoney(priceBreakdown.netSellingPrice)} />
                <BreakdownCard label="LMF Amount" value={formatMoney(priceBreakdown.lmfAmount)} />
                <BreakdownCard label="TCP" value={formatMoney(priceBreakdown.tcp)} />
                <BreakdownCard label="Reservation Fee" value={formatMoney(priceBreakdown.reservationFee)} />
                <BreakdownCard label="Annual Interest Rate" value={`${priceBreakdown.annualInterestRate}%`} />
              </div>
            </section>
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
  value?: string;
  onChange?: (value: string) => void;
};

const Input = ({
  label,
  type = "text",
  placeholder = "",
  value,
  onChange,
}: InputProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

type BreakdownCardProps = {
  label: string;
  value: string;
};

const BreakdownCard = ({ label, value }: BreakdownCardProps) => (
  <div className="rounded-xl border border-blue-100 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
  </div>
);

export default AddListingModal;
