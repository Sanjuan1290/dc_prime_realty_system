import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/Shared/PageHeader";
import { FaUserPlus } from "react-icons/fa";
import { FiEye, FiRefreshCw, FiSearch, FiUsers } from "react-icons/fi";
import { formatDateTime } from "../../utils/formatDateTime";

type SellerRole =
  | "broker_network_manager"
  | "broker"
  | "manager"
  | "agent";

type SellerStatus = "active" | "inactive";

type AccreditedSeller = {
  accredited_seller_id: number;
  user_id: number;
  full_name: string;
  email: string;
  contact_no: string | null;
  role: SellerRole;
  reports_under_user_id: number | null;
  reports_under_name: string | null;
  seller_group_id: number | null;
  seller_group_name: string | null;
  seller_group_pool_rate_bailen: number | null;
  seller_group_pool_rate_maragondon: number | null;
  seller_group_pool_rate_general_trias: number | null;
  accredited_seller_assigned_rate_bailen: number;
  accredited_seller_assigned_rate_maragondon: number;
  accredited_seller_assigned_rate_general_trias: number;
  accredited_seller_accreditation_date: string | null;
  accredited_seller_status: SellerStatus;
  accredited_seller_updated_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type Summary = {
  total: number;
  active: number;
  inactive: number;
  roleBreakdown: Record<SellerRole, number>;
};

type AlertState = {
  type: "warning" | "error";
  message: string;
} | null;

const API_URL = import.meta.env.VITE_API_URL || "";

const defaultPagination: Pagination = {
  page: 1,
  limit: 10,
  total: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: false,
};

const defaultSummary: Summary = {
  total: 0,
  active: 0,
  inactive: 0,
  roleBreakdown: {
    broker_network_manager: 0,
    broker: 0,
    manager: 0,
    agent: 0,
  },
};

const roleLabels: Record<SellerRole, string> = {
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong.";
};

const Accredited = () => {
  const [sellers, setSellers] = useState<AccreditedSeller[]>([]);
  const [summary, setSummary] = useState<Summary>(defaultSummary);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<SellerRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<SellerStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search.trim()) params.set("search", search.trim());
    if (roleFilter !== "all") params.set("role", roleFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    return params.toString();
  }, [limit, page, roleFilter, search, statusFilter]);

  const fetchSellers = async () => {
    setIsLoading(true);
    setAlert(null);

    try {
      const res = await fetch(`${API_URL}/accredited?${queryString}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load accredited sellers.");

      setSellers(data.data || []);
      setSummary(data.summary || defaultSummary);
      setPagination(data.pagination || defaultPagination);

      if (data.status === "warning") {
        setAlert({ type: "warning", message: data.message });
      }
    } catch (error) {
      setSellers([]);
      setAlert({ type: "error", message: getErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, [queryString]);

  const roleBreakdown = [
    {
      label: "BNM",
      value: summary.roleBreakdown.broker_network_manager,
      description: "Broker Network Manager",
    },
    {
      label: "Brokers",
      value: summary.roleBreakdown.broker,
      description: "Broker group leaders",
    },
    {
      label: "Managers",
      value: summary.roleBreakdown.manager,
      description: "Unit managers",
    },
    {
      label: "Agents",
      value: summary.roleBreakdown.agent,
      description: "Frontline sellers",
    },
  ];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title="Accredited Sellers"
        description="Read-only seller directory. Rates are managed by Seller Groups in User Management."
        icon={FaUserPlus}
      />

      {alert && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            alert.type === "warning"
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {alert.message}
        </div>
      )}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.5fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">Total Sellers</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.total}</h3>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FiUsers className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">All accredited seller records</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">Active</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.active}</h3>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FiUsers className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">Can be assigned to clients</p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">Inactive</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.inactive}</h3>
              </div>
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FiUsers className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-3 text-sm text-slate-500">Hidden from active assignment</p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-600">Role Breakdown</p>
              <p className="mt-1 text-sm text-slate-500">Count per commission hierarchy level.</p>
            </div>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
              {summary.total} total
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roleBreakdown.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">{item.value}</h4>
                <p className="mt-2 text-xs text-slate-500">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px_auto]">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              type="text"
              placeholder="Search sellers, users, roles, reports under, or group..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as SellerRole | "all");
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All roles</option>
            {Object.entries(roleLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as SellerStatus | "all");
              setPage(1);
            }}
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="all">All statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <button
            type="button"
            onClick={fetchSellers}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            <FiRefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[1600px]">
              <div className="grid grid-cols-[1.25fr_1.1fr_1.15fr_1.35fr_1.9fr_0.8fr_0.75fr_0.6fr_0.7fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
                <p>Seller</p>
                <p>Contact</p>
                <p>Role</p>
                <p>Reports Under</p>
                <p>Seller Group / Commission Setup</p>
                <p>Accreditation</p>
                <p>Rate Warning</p>
                <p>Status</p>
                <p className="text-right">Actions</p>
              </div>

              <div className="divide-y divide-slate-100">
                {isLoading ? (
                  <div className="px-4 py-12 text-center text-sm font-semibold text-slate-500">
                    Loading accredited sellers...
                  </div>
                ) : sellers.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <p className="font-bold text-slate-700">No accredited sellers found.</p>
                    <p className="mt-1 text-sm text-slate-500">Try changing your search or filters.</p>
                  </div>
                ) : (
                  sellers.map((seller) => {
                    const bailenPool = Number(seller.seller_group_pool_rate_bailen || 0);
                    const maragondonPool = Number(seller.seller_group_pool_rate_maragondon || 0);
                    const gentriPool = Number(seller.seller_group_pool_rate_general_trias || 0);
                    const hasWarning =
                      Number(seller.accredited_seller_assigned_rate_bailen) > bailenPool ||
                      Number(seller.accredited_seller_assigned_rate_maragondon) > maragondonPool ||
                      Number(seller.accredited_seller_assigned_rate_general_trias) > gentriPool;

                    return (
                      <div
                        key={seller.accredited_seller_id}
                        className="grid grid-cols-[1.25fr_1.1fr_1.15fr_1.35fr_1.9fr_0.8fr_0.75fr_0.6fr_0.7fr] items-center px-4 py-5 text-sm transition hover:bg-slate-50"
                      >
                        <div>
                          <p className="font-bold uppercase text-slate-950">{seller.full_name}</p>
                          <p className="mt-1 text-xs text-slate-500">User: {seller.full_name}</p>
                        </div>

                        <div>
                          <p className="font-medium text-slate-700">{seller.email}</p>
                          <p className="text-xs text-slate-500">{seller.contact_no || "No contact no."}</p>
                        </div>

                        <p className="font-medium text-slate-700">{roleLabels[seller.role]}</p>

                        <div>
                          <p className="font-medium text-slate-700">{seller.reports_under_name || "None"}</p>
                          <p className="mt-1 text-xs text-slate-500">Managed through User Management</p>
                        </div>

                        <div>
                          <p className="text-sm text-slate-700">
                            Group: <span className="font-bold text-slate-950">{seller.seller_group_name || "No group"}</span>
                          </p>
                          <p className="text-sm text-slate-700">
                            Bailen Pool/Rate: <span className="font-bold text-slate-950">{bailenPool}% / {seller.accredited_seller_assigned_rate_bailen}%</span>
                          </p>
                          <p className="text-sm text-slate-700">
                            Maragondon Pool/Rate: <span className="font-bold text-slate-950">{maragondonPool}% / {seller.accredited_seller_assigned_rate_maragondon}%</span>
                          </p>
                          <p className="text-sm text-slate-700">
                            Gentri Pool/Rate: <span className="font-bold text-slate-950">{gentriPool}% / {seller.accredited_seller_assigned_rate_general_trias}%</span>
                          </p>
                          <p className="mt-1 text-xs text-slate-400">Updated {seller.accredited_seller_updated_at}</p>
                        </div>

                        <p className="font-medium text-slate-700">
                          {formatDateTime(seller.accredited_seller_accreditation_date || '') || "-"}
                        </p>

                        <span
                          className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                            hasWarning
                              ? "border-amber-200 bg-amber-50 text-amber-700"
                              : "border-emerald-200 bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {hasWarning ? "Check rate" : "OK"}
                        </span>

                        <div>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                              seller.accredited_seller_status === "active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current" />
                            {seller.accredited_seller_status}
                          </span>
                        </div>

                        <div className="flex justify-end">
                          <button
                            type="button"
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                          >
                            <FiEye className="h-3.5 w-3.5" />
                            Details
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Showing {sellers.length ? (pagination.page - 1) * pagination.limit + 1 : 0}-
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} records
            </p>

            <div className="flex items-center gap-2">
              <select
                value={limit}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>

              <button
                type="button"
                disabled={!pagination.hasPrev}
                onClick={() => setPage((currentPage) => Math.max(currentPage - 1, 1))}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Previous
              </button>

              <span className="h-9 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700">
                Page {pagination.page} of {pagination.totalPages}
              </span>

              <button
                type="button"
                disabled={!pagination.hasNext}
                onClick={() => setPage((currentPage) => currentPage + 1)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Accredited;
