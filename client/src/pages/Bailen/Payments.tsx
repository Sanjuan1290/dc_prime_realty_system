import { useState } from "react";
import { FiAlertCircle, FiCreditCard, FiPlus } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import AddPaymentModal from "../../components/Bailen/PaymentsComponent/AddPaymentModal";
import PaymentRecords from "../../components/Bailen/PaymentsComponent/PaymentRecords";
import type { BailenPaymentRecord } from "../../types/payment";

const payments: BailenPaymentRecord[] = [
  {
    payment_id: 1,
    listing_id: 2,
    client_name: "Robert San Juan",
    unit_code: "LA-0204",
    project_name: "Bailen",
    amount: 50000,
    payment_type: "reservation",
    payment_method: "cash",
    reference_id: "CASH-20260701-LA0204-0001",
    payment_date: "2026-07-01",
    verified_by: "Super Admin",
    verified_date: "2026-07-01",
    status: "verified",
    remarks: "Reservation fee paid.",
  },
  {
    payment_id: 2,
    listing_id: 3,
    client_name: "Juan Dela Cruz",
    unit_code: "LA-0205",
    project_name: "Bailen",
    amount: 97733.33,
    payment_type: "downpayment",
    payment_method: "bank_transfer",
    reference_id: "BDO-874612",
    payment_date: "2026-07-02",
    verified_by: null,
    verified_date: null,
    status: "pending",
    remarks: "For verification.",
  },
  {
    payment_id: 3,
    listing_id: 5,
    client_name: "Maria Santos",
    unit_code: "LA-0207",
    project_name: "Bailen",
    amount: 35900,
    payment_type: "monthly_amortization",
    payment_method: "online",
    reference_id: "GCASH-770011",
    payment_date: "2026-07-05",
    verified_by: "Admin",
    verified_date: "2026-07-05",
    status: "verified",
    remarks: null,
  },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const Payments = () => {
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);

  const verifiedTotal = payments
    .filter((payment) => payment.status === "verified")
    .reduce((total, payment) => total + payment.amount, 0);

  const pendingTotal = payments
    .filter((payment) => payment.status === "pending")
    .reduce((total, payment) => total + payment.amount, 0);

  const cards = [
    {
      label: "Verified Collections",
      value: formatMoney(verifiedTotal),
      description: "Confirmed payment records",
    },
    {
      label: "Pending Verification",
      value: formatMoney(pendingTotal),
      description: "Needs admin checking",
    },
    {
      label: "Due This Month",
      value: formatMoney(214466.66),
      description: "Upcoming SOA dues",
    },
    {
      label: "Overdue Accounts",
      value: "1",
      description: "Needs follow-up warning",
    },
  ];

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Bailen Payments"
          description="Track verified payments, pending collections, SOA status, and references."
          icon={FiCreditCard}
        />

        <button
          type="button"
          onClick={() => setShowAddPaymentModal(true)}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-fit"
        >
          <FiPlus className="h-4 w-4" />
          Add Payment
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-bold text-slate-500">{card.label}</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-950">
              {card.value}
            </h3>
            <p className="mt-2 text-sm text-slate-500">{card.description}</p>
          </div>
        ))}
      </section>

      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold text-amber-800">
              Cash payments should auto-generate reference IDs.
            </p>
            <p className="mt-1 text-sm text-amber-700">
              Bank and online payments require manual reference IDs. Verified date and payment date should remain separate.
            </p>
          </div>
        </div>
      </div>

      <PaymentRecords payments={payments} />

      {showAddPaymentModal && (
        <AddPaymentModal onClose={() => setShowAddPaymentModal(false)} />
      )}
    </main>
  );
};

export default Payments;
