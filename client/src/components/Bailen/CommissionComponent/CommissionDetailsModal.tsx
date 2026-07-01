import { FiAlertCircle, FiCheckCircle, FiX } from "react-icons/fi";
import type { Commission } from "../../../types/commission";

type Props = {
  commission: Commission;
  onClose: () => void;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const milestones = ["20%", "40%", "60%", "75%", "Retention"];

const CommissionDetailsModal = ({ commission, onClose }: Props) => {
  const releaseAllowedToday = false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Commission Details
            </h3>
            <p className="text-sm text-slate-500">
              {commission.unit_code} • {commission.seller_name}
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

        <div className="grid gap-5 overflow-y-auto px-6 py-5">
          {!releaseAllowedToday && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex gap-3">
                <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                <div>
                  <p className="font-bold text-amber-800">
                    Release date warning
                  </p>
                  <p className="mt-1 text-sm text-amber-700">
                    Commission releases are allowed only on configured release days, for example 7th and 22nd.
                  </p>
                </div>
              </div>
            </div>
          )}

          <section className="grid gap-4 md:grid-cols-4">
            <InfoCard label="Gross Commission" value={formatMoney(commission.gross_commission)} />
            <InfoCard label="Eligible" value={formatMoney(commission.eligible_amount)} />
            <InfoCard label="Released" value={formatMoney(commission.released_amount)} />
            <InfoCard label="Net Remaining" value={formatMoney(commission.net_remaining)} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-4 py-3">
              <h4 className="font-bold text-slate-950">Release Milestones</h4>
              <p className="text-sm text-slate-500">
                Main and override seller commissions follow the same release schedule.
              </p>
            </div>

            <div className="grid gap-3 p-4 md:grid-cols-5">
              {milestones.map((milestone, index) => {
                const isDone = index < 2;

                return (
                  <div
                    key={milestone}
                    className={[
                      "rounded-2xl border p-4",
                      isDone
                        ? "border-emerald-200 bg-emerald-50"
                        : "border-slate-200 bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-700">
                        {milestone}
                      </p>
                      {isDone && <FiCheckCircle className="h-5 w-5 text-emerald-700" />}
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {isDone ? "Released" : "Pending"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h4 className="font-bold text-slate-950">Seller Chain</h4>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoCard label="Seller" value={commission.seller_name} />
              <InfoCard label="Role" value={commission.seller_role} />
              <InfoCard label="Group" value={commission.seller_group_name} />
            </div>
          </section>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => alert("Design only: release action will validate release date and eligible amount.")}
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Release Commission
          </button>
        </div>
      </div>
    </div>
  );
};

type InfoCardProps = {
  label: string;
  value: string;
};

const InfoCard = ({ label, value }: InfoCardProps) => (
  <div className="rounded-xl border border-slate-200 bg-white p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
      {label}
    </p>
    <p className="mt-2 font-bold text-slate-950">{value}</p>
  </div>
);

export default CommissionDetailsModal;
