import { useState } from "react";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiCreditCard,
  FiFileText,
  FiHome,
  FiSave,
  FiUser,
  FiX,
} from "react-icons/fi";
import type { BailenBuyerType, BailenPaymentMode, Bailen_Lot_Listing } from "../../../types/listing";

type Props = {
  listing: Bailen_Lot_Listing;
  onClose: () => void;
};

type TabKey = "unit" | "client" | "terms" | "documents";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const tabs: { key: TabKey; label: string; icon: typeof FiHome }[] = [
  { key: "unit", label: "Unit Details", icon: FiHome },
  { key: "client", label: "Client Profile", icon: FiUser },
  { key: "terms", label: "Payment Terms", icon: FiCreditCard },
  { key: "documents", label: "Documents", icon: FiFileText },
];

const ListingDetailsModal = ({ listing, onClose }: Props) => {
  const [activeTab, setActiveTab] = useState<TabKey>("unit");
  const [buyerType, setBuyerType] = useState<BailenBuyerType>(
    listing.bailen_lot_listing_client_profile?.buyer_type ?? "single"
  );
  const [paymentMode, setPaymentMode] = useState<BailenPaymentMode>(
    listing.bailen_lot_listing_payment_terms?.payment_mode ?? "installment"
  );

  const isSoldOrReserved =
    listing.bailen_lot_listing_status === "sold" ||
    listing.bailen_lot_listing_status === "reserved";

  const hasClientProfile =
    listing.bailen_lot_listing_client_profile?.profile_status === "complete";

  const handleSaveProfile = () => {
    alert(
      "Design only: client profile will be saved to this listing/unit record once connected to backend."
    );
  };

  const handleSaveTerms = () => {
    alert(
      "Design only: payment terms will generate SOA, payment schedule, and commission milestones once connected to backend."
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-950">
                {listing.bailen_lot_listing_unit_code}
              </h3>

              <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold capitalize text-blue-700">
                {listing.bailen_lot_listing_lot_type} lot
              </span>

              <span
                className={[
                  "rounded-full border px-3 py-1 text-xs font-bold capitalize",
                  isSoldOrReserved
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : listing.bailen_lot_listing_status === "hold"
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : listing.bailen_lot_listing_status === "cancelled"
                        ? "border-red-200 bg-red-50 text-red-700"
                        : "border-slate-200 bg-slate-50 text-slate-600",
                ].join(" ")}
              >
                {listing.bailen_lot_listing_status}
              </span>
            </div>

            <p className="mt-1 text-sm text-slate-500">
              Listing details, buyer profile, terms, and document checklist are
              managed from this modal.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 lg:grid-cols-[260px_1fr]">
          <aside className="border-b border-slate-200 bg-slate-50 p-4 lg:border-b-0 lg:border-r">
            <div className="grid gap-2">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.key;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    className={[
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-left text-sm font-bold transition",
                      isActive
                        ? "bg-blue-600 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700",
                    ].join(" ")}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="text-sm font-bold text-amber-800">
                    Client profile is per listing
                  </p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    If the same buyer buys 3 units, each unit keeps its own
                    profile snapshot and payment terms.
                  </p>
                </div>
              </div>
            </div>
          </aside>

          <section className="min-h-0 overflow-y-auto p-5">
            {activeTab === "unit" && (
              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-4">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-500">Area</p>
                    <h4 className="mt-2 text-2xl font-bold text-slate-950">
                      {listing.bailen_lot_listing_lot_area_sqm.toLocaleString()} sqm
                    </h4>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-500">
                      Price / SQM
                    </p>
                    <h4 className="mt-2 text-2xl font-bold text-slate-950">
                      {formatMoney(listing.bailen_lot_listing_price_sqm)}
                    </h4>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-500">TCP</p>
                    <h4 className="mt-2 text-2xl font-bold text-blue-700">
                      {formatMoney(listing.bailen_lot_listing_total_contract_price)}
                    </h4>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-500">
                      Reservation
                    </p>
                    <h4 className="mt-2 text-2xl font-bold text-slate-950">
                      {formatMoney(listing.bailen_lot_listing_reservation_fee)}
                    </h4>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                  <h4 className="font-bold text-slate-950">
                    Pricing Computation
                  </h4>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <InfoRow
                      label="Net Selling Price"
                      value={formatMoney(listing.bailen_lot_listing_net_selling_price)}
                    />
                    <InfoRow
                      label="Legal & Miscellaneous Fee"
                      value={`${listing.bailen_lot_listing_legal_misc_rate}% • ${formatMoney(
                        listing.bailen_lot_listing_legal_misc_fee
                      )}`}
                    />
                    <InfoRow
                      label="Annual Interest Rate"
                      value={`${listing.bailen_lot_listing_annual_interest_rate}%`}
                    />
                    <InfoRow
                      label="Old Unit IDs"
                      value={
                        listing.bailen_lot_listing_old_unit_ids.length
                          ? listing.bailen_lot_listing_old_unit_ids.join(", ")
                          : "-"
                      }
                    />
                  </div>
                </div>
              </div>
            )}

            {activeTab === "client" && (
              <div className="grid gap-5">
                <div
                  className={[
                    "rounded-2xl border p-4",
                    hasClientProfile
                      ? "border-emerald-200 bg-emerald-50"
                      : "border-amber-200 bg-amber-50",
                  ].join(" ")}
                >
                  <div className="flex gap-3">
                    {hasClientProfile ? (
                      <FiCheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                    ) : (
                      <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                    )}

                    <div>
                      <p
                        className={[
                          "text-sm font-bold",
                          hasClientProfile ? "text-emerald-800" : "text-amber-800",
                        ].join(" ")}
                      >
                        {hasClientProfile
                          ? "Client profile complete"
                          : "Client profile still missing"}
                      </p>
                      <p
                        className={[
                          "mt-1 text-sm",
                          hasClientProfile ? "text-emerald-700" : "text-amber-700",
                        ].join(" ")}
                      >
                        This profile belongs only to {listing.bailen_lot_listing_unit_code}.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        Buyer Type
                      </span>
                      <select
                        value={buyerType}
                        onChange={(event) =>
                          setBuyerType(event.target.value as BailenBuyerType)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="single">Single Buyer</option>
                        <option value="spouses">Spouses</option>
                        <option value="and_account">And Account</option>
                      </select>
                    </label>

                    <Input label="Primary Buyer Name" defaultValue={listing.bailen_lot_listing_client_profile?.primary_buyer.full_name ?? ""} />
                    <Input label="Email" defaultValue={listing.bailen_lot_listing_client_profile?.primary_buyer.email ?? ""} />
                    <Input label="Contact No." defaultValue={listing.bailen_lot_listing_client_profile?.primary_buyer.contact_no ?? ""} />
                    <Input label="TIN" defaultValue={listing.bailen_lot_listing_client_profile?.primary_buyer.tin ?? ""} />
                    <Input label="Employer / Business" defaultValue={listing.bailen_lot_listing_client_profile?.primary_buyer.employer_or_business_name ?? ""} />
                  </div>

                  <label className="mt-4 flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-700">
                      Present Address
                    </span>
                    <textarea
                      rows={3}
                      defaultValue={listing.bailen_lot_listing_client_profile?.primary_buyer.address ?? ""}
                      className="resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>

                  {buyerType !== "single" && (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <h4 className="font-bold text-slate-950">
                        {buyerType === "spouses" ? "Spouse Details" : "Co-buyer Details"}
                      </h4>

                      <div className="mt-4 grid gap-4 md:grid-cols-3">
                        <Input label="Full Name" />
                        <Input label="Email" />
                        <Input label="Contact No." />
                        <Input label="Employer / Business" />
                        <Input label="Monthly Income" type="number" />
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveProfile}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      <FiSave className="h-4 w-4" />
                      Save Client Profile
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "terms" && (
              <div className="grid gap-5">
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <p className="font-bold text-blue-800">
                    Terms saved here will drive Payments, SOA, and Commissions.
                  </p>
                  <p className="mt-1 text-sm text-blue-700">
                    Extra/advance payments should shorten duration, not reduce monthly amount.
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        Payment Mode
                      </span>
                      <select
                        value={paymentMode}
                        onChange={(event) =>
                          setPaymentMode(event.target.value as BailenPaymentMode)
                        }
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="cash">Cash</option>
                        <option value="installment">Installment</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2">
                      <span className="text-sm font-bold text-slate-700">
                        Term
                      </span>
                      <select
                        disabled={paymentMode === "cash"}
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 disabled:bg-slate-100 disabled:text-slate-400"
                      >
                        <option value="36">36 months</option>
                        <option value="60">60 months</option>
                      </select>
                    </label>

                    <Input label="First Due Date" type="date" />
                    <Input label="Reservation Fee" type="number" defaultValue={String(listing.bailen_lot_listing_reservation_fee)} />
                    <Input label="Downpayment %" type="number" defaultValue="30" />
                    <Input label="Monthly Amortization" type="number" defaultValue={String(listing.bailen_lot_listing_payment_terms?.monthly_amortization ?? 0)} />
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    <InfoCard label="TCP" value={formatMoney(listing.bailen_lot_listing_total_contract_price)} />
                    <InfoCard label="Balance" value={formatMoney(listing.bailen_lot_listing_payment_terms?.balance ?? listing.bailen_lot_listing_total_contract_price)} />
                    <InfoCard label="Commission Status" value={listing.bailen_lot_listing_commission_snapshot?.commission_status ?? "not_ready"} />
                  </div>

                  <div className="mt-5 flex justify-end">
                    <button
                      type="button"
                      onClick={handleSaveTerms}
                      className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
                    >
                      <FiSave className="h-4 w-4" />
                      Save Terms
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === "documents" && (
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-3">
                  <h4 className="font-bold text-slate-950">Document Checklist</h4>
                  <p className="text-sm text-slate-500">
                    Document requirements can be inherited from Bailen project defaults.
                  </p>
                </div>

                <div className="divide-y divide-slate-100">
                  {(listing.bailen_lot_listing_documents.length
                    ? listing.bailen_lot_listing_documents
                    : [
                        {
                          document_id: 0,
                          document_name: "CLIENT REGISTRATION FORM",
                          document_description: "Required before validation",
                          document_is_reusable: 1,
                          document_status: "active",
                          document_is_required: 1,
                          document_created_at: "",
                          document_updated_at: "",
                        },
                        {
                          document_id: 1,
                          document_name: "OFFER TO BUY & BUYER'S PROFILE",
                          document_description: "Required for reservation",
                          document_is_reusable: 1,
                          document_status: "active",
                          document_is_required: 1,
                          document_created_at: "",
                          document_updated_at: "",
                        },
                      ]).map((document) => (
                    <div
                      key={document.document_id}
                      className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-bold text-slate-950">
                          {document.document_name}
                        </p>
                        <p className="text-sm text-slate-500">
                          {document.document_description || "No description"}
                        </p>
                      </div>

                      <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                        Missing
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

type InfoRowProps = {
  label: string;
  value: string;
};

const InfoRow = ({ label, value }: InfoRowProps) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-2 font-bold text-slate-950">{value}</p>
  </div>
);

type InfoCardProps = {
  label: string;
  value: string;
};

const InfoCard = ({ label, value }: InfoCardProps) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-2 text-lg font-bold capitalize text-slate-950">{value}</p>
  </div>
);

type InputProps = {
  label: string;
  type?: string;
  defaultValue?: string;
};

const Input = ({ label, type = "text", defaultValue = "" }: InputProps) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <input
      type={type}
      defaultValue={defaultValue}
      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

export default ListingDetailsModal;
