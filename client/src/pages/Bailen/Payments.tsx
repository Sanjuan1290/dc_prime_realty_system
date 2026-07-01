import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertCircle, FiCreditCard, FiEye, FiSearch } from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import type { PaymentStatus } from "../../types/payment";
import { sampleBailenPayments } from "./bailenSampleData";

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

const Payments = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PaymentStatus>("all");
  const [page, setPage] = useState(1);

  const pageSize = 5;

  const filteredPayments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return sampleBailenPayments.filter((payment) => {
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
  }, [search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const paginatedPayments = filteredPayments.slice(
    startIndex,
    startIndex + pageSize
  );

  const totalVerified = sampleBailenPayments
    .filter((payment) => payment.status === "verified")
    .reduce((total, payment) => total + payment.amount, 0);

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Bailen Payments Audit / Logs"
        description="Read-only payment audit trail. Add and manage payments from each listing page."
        icon={FiCreditCard}
      />

      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex gap-3">
          <FiAlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          <div>
            <p className="font-bold text-blue-900">Payments are now listing-based</p>
            <p className="mt-1 text-sm leading-6 text-blue-700">
              To add reservation, downpayment, monthly amortization, advance payment, or balloon payment,
              open the specific listing and use the Payments & SOA tab.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="Total Logs" value={String(sampleBailenPayments.length)} helper="All payment records" />
        <SummaryCard label="Verified Amount" value={formatMoney(totalVerified)} helper="Verified payments only" />
        <SummaryCard label="Pending" value={String(sampleBailenPayments.filter((payment) => payment.status === "pending").length)} helper="Waiting verification" />
        <SummaryCard label="Special Payments" value={String(sampleBailenPayments.filter((payment) => ["advance_payment", "balloon_payment"].includes(payment.payment_type)).length)} helper="Advance / Balloon logs" />
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Payment Logs</h2>
            <p className="text-sm text-slate-500">
              Search by client, unit, reference, or payment type.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search payment logs"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as "all" | PaymentStatus);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Status</option>
              <option value="verified">Verified</option>
              <option value="pending">Pending</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1200px]">
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_0.9fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Client / Unit</p>
              <p>Type</p>
              <p>Amount</p>
              <p>Method</p>
              <p>Reference</p>
              <p>Status</p>
              <p className="text-right">Action</p>
            </div>

            <div className="divide-y divide-slate-100">
              {paginatedPayments.map((payment) => (
                <div
                  key={payment.payment_id}
                  className="grid grid-cols-[1fr_1fr_1fr_1fr_1fr_1fr_0.9fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-bold text-slate-950">{payment.client_name}</p>
                    <p className="text-xs text-slate-500">{payment.unit_code}</p>
                  </div>

                  <p className="font-semibold capitalize text-slate-700">
                    {payment.payment_type.replaceAll("_", " ")}
                  </p>

                  <p className="font-bold text-slate-950">
                    {formatMoney(payment.amount)}
                  </p>

                  <p className="capitalize text-slate-700">
                    {payment.payment_method.replaceAll("_", " ")}
                  </p>

                  <div>
                    <p className="font-semibold text-slate-700">{payment.reference_id}</p>
                    <p className="text-xs text-slate-500">{payment.payment_date}</p>
                  </div>

                  <div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${getStatusClass(payment.status)}`}>
                      {payment.status}
                    </span>
                  </div>

                  <div className="flex justify-end">
                    <Link
                      to={`/bailenProject/listings/${payment.listing_id}`}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      View Listing
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing {filteredPayments.length === 0 ? 0 : startIndex + 1}-
            {Math.min(startIndex + pageSize, filteredPayments.length)} of{" "}
            {filteredPayments.length} logs
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((prevPage) => Math.max(1, prevPage - 1))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Previous
            </button>

            <span className="h-9 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
              Page {safePage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((prevPage) => Math.min(totalPages, prevPage + 1))}
              className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              Next
            </button>
          </div>
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
    <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
    <p className="mt-2 text-xs text-slate-500">{helper}</p>
  </div>
);

export default Payments;
