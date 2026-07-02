import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import { FaUserPlus } from "react-icons/fa";
import { FiRefreshCw, FiSearch, FiUsers } from "react-icons/fi";
import { formatDateTime } from "../../utils/formatDateTime";
import { useFetch } from "../../utils/useFetch";

const roleLabels = {
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const Accredited = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryString = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(roleFilter !== "all" ? { role: roleFilter } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  }).toString();

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["accredited", queryString],
    queryFn: () => useFetch(`/accredited?${queryString}`),
    keepPreviousData: true,
  });

  const sellers = data?.data || [];
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
  const summary = data?.summary || {
    total: 0,
    active: 0,
    inactive: 0,
    roleBreakdown: { broker_network_manager: 0, broker: 0, manager: 0, agent: 0 },
  };

  const roleBreakdown = [
    { label: "BNM", value: summary.roleBreakdown.broker_network_manager, description: "Broker Network Manager" },
    { label: "Brokers", value: summary.roleBreakdown.broker, description: "Broker group leaders" },
    { label: "Managers", value: summary.roleBreakdown.manager, description: "Unit managers" },
    { label: "Agents", value: summary.roleBreakdown.agent, description: "Frontline sellers" },
  ];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader title="Accredited Sellers" description="Read-only seller directory. Rates are managed by Seller Groups in User Management." icon={FaUserPlus} />

      {isLoading ? <StatusAlert type="loading" message="Loading accredited sellers..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing accredited sellers..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || "Failed to load accredited sellers."} /> : null}

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.5fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Total Sellers</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.total}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiUsers className="h-5 w-5" /></span></div><p className="mt-3 text-sm text-slate-500">All accredited seller records</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Active</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.active}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><FiUsers className="h-5 w-5" /></span></div><p className="mt-3 text-sm text-slate-500">Can be assigned to clients</p></div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-slate-500">Inactive</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{summary.inactive}</h3></div><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600"><FiUsers className="h-5 w-5" /></span></div><p className="mt-3 text-sm text-slate-500">Currently restricted</p></div>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {roleBreakdown.map((item) => <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-bold text-slate-500">{item.label}</p><h3 className="mt-2 text-2xl font-bold text-slate-950">{item.value}</h3><p className="mt-3 text-sm text-slate-500">{item.description}</p></div>)}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-lg font-bold text-slate-950">Seller Directory</h2><p className="text-sm text-slate-500">View reporting chain, group assignment, and project rates.</p></div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search sellers..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            <select value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Roles</option>{Object.entries(roleLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["accredited"] })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>

        <div className="overflow-x-auto"><div className="min-w-[1350px]">
          <div className="grid grid-cols-[1.35fr_0.95fr_1.1fr_1.1fr_0.8fr_0.95fr_0.8fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><p>Seller</p><p>Role</p><p>Group</p><p>Reports Under</p><p>Bailen</p><p>Maragondon</p><p>Gentri</p><p>Status / Updated</p></div>
          <div className="divide-y divide-slate-100">
            {isLoading ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading accredited sellers...</div> : sellers.length === 0 ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No accredited sellers found.</div> : sellers.map((seller) => (
              <div key={seller.accredited_seller_id} className="grid grid-cols-[1.35fr_0.95fr_1.1fr_1.1fr_0.8fr_0.95fr_0.8fr_0.9fr] items-center px-4 py-4 text-sm">
                <div><p className="font-bold text-slate-950">{seller.full_name}</p><p className="text-xs text-slate-500">{seller.email} • {seller.contact_no || "No contact"}</p></div>
                <p className="font-semibold text-slate-700">{roleLabels[seller.role] || seller.role}</p>
                <p className="font-semibold text-slate-700">{seller.seller_group_name || "No group"}</p>
                <p className="text-slate-600">{seller.reports_under_name || "Direct to Developer"}</p>
                <p className="font-bold text-blue-700">{Number(seller.accredited_seller_assigned_rate_bailen).toFixed(2)}%</p>
                <p className="font-bold text-slate-700">{Number(seller.accredited_seller_assigned_rate_maragondon).toFixed(2)}%</p>
                <p className="font-bold text-slate-700">{Number(seller.accredited_seller_assigned_rate_general_trias).toFixed(2)}%</p>
                <div><span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${seller.accredited_seller_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{seller.accredited_seller_status}</span><p className="mt-1 text-xs text-slate-500">{seller.accredited_seller_updated_at ? formatDateTime(seller.accredited_seller_updated_at) : "—"}</p></div>
              </div>
            ))}
          </div>
        </div></div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm font-semibold text-slate-500">Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} records</p><div className="flex items-center gap-2"><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
      </section>
    </main>
  );
};

export default Accredited;

