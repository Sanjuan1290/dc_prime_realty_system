import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import {
  FiAlertCircle,
  FiArrowLeft,
  FiCheckCircle,
  FiCreditCard,
  FiDownload,
  FiFileText,
  FiHome,
  FiPlus,
  FiPrinter,
  FiSave,
  FiUpload,
  FiUser,
} from "react-icons/fi";
import AddPaymentModal from "../../components/Bailen/PaymentsComponent/AddPaymentModal";
import type {
  BailenBuyerType,
  BailenListingStatus,
  BailenPaymentMode,
  BailenListingClientProfile,
  BailenListingDocument,
} from "../../types/listing";
import type { BailenSOARow } from "../../types/payment";
import {
  sampleBailenListings,
  sampleBailenPayments,
  sampleBailenSOA,
} from "./bailenSampleData";

type TabKey = "unit" | "client" | "payments" | "documents" | "printouts";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const tabs: { key: TabKey; label: string; icon: typeof FiHome }[] = [
  { key: "unit", label: "Unit & Status", icon: FiHome },
  { key: "client", label: "Client Profile", icon: FiUser },
  { key: "payments", label: "Payments & SOA", icon: FiCreditCard },
  { key: "documents", label: "Documents", icon: FiFileText },
  { key: "printouts", label: "Printouts", icon: FiPrinter },
];

const statusOptions: BailenListingStatus[] = [
  "available",
  "hold",
  "reserved",
  "sold",
  "pending for cancellation",
  "cancelled",
];

