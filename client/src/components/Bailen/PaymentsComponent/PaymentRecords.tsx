import { useMemo, useState } from "react";
import { FiEye, FiSearch } from "react-icons/fi";
import type { BailenPaymentRecord, PaymentStatus } from "../../../types/payment";

type Props = {
  payments: BailenPaymentRecord[];
};

const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);

const getStatusClass = (status: PaymentStatus) => {
  if (status === "verified") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "pending") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-red-200 bg-red-50 text-red-700";
};

const PaymentRecords = ({ payments }: Props) => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [page, setPage] = useState(1);
  const pageSize = 5;

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return payments.filter((payment) => {
      const matchesSearch =
        !keyword ||
        payment.client_name.toLowerCase().includes(keyword) ||
        payment.unit_code.toLowerCase().includes(keyword) ||
        payment.reference_id.toLowerCase().includes(keyword) ||
        payment.payment_type.toLowerCase().includes(keyword);

      const matchesStatus =
        statusFilter === "all" || payment.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [payments, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const paginatedPayments = filteredPayments.slice(pageStart, pageStart + pageSize);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Payment Records</h2>
          <p className="text-sm text-slate-500">
            Track reservation, downpayment, monthly amortization, and verification.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_180px]">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search client, unit, reference"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
            />
          </label>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as "all" | PaymentStatus);
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold capitalize text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[1300px]">
          <div className="grid grid-cols-[1.2fr_0.8fr_1fr_0.9fr_0.9fr_1fr_1fr_0.8fr_0.8fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
            <p>Client</p>
            <p>Unit</p>
            <p>Amount</p>
            <p>Type</p>
            <p>Method</p>
            <p>Reference ID</p>
            <p>Payment Date</p>
            <p>Status</p>
            <p className="text-right">Action</p>
          </div>

          <div className="divide-y divide-slate-100">
            {paginatedPayments.map((payment) => (
              <div
                key={payment.payment_id}
                className="grid grid-cols-[1.2fr_0.8fr_1fr_0.9fr_0.9fr_1fr_1fr_0.8fr_0.8fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
              >
                <div>
                  <p className="font-bold text-slate-950">{payment.client_name}</p>
                  <p className="text-xs text-slate-500">
                    Verified by {payment.verified_by ?? "Waiting"}
                  </p>
                </div>

                <p className="font-bold text-slate-700">{payment.unit_code}</p>
                <p className="font-bold text-blue-700">{formatMoney(payment.amount)}</p>
                <p className="font-semibold capitalize text-slate-700">
                  {payment.payment_type.replaceAll("_", " ")}
                </p>
                <p className="font-semibold capitalize text-slate-700">
                  {payment.payment_method.replaceAll("_", " ")}
                </p>
                <p className="font-mono text-xs font-bold text-slate-700">
                  {payment.reference_id}
                </p>
                <p className="font-semibold text-slate-700">
                  {payment.payment_date}
                </p>

                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${getStatusClass(
                      payment.status
                    )}`}
                  >
                    {payment.status}
                  </span>
                </div>

                <div className="flex justify-end">
                  <button
                    type="button"
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  >
                    <FiEye className="h-3.5 w-3.5" />
                    SOA
                  </button>
                </div>
              </div>
            ))}

            {paginatedPayments.length === 0 && (
              <div className="px-4 py-12 text-center">
                <p className="font-bold text-slate-700">No payment records found.</p>
                <p className="mt-1 text-sm text-slate-500">
                  Try changing your filters.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Showing {paginatedPayments.length ? pageStart + 1 : 0}-
          {Math.min(pageStart + pageSize, filteredPayments.length)} of{" "}
          {filteredPayments.length} records
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

export default PaymentRecords;
