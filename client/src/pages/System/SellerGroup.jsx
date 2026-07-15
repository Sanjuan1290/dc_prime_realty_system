import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import { FaUserPlus } from "react-icons/fa";
import { FiEdit2, FiEye, FiPlus, FiRefreshCw, FiSearch, FiTrash2 } from "react-icons/fi";
import NewGroupModal from "../../components/System/sellerGroupComponents/NewGroupModal";
import EditGroupModal from "../../components/System/sellerGroupComponents/EditGroupModal";
import DetailsModal from "../../components/System/sellerGroupComponents/DetailsModal";
import { useFetch, useFetchPatch } from "../../utils/useFetch";

const ProjectRatesCell = ({ rates = [] }) => {
  if (!rates.length) return <p className="text-xs font-semibold text-slate-500">No project rates</p>;

  return (
    <div className="flex flex-wrap gap-1.5">
      {rates.map((rate) => (
        <span key={rate.lot_project_id} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
          {rate.lot_project_location_code || rate.lot_project_name}: {Number(rate.seller_group_pool_rate || 0).toFixed(2)}%
        </span>
      ))}
    </div>
  );
};

const SellerGroup = () => {
  const location = useLocation();
  const usersPath = location.pathname.startsWith("/admin/") ? "/admin/users" : "/super_admin/users";
  const queryClient = useQueryClient();
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [alert, setAlert] = useState(null);
  const [togglingGroupId, setTogglingGroupId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryString = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  }).toString();

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ["seller-groups", queryString],
    queryFn: () => useFetch(`/seller-groups?${queryString}`),
    keepPreviousData: true,
  });

  const sellerGroups = data?.data || [];
  const pagination = data?.pagination || { page, limit, total: 0, totalPages: 1, hasNext: false, hasPrev: false };
  const meta = data?.meta || { active: 0, inactive: 0, totalMembers: 0, averagePool: 0 };

  const toggleMutation = useMutation({
    mutationFn: (group) => useFetchPatch(`/seller-groups/toggle-status/${group.seller_group_id}`),
    onMutate: (group) => {
      setTogglingGroupId(group.seller_group_id);
      setAlert({
        type: "loading",
        message: `${group.seller_group_status === "active" ? "Deactivating" : "Activating"} seller group...`,
      });
    },
    onSuccess: (result) => {
      setAlert({ type: "success", message: result.message || "Seller group status updated." });
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
      queryClient.invalidateQueries({ queryKey: ["seller-group-options"] });
    },
    onError: (mutationError) => setAlert({ type: "error", message: mutationError.message }),
    onSettled: () => setTogglingGroupId(null),
  });

  const handleToggleStatus = (group) => {
    const action = group.seller_group_status === "active" ? "deactivate" : "activate";
    const confirmed = window.confirm(`Are you sure you want to ${action} "${group.seller_group_name}"?`);
    if (!confirmed) return;
    toggleMutation.mutate(group);
  };

  const openDetailsModal = (group) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  const openEditModal = (group) => {
    setSelectedGroup(group);
    setShowEditGroupModal(true);
  };

  const handleSaved = (message) => {
    setAlert({ type: "success", message });
    queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
    queryClient.invalidateQueries({ queryKey: ["seller-group-options"] });
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["accredited"] });
  };

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader title="Seller Groups" description="Manage seller groups, hierarchy, pool rates, and member commission rates." icon={FaUserPlus} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <NavLink to={usersPath} className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Back to Users</NavLink>
          <button type="button" onClick={() => setShowNewGroupModal(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"><FiPlus className="h-4 w-4" />New Group</button>
        </div>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === "loading" ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading seller groups..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing seller groups..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || "Failed to load seller groups."} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Groups</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{pagination.total}</h3><p className="mt-2 text-sm text-slate-500">All seller groups</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Active Groups</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.active}</h3><p className="mt-2 text-sm text-slate-500">Available for assignment</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Total Members</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.totalMembers}</h3><p className="mt-2 text-sm text-slate-500">Members across groups</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-sm font-semibold text-slate-500">Avg. Pool Rate</p><h3 className="mt-2 text-3xl font-bold text-slate-950">{Number(meta.averagePool || 0).toFixed(1)}%</h3><p className="mt-2 text-sm text-slate-500">All active project rates</p></div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-lg font-bold text-slate-950">Seller Group Records</h2><p className="text-sm text-slate-500">View pool rates, group heads, member count, and group status.</p></div>
          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="text" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search seller groups..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
            <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="all">All Status</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
            <button type="button" onClick={() => queryClient.invalidateQueries({ queryKey: ["seller-groups"] })} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"><FiRefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Refresh</button>
          </div>
        </div>

        <div className="overflow-x-auto"><div className="min-w-[1100px]">
          <div className="grid grid-cols-[1.35fr_1.1fr_0.8fr_2fr_0.8fr_1fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><p>Group</p><p>Head</p><p>Members</p><p>Project Pool Rates</p><p>Status</p><p className="text-right">Actions</p></div>
          <div className="divide-y divide-slate-100">
            {isLoading ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading seller groups...</div> : sellerGroups.length === 0 ? <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No seller groups found.</div> : sellerGroups.map((group) => (
              <div key={group.seller_group_id} className="grid grid-cols-[1.35fr_1.1fr_0.8fr_2fr_0.8fr_1fr] items-center px-4 py-4 text-sm">
                <div><p className="font-bold text-slate-950">{group.seller_group_name}</p><p className="text-xs text-slate-500">{group.seller_group_description || "No description"}</p></div>
                <p className="font-semibold text-slate-700">{group.group_head_name || "No head"}</p>
                <p className="font-bold text-slate-950">{group.member_count} <span className="text-xs font-semibold text-slate-500">({group.active_member_count} active)</span></p>
                <ProjectRatesCell rates={group.project_rates} />
                <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${group.seller_group_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{group.seller_group_status}</span>
                <div className="flex justify-end gap-2"><button type="button" onClick={() => openDetailsModal(group)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><FiEye className="h-3.5 w-3.5" />Details</button><button type="button" onClick={() => openEditModal(group)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-bold text-blue-700 hover:bg-blue-100"><FiEdit2 className="h-3.5 w-3.5" />Edit</button><button type="button" onClick={() => handleToggleStatus(group)} disabled={toggleMutation.isPending && togglingGroupId === group.seller_group_id} className="inline-flex h-9 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"><FiTrash2 className="h-3.5 w-3.5" />{toggleMutation.isPending && togglingGroupId === group.seller_group_id ? "Updating..." : group.seller_group_status === "active" ? "Deactivate" : "Activate"}</button></div>
              </div>
            ))}
          </div>
        </div></div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between"><p className="text-sm font-semibold text-slate-500">Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} records</p><div className="flex items-center gap-2"><select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700"><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option></select><button disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Prev</button><button disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button></div></div>
      </section>

      {showNewGroupModal && <NewGroupModal setShowNewGroupModal={setShowNewGroupModal} onSaved={handleSaved} />}
      {showEditGroupModal && selectedGroup && <EditGroupModal setShowEditGroupModal={setShowEditGroupModal} selectedGroup={selectedGroup} onSaved={handleSaved} />}
      {showDetailsModal && selectedGroup && <DetailsModal setShowDetailsModal={setShowDetailsModal} setShowEditGroupModal={setShowEditGroupModal} selectedGroup={selectedGroup} onSaved={handleSaved} />}
    </main>
  );
};

export default SellerGroup;