const ListingDetails = () => {
  const { listingId } = useParams();
  const [activeTab, setActiveTab] = useState<TabKey>("unit");
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  const listing = useMemo(
    () =>
      sampleBailenListings.find(
        (item) => String(item.bailen_lot_listing_id) === String(listingId)
      ) ?? sampleBailenListings[0],
    [listingId]
  );

  const [listingStatus, setListingStatus] = useState<BailenListingStatus>(
    listing.bailen_lot_listing_status
  );
  const [buyerType, setBuyerType] = useState<BailenBuyerType>(
    listing.bailen_lot_listing_client_profile?.buyer_type ?? "single"
  );
  const [paymentMode, setPaymentMode] = useState<BailenPaymentMode>(
    listing.bailen_lot_listing_payment_terms?.payment_mode ?? "installment"
  );

  const profile = listing.bailen_lot_listing_client_profile;
  const terms = listing.bailen_lot_listing_payment_terms;
  const listingPayments = sampleBailenPayments.filter(
    (payment) => payment.listing_id === listing.bailen_lot_listing_id
  );
  const listingSOA = sampleBailenSOA.filter(
    (row) => row.listing_id === listing.bailen_lot_listing_id
  );

  const isSold = listingStatus === "sold";
  const documentsEnabled = isSold;

  const paidAmount = listingPayments
    .filter((payment) => payment.status === "verified")
    .reduce((total, payment) => total + payment.amount, 0);

  const balance =
    listing.bailen_lot_listing_total_contract_price - paidAmount;

  const handleSave = (section: string) => {
    alert(`Design only: ${section} changes will be saved once connected to backend.`);
  };

  return (
    <main className="flex flex-col gap-6">
      {showAddPaymentModal && (
        <AddPaymentModal onClose={() => setShowAddPaymentModal(false)} />
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <Link
            to="/bailenProject/listings"
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-800"
          >
            <FiArrowLeft className="h-4 w-4" />
            Back to Listings
          </Link>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <h1 className="text-3xl font-bold text-slate-950">
                {listing.bailen_lot_listing_unit_code}
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Full listing workspace for unit details, client profile, payments, documents, and printouts.
              </p>
            </div>

            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold capitalize text-blue-700">
              {listingStatus}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => handleSave("Listing")}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <FiSave className="h-4 w-4" />
            Save Changes
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <FiPrinter className="h-4 w-4" />
            Print
          </button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          label="TCP"
          value={formatMoney(listing.bailen_lot_listing_total_contract_price)}
          helper="Total contract price"
        />
        <SummaryCard
          label="Paid"
          value={formatMoney(paidAmount)}
          helper="Verified payments only"
        />
        <SummaryCard
          label="Balance"
          value={formatMoney(balance)}
          helper="Current running balance"
        />
        <SummaryCard
          label="Cadastral"
          value={listing.bailen_lot_listing_cadastral_lot_numbers.join(", ")}
          helper="Linked cadastral lot numbers"
        />
      </section>

      {listingStatus === "hold" && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex gap-3">
            <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-bold text-amber-900">This unit is on hold</p>
              <p className="mt-1 text-sm text-amber-700">
                The unit is blocked from active selling. Update the status to available, reserved, or sold once the hold is cleared.
              </p>
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto border-b border-slate-200">
          <div className="flex min-w-max gap-2 p-3">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;

              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`inline-flex h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition ${
                    isActive
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          {activeTab === "unit" && (
            <UnitTab
              listingStatus={listingStatus}
              setListingStatus={setListingStatus}
              onSave={() => handleSave("Unit and status")}
              listingUnitCode={listing.bailen_lot_listing_unit_code}
              lotType={listing.bailen_lot_listing_lot_type}
              cadastralNumbers={listing.bailen_lot_listing_cadastral_lot_numbers}
              area={listing.bailen_lot_listing_lot_area_sqm}
              pricePerSqm={listing.bailen_lot_listing_price_sqm}
              netSellingPrice={listing.bailen_lot_listing_net_selling_price}
              legalMiscRate={listing.bailen_lot_listing_legal_misc_rate}
              legalMiscFee={listing.bailen_lot_listing_legal_misc_fee}
              tcp={listing.bailen_lot_listing_total_contract_price}
              reservationFee={listing.bailen_lot_listing_reservation_fee}
              interestRate={listing.bailen_lot_listing_annual_interest_rate}
            />
          )}

          {activeTab === "client" && (
            <ClientTab
              buyerType={buyerType}
              setBuyerType={setBuyerType}
              profile={profile}
              onSave={() => handleSave("Client profile")}
            />
          )}

          {activeTab === "payments" && (
            <PaymentsTab
              paymentMode={paymentMode}
              setPaymentMode={setPaymentMode}
              onOpenAddPayment={() => setShowAddPaymentModal(true)}
              payments={listingPayments}
              soaRows={listingSOA}
              onSave={() => handleSave("Payments and SOA")}
            />
          )}

          {activeTab === "documents" && (
            <DocumentsTab
              isEnabled={documentsEnabled}
              status={listingStatus}
              documents={listing.bailen_lot_listing_documents}
              onSave={() => handleSave("Documents")}
            />
          )}

          {activeTab === "printouts" && (
            <PrintoutsTab
              hasProfile={Boolean(profile)}
              hasTerms={Boolean(terms)}
              onPrint={() => window.print()}
            />
          )}
        </div>
      </section>
    </main>
  );
};

type SummaryCardProps = {
  label: string;
  value: string;
  helper: string;
};

const SummaryCard = ({ label, value, helper }: SummaryCardProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <p className="text-sm font-bold text-slate-500">{label}</p>
    <p className="mt-2 text-xl font-bold text-slate-950">{value}</p>
    <p className="mt-2 text-xs text-slate-500">{helper}</p>
  </div>
);

type UnitTabProps = {
  listingStatus: BailenListingStatus;
  setListingStatus: (value: BailenListingStatus) => void;
  onSave: () => void;
  listingUnitCode: string;
  lotType: string;
  cadastralNumbers: string[];
  area: number;
  pricePerSqm: number;
  netSellingPrice: number;
  legalMiscRate: number;
  legalMiscFee: number;
  tcp: number;
  reservationFee: number;
  interestRate: number;
};

const UnitTab = ({
  listingStatus,
  setListingStatus,
  onSave,
  listingUnitCode,
  lotType,
  cadastralNumbers,
  area,
  pricePerSqm,
  netSellingPrice,
  legalMiscRate,
  legalMiscFee,
  tcp,
  reservationFee,
  interestRate,
}: UnitTabProps) => (
  <div className="grid gap-5">
    <SectionHeader
      title="Unit Details & Status"
      description="Edit unit inventory information and status. Hold is handled here."
      actionLabel="Save Unit"
      onAction={onSave}
    />

    <div className="grid gap-4 lg:grid-cols-3">
      <Input label="Unit Code" defaultValue={listingUnitCode} />
      <Input label="Lot Type" defaultValue={lotType} />
      <Input label="Cadastral Lot Numbers" defaultValue={cadastralNumbers.join(", ")} />
      <Input label="Area SQM" type="number" defaultValue={String(area)} />
      <Input label="Price Per SQM" type="number" defaultValue={String(pricePerSqm)} />
      <label className="flex flex-col gap-2">
        <span className="text-sm font-bold text-slate-700">Listing Status</span>
        <select
          value={listingStatus}
          onChange={(event) => setListingStatus(event.target.value as BailenListingStatus)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm capitalize outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
        >
          {statusOptions.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>
    </div>

    <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
      <h4 className="font-bold text-blue-900">Price Breakdown Snapshot</h4>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <MiniCard label="Net Selling Price" value={formatMoney(netSellingPrice)} />
        <MiniCard label="LMF Rate" value={`${legalMiscRate}%`} />
        <MiniCard label="LMF Amount" value={formatMoney(legalMiscFee)} />
        <MiniCard label="TCP" value={formatMoney(tcp)} />
        <MiniCard label="Reservation" value={formatMoney(reservationFee)} />
      </div>
      <p className="mt-3 text-sm font-semibold text-blue-700">
        Annual Interest Rate: {interestRate}%
      </p>
    </div>
  </div>
);

type ClientTabProps = {
  buyerType: BailenBuyerType;
  setBuyerType: (value: BailenBuyerType) => void;
  profile: BailenListingClientProfile | null;
  onSave: () => void;
};

const ClientTab = ({ buyerType, setBuyerType, profile, onSave }: ClientTabProps) => {
  const primary = profile?.primary_buyer;

  return (
    <div className="grid gap-5">
      <SectionHeader
        title="Client Profile"
        description="Complete this for SOA and Offer to Buy printing. This profile is saved per listing."
        actionLabel="Save Profile"
        onAction={onSave}
      />

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-sm font-semibold leading-6 text-amber-800">
            If the same buyer purchases three units, encode or copy their profile into each listing so each SOA and Offer to Buy has its own unit snapshot.
          </p>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h4 className="font-bold text-slate-950">Buyer Setup</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-bold text-slate-700">Buyer Type</span>
            <select
              value={buyerType}
              onChange={(event) => setBuyerType(event.target.value as BailenBuyerType)}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="single">Single Buyer</option>
              <option value="spouses">Spouses</option>
              <option value="and_account">AND Account / Co-Buyer</option>
            </select>
          </label>
          <Input label="Emergency Contact Name" defaultValue={profile?.emergency_contact_name ?? ""} />
          <Input label="Emergency Contact No." defaultValue={profile?.emergency_contact_no ?? ""} />
        </div>
      </section>

      <ProfileSection title="Primary Buyer">
        <Input label="Full Name" defaultValue={primary?.full_name ?? ""} />
        <Input label="Email" defaultValue={primary?.email ?? ""} />
        <Input label="Mobile No." defaultValue={primary?.contact_no ?? ""} />
        <Input label="Residence Contact No." defaultValue={primary?.residence_contact_no ?? ""} />
        <Input label="Birth Date" type="date" defaultValue={primary?.birth_date ?? ""} />
        <Input label="Place of Birth" defaultValue={primary?.place_of_birth ?? ""} />
        <Input label="Citizenship" defaultValue={primary?.citizenship ?? "Filipino"} />
        <Input label="Gender" defaultValue={primary?.gender ?? ""} />
        <Input label="Civil Status" defaultValue={primary?.civil_status ?? ""} />
        <Input label="TIN" defaultValue={primary?.tin ?? ""} />
        <Input label="Valid ID Type" defaultValue={primary?.valid_id_type ?? ""} />
        <Input label="Valid ID No." defaultValue={primary?.valid_id_no ?? ""} />
        <Input label="Present Address" defaultValue={primary?.present_address ?? ""} />
        <Input label="Present ZIP Code" defaultValue={primary?.present_zip_code ?? ""} />
        <Input label="Permanent Address" defaultValue={primary?.permanent_address ?? ""} />
        <Input label="Permanent ZIP Code" defaultValue={primary?.permanent_zip_code ?? ""} />
        <Input label="Employment Status" defaultValue={primary?.employment_status ?? ""} />
        <Input label="Employer / Business Name" defaultValue={primary?.employer_or_business_name ?? ""} />
        <Input label="Position / Business Type" defaultValue={primary?.position_or_business_type ?? ""} />
        <Input label="Work / Business Address" defaultValue={primary?.work_address ?? ""} />
        <Input label="Monthly Income" type="number" defaultValue={String(primary?.monthly_income ?? "")} />
        <Input label="Source of Funds" defaultValue={primary?.source_of_funds ?? ""} />
      </ProfileSection>

      {(buyerType === "spouses" || buyerType === "and_account") && (
        <ProfileSection title={buyerType === "spouses" ? "Spouse Information" : "Co-Buyer Information"}>
          <Input label="Full Name" defaultValue={profile?.second_buyer?.full_name ?? ""} />
          <Input label="Email" defaultValue={profile?.second_buyer?.email ?? ""} />
          <Input label="Mobile No." defaultValue={profile?.second_buyer?.contact_no ?? ""} />
          <Input label="Birth Date" type="date" defaultValue={profile?.second_buyer?.birth_date ?? ""} />
          <Input label="Citizenship" defaultValue={profile?.second_buyer?.citizenship ?? "Filipino"} />
          <Input label="TIN" defaultValue={profile?.second_buyer?.tin ?? ""} />
          <Input label="Employer / Business Name" defaultValue={profile?.second_buyer?.employer_or_business_name ?? ""} />
          <Input label="Position / Business Type" defaultValue={profile?.second_buyer?.position_or_business_type ?? ""} />
          <Input label="Monthly Income" type="number" defaultValue={String(profile?.second_buyer?.monthly_income ?? "")} />
        </ProfileSection>
      )}
    </div>
  );
};

type PaymentsTabProps = {
  paymentMode: BailenPaymentMode;
  setPaymentMode: (value: BailenPaymentMode) => void;
  onOpenAddPayment: () => void;
  payments: typeof sampleBailenPayments;
  soaRows: BailenSOARow[];
  onSave: () => void;
};

const PaymentsTab = ({
  paymentMode,
  setPaymentMode,
  onOpenAddPayment,
  payments,
  soaRows,
  onSave,
}: PaymentsTabProps) => (
  <div className="grid gap-5">
    <SectionHeader
      title="Payments & SOA"
      description="Payments are now encoded inside the listing. Bailen Payments page is only audit/logs."
      actionLabel="Save Terms"
      onAction={onSave}
    />

    <div className="grid gap-4 md:grid-cols-4">
      <label className="flex flex-col gap-2">
        <span className="text-sm font-bold text-slate-700">Payment Mode</span>
        <select
          value={paymentMode}
          onChange={(event) => setPaymentMode(event.target.value as BailenPaymentMode)}
          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
        >
          <option value="cash">Cash</option>
          <option value="installment">Installment</option>
        </select>
      </label>
      <Input label="Term Months" type="number" defaultValue="36" />
      <Input label="First Due Date" type="date" defaultValue="2026-07-22" />
      <Input label="Due Day" type="number" defaultValue="22" />
      <Input label="Downpayment %" type="number" defaultValue="30" />
      <Input label="Downpayment Months" type="number" defaultValue="3" />
      <Input label="Monthly Amortization" type="number" defaultValue="35900" />
      <Input label="Balloon Payment" type="number" defaultValue="0" />
    </div>

    <div className="flex justify-end">
      <button
        type="button"
        onClick={onOpenAddPayment}
        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
      >
        <FiPlus className="h-4 w-4" />
        Add Listing Payment
      </button>
    </div>

    <DataTable
      title="Payment Records"
      headers={["Date", "Type", "Amount", "Method", "Reference", "Status"]}
      rows={payments.map((payment) => [
        payment.payment_date,
        payment.payment_type.replaceAll("_", " "),
        formatMoney(payment.amount),
        payment.payment_method.replaceAll("_", " "),
        payment.reference_id,
        payment.status,
      ])}
    />

    <DataTable
      title="Statement of Account"
      headers={["Due Date", "Description", "Due", "Paid", "Reference", "Status", "Ending Balance"]}
      rows={soaRows.map((row) => [
        row.due_date,
        row.description,
        formatMoney(row.due_amount),
        formatMoney(row.amount_paid),
        row.reference_id ?? "-",
        row.status,
        formatMoney(row.ending_balance),
      ])}
    />
  </div>
);

type DocumentsTabProps = {
  isEnabled: boolean;
  status: BailenListingStatus;
  documents: BailenListingDocument[];
  onSave: () => void;
};

const DocumentsTab = ({ isEnabled, status, documents, onSave }: DocumentsTabProps) => (
  <div className="grid gap-5">
    <SectionHeader
      title="Document Uploads"
      description="Document uploading is enabled only after the listing is sold."
      actionLabel="Save Documents"
      onAction={onSave}
    />

    {!isEnabled && (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <p className="text-sm font-semibold text-amber-800">
            Current status is "{status}". Upload controls are disabled until the listing status is sold.
          </p>
        </div>
      </div>
    )}

    <div className="grid gap-3">
      {documents.map((document) => (
        <div
          key={document.document_id}
          className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_160px_180px]"
        >
          <div>
            <p className="font-bold text-slate-950">{document.document_name}</p>
            <p className="mt-1 text-sm text-slate-500">
              {document.document_description || "No description"}
            </p>
            <p className="mt-2 text-xs font-semibold text-slate-400">
              {document.uploaded_file_name || "No file uploaded"}
            </p>
          </div>

          <span className="h-fit rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-center text-xs font-bold capitalize text-slate-600">
            {document.upload_status.replaceAll("_", " ")}
          </span>

          <button
            type="button"
            disabled={!isEnabled}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            <FiUpload className="h-4 w-4" />
            Upload
          </button>
        </div>
      ))}
    </div>
  </div>
);

type PrintoutsTabProps = {
  hasProfile: boolean;
  hasTerms: boolean;
  onPrint: () => void;
};

const PrintoutsTab = ({ hasProfile, hasTerms, onPrint }: PrintoutsTabProps) => (
  <div className="grid gap-5">
    <SectionHeader
      title="Printouts"
      description="Prepared placeholders for SOA and Offer to Buy printing."
      actionLabel="Print Current"
      onAction={onPrint}
    />

    <div className="grid gap-4 md:grid-cols-2">
      <PrintCard
        title="Offer to Buy & Buyer's Profile"
        description="Uses client profile, unit snapshot, cadastral number, TCP, reservation fee, and seller details."
        disabled={!hasProfile}
      />
      <PrintCard
        title="Statement of Account"
        description="Uses payment terms, verified payments, penalties, advance payments, offset payments, and balloon payment."
        disabled={!hasTerms}
      />
    </div>
  </div>
);

type SectionHeaderProps = {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
};

const SectionHeader = ({
  title,
  description,
  actionLabel,
  onAction,
}: SectionHeaderProps) => (
  <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-center md:justify-between">
    <div>
      <h3 className="text-xl font-bold text-slate-950">{title}</h3>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>

    <button
      type="button"
      onClick={onAction}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
    >
      <FiSave className="h-4 w-4" />
      {actionLabel}
    </button>
  </div>
);

type ProfileSectionProps = {
  title: string;
  children: ReactNode;
};

const ProfileSection = ({ title, children }: ProfileSectionProps) => (
  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
    <h4 className="font-bold text-slate-950">{title}</h4>
    <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
  </section>
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
      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

type MiniCardProps = {
  label: string;
  value: string;
};

const MiniCard = ({ label, value }: MiniCardProps) => (
  <div className="rounded-xl border border-blue-100 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
      {label}
    </p>
    <p className="mt-2 text-lg font-bold text-slate-950">{value}</p>
  </div>
);

type DataTableProps = {
  title: string;
  headers: string[];
  rows: string[][];
};

const DataTable = ({ title, headers, rows }: DataTableProps) => (
  <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
    <div className="border-b border-slate-200 px-4 py-3">
      <h4 className="font-bold text-slate-950">{title}</h4>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="bg-slate-50 text-xs font-bold uppercase text-slate-500">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-4 py-3">
                {header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.join("-")} className="hover:bg-slate-50">
              {row.map((cell) => (
                <td key={cell} className="px-4 py-3 font-medium text-slate-700">
                  {cell}
                </td>
              ))}
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td className="px-4 py-6 text-center text-slate-500" colSpan={headers.length}>
                No records yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  </section>
);

type PrintCardProps = {
  title: string;
  description: string;
  disabled: boolean;
};

const PrintCard = ({ title, description, disabled }: PrintCardProps) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h4 className="font-bold text-slate-950">{title}</h4>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>

      {disabled ? (
        <FiAlertCircle className="h-5 w-5 shrink-0 text-amber-600" />
      ) : (
        <FiCheckCircle className="h-5 w-5 shrink-0 text-emerald-600" />
      )}
    </div>

    <button
      type="button"
      disabled={disabled}
      className="mt-5 inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    >
      <FiDownload className="h-4 w-4" />
      {disabled ? "Complete requirements first" : "Generate / Print"}
    </button>
  </div>
);

export default ListingDetails;
