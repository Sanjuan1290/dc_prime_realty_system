import { useMemo, useState } from "react";
import { FiAlertCircle, FiDollarSign } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import CommissionDetailsModal from "../../components/Bailen/CommissionComponent/CommissionDetailsModal";
import CommissionRecords from "../../components/Bailen/CommissionComponent/CommissionRecords";
import type { Commission as CommissionType } from "../../types/commission";
import { sampleBailenCommissions } from "./bailenSampleData";

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const Commission = () => {
  const [selectedCommission, setSelectedCommission] =
    useState<CommissionType | null>(null);

  const overview = useMemo(
    () => [
      {
        label: "Total Commission",
        value: formatMoney(
          sampleBailenCommissions.reduce(
            (total, commission) => total + commission.gross_commission,
            0
          )
        ),
        helper: "Gross generated from sold listings",
      },
      {
        label: "Eligible",
        value: formatMoney(
          sampleBailenCommissions.reduce(
            (total, commission) => total + commission.eligible_amount,
            0
          )
        ),
        helper: "Available based on milestone progress",
      },
      {
        label: "Released",
        value: formatMoney(
          sampleBailenCommissions.reduce(
            (total, commission) => total + commission.released_amount,
            0
          )
        ),
        helper: "Already released",
      },
      {
        label: "Net Remaining",
        value: formatMoney(
          sampleBailenCommissions.reduce(
            (total, commission) => total + commission.net_remaining,
            0
          )
        ),
        helper: "After deductions",
      },
    ],
    []
  );

  return (
    <main className="flex flex-col gap-6">
      {selectedCommission && (
        <CommissionDetailsModal
          commission={selectedCommission}
          onClose={() => setSelectedCommission(null)}
        />
      )}

      <PageHeader
        title="Bailen Commissions"
        description="Monitor seller commissions from listing reservations, payments, milestones, and cash advance deductions."
        icon={FiDollarSign}
      />

      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
          <div>
            <p className="font-bold text-amber-900">Release rule reminder</p>
            <p className="mt-1 text-sm leading-6 text-amber-700">
              Releases should follow 20% → 40% → 60% → 75% → retention and must respect allowed release days.
              Commission values should use the listing snapshot to avoid changing old transactions when rates change later.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {overview.map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <p className="text-sm font-bold text-slate-500">{item.label}</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">
              {item.value}
            </p>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {item.helper}
            </p>
          </div>
        ))}
      </section>

      <CommissionRecords
        commissions={sampleBailenCommissions}
        onOpenDetails={setSelectedCommission}
      />
    </main>
  );
};

export default Commission;
