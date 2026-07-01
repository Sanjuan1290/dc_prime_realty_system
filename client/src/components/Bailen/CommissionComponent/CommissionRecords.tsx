import { useMemo, useState } from "react";
import { FiEye, FiSearch } from "react-icons/fi";
import type { Commission, CommissionStatus } from "../../../types/commission";

type Props = {
  commissions: Commission[];
  onOpenDetails: (commission: Commission) => void;
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const getStatusClass = (status: CommissionStatus) => {
  if (status === "released") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "eligible" || status === "partially_released") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "blocked") return "border-red-200 bg-red-50 text-red-700";
  return "border-amber-200 bg-amber-50 text-amber-700";
};

const CommissionRecords = ({ commissions, onOpenDetails }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | CommissionStatus>("all");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filteredCommissions = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return commissions.filter((commission) => {
      const matchesSearch =
        !keyword ||
        commission.client_name.toLowerCase().includes(keyword) ||
        commission.unit_code.toLowerCase().includes(keyword) ||
        commission.seller_name.toLowerCase().includes(keyword) ||
        commission.seller_group_name.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" || commission.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [commissions, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCommissions.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedCommissions = filteredCommissions.slice(pageStart, pageStart + pageSize);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Commission Records</h2>
          <p className="text-sm text-slate-500">
            Release status, deductions, seller chain, and milestone progress.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_190px]">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search unit, seller, client, group"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | CommissionStatus);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="eligible">Eligible</option>
            <option value="partially_released">Partially Released</option>
            <option value="released">Released</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1500px]">
          <div className="grid grid-cols-[0.8fr_1.1fr_1.2fr_1.4fr_0.8fr_1fr_1fr_1fr_1fr_0.8fr_0.9fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <p>Unit</p>
            <p>Client</p>
            <p>Seller</p>
            <p>Group</p>
            <p>Rate</p>
            <p>Gross</p>
            <p>Eligible</p>
            <p>Released</p>
            <p>Net</p>
            <p>Status</p>
            <p className="text-right">Action</p>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedCommissions.map((commission) => (
              <div
                key={commission.commission_id}
                className="grid grid-cols-[0.8fr_1.1fr_1.2fr_1.4fr_0.8fr_1fr_1fr_1fr_1fr_0.8fr_0.9fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
              >
                <p className="font-bold text-slate-950">{commission.unit_code}</p>
                <p className="font-semibold text-slate-700">{commission.client_name}</p>
                <div>
                  <p className="font-bold text-slate-950">{commission.seller_name}</p>
                  <p className="text-xs text-slate-500">{commission.seller_role}</p>
                </div>
                <p className="font-semibold text-slate-700">{commission.seller_group_name}</p>
                <p className="font-bold text-blue-700">{commission.seller_rate}%</p>
                <p className="font-bold text-slate-950">{formatMoney(commission.gross_commission)}</p>
                <p className="font-bold text-blue-700">{formatMoney(commission.eligible_amount)}</p>
                <p className="font-semibold text-slate-700">{formatMoney(commission.released_amount)}</p>
                <p className="font-bold text-slate-950">{formatMoney(commission.net_remaining)}</p>

                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${getStatusClass(
                      commission.status
                    )}`}
                  >
                    {commission.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => onOpenDetails(commission)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <FiEye className="h-3.5 w-3.5" />
                    Details
                  </button>
                </div>
              </div>
            ))}

            {paginatedCommissions.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="font-bold text-slate-700">No commission records found.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing your search or filters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Showing {paginatedCommissions.length ? pageStart + 1 : 0}-
          {Math.min(pageStart + pageSize, filteredCommissions.length)} of{" "}
          {filteredCommissions.length} records
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={safePage === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Previous
          </button>

          <span className="h-9 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
            Page {safePage} of {totalPages}
          </span>

          <button
            type="button"
            disabled={safePage === totalPages}
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
};

export default CommissionRecords;
