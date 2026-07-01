import { useState } from "react";
import { FiAlertCircle, FiDollarSign } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import CommissionDetailsModal from "../../components/Bailen/CommissionComponent/CommissionDetailsModal";
import CommissionRecords from "../../components/Bailen/CommissionComponent/CommissionRecords";
import type { Commission } from "../../types/commission";

const commissions: Commission[] = [
  {
    commission_id: 1,
    listing_id: 2,
    unit_code: "LA-0204",
    client_name: "Robert San Juan",
    seller_name: "CANTIGA, ROLINDA C.",
    seller_role: "Agent",
    seller_group_id: 2,
    seller_group_name: "SARTE, JOHN CHRISTOPHER GROUP",
    tcp: 560000,
    pool_rate: 12,
    seller_rate: 1,
    gross_commission: 5600,
    eligible_amount: 1120,
    released_amount: 0,
    cash_advance_deduction: 0,
    net_remaining: 5600,
    next_release_stage: "20%",
    next_release_date: "2026-07-22",
    status: "eligible",
  },
  {
    commission_id: 2,
    listing_id: 3,
    unit_code: "LA-0205",
    client_name: "Juan Dela Cruz",
    seller_name: "PARROCHO, JOSEPH E.",
    seller_role: "Manager",
    seller_group_id: 2,
    seller_group_name: "SARTE, JOHN CHRISTOPHER GROUP",
    tcp: 610500,
    pool_rate: 12,
    seller_rate: 3,
    gross_commission: 18315,
    eligible_amount: 7326,
    released_amount: 3663,
    cash_advance_deduction: 1000,
    net_remaining: 13652,
    next_release_stage: "40%",
    next_release_date: "2026-07-22",
    status: "partially_released",
  },
  {
    commission_id: 3,
    listing_id: 5,
    unit_code: "LA-0207",
    client_name: "Maria Santos",
    seller_name: "REYES, MARIA L.",
    seller_role: "Broker",
    seller_group_id: 2,
    seller_group_name: "SARTE, JOHN CHRISTOPHER GROUP",
    tcp: 530000,
    pool_rate: 12,
    seller_rate: 8,
    gross_commission: 42400,
    eligible_amount: 0,
    released_amount: 0,
    cash_advance_deduction: 0,
    net_remaining: 42400,
    next_release_stage: "20%",
    next_release_date: "2026-07-22",
    status: "pending",
  },
];

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const Commission = () => {
  const [selectedCommission, setSelectedCommission] = useState<Commission | null>(null);

  const grossTotal = commissions.reduce(
    (total, commission) => total + commission.gross_commission,
    0
  );

  const eligibleTotal = commissions.reduce(
    (total, commission) => total + commission.eligible_amount,
    0
  );

  const releasedTotal = commissions.reduce(
    (total, commission) => total + commission.released_amount,
    0
  );

  const netTotal = commissions.reduce(
    (total, commission) => total + commission.net_remaining,
    0
  );

  const cards = [
    {
      label: "Gross Commission",
      value: formatMoney(grossTotal),
      description: "Total generated commission",
    },
    {
      label: "Eligible Release",
      value: formatMoney(eligibleTotal),
      description: "Ready based on payment progress",
    },
    {
      label: "Released",
      value: formatMoney(releasedTotal),
      description: "Already released amount",
    },
    {
      label: "Net Remaining",
      value: formatMoney(netTotal),
      description: "After cash advance deductions",
    },
  ];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Bailen Commissions"
        description="Monitor seller chain, milestone releases, retention, and cash advance deductions."
        icon={FiDollarSign}
      />

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

      <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="font-bold text-blue-800">
              Release schedule: 20% → 40% → 60% → 75% → Retention.
            </p>
            <p className="mt-1 text-sm text-blue-700">
              Release button should still show a warning if today is not a configured release date.
            </p>
          </div>
        </div>
      </div>

      <CommissionRecords
        commissions={commissions}
        onOpenDetails={(commission) => setSelectedCommission(commission)}
      />

      {selectedCommission && (
        <CommissionDetailsModal
          commission={selectedCommission}
          onClose={() => setSelectedCommission(null)}
        />
      )}
    </main>
  );
};

export default Commission;
