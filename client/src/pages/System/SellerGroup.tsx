import { useEffect, useMemo, useState } from "react";
import PageHeader from "../../components/Shared/PageHeader";
import { FaUserPlus } from "react-icons/fa";
import {
  FiEdit2,
  FiEye,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { NavLink } from "react-router-dom";
import NewGroupModal from "../../components/System/SellerGroupComponent/NewGroupModal";
import EditGroupModal from "../../components/System/SellerGroupComponent/EditGroupModal";
import DetailsModal from "../../components/System/SellerGroupComponent/DetailsModal";

type SellerGroupStatus = "active" | "inactive";

type SellerGroupRecord = {
  seller_group_id: number;
  seller_group_name: string;
  seller_group_head_user_id: number | null;
  group_head_name: string | null;
  seller_group_description: string | null;
  seller_group_pool_rate_bailen: number;
  seller_group_pool_rate_maragondon: number;
  seller_group_pool_rate_general_trias: number;
  member_count: number;
  active_member_count: number;
  seller_group_status: SellerGroupStatus;
  seller_group_created_at: string;
  seller_group_updated_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

type Meta = {
  active: number;
  inactive: number;
  totalMembers: number;
  averageBailenPool: number;
};

type AlertState = {
  type: "success" | "warning" | "error";
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

const defaultMeta: Meta = {
  active: 0,
  inactive: 0,
  totalMembers: 0,
  averageBailenPool: 0,
};

const getErrorMessage = (error: unknown) => {
  return error instanceof Error ? error.message : "Something went wrong.";
};

const SellerGroup = () => {
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SellerGroupRecord | null>(null);

  const [sellerGroups, setSellerGroups] = useState<SellerGroupRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>(defaultPagination);
  const [meta, setMeta] = useState<Meta>(defaultMeta);
  const [isLoading, setIsLoading] = useState(false);
  const [alert, setAlert] = useState<AlertState>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<SellerGroupStatus | "all">("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(limit));
    if (search.trim()) params.set("search", search.trim());
    if (statusFilter !== "all") params.set("status", statusFilter);
    return params.toString();
  }, [limit, page, search, statusFilter]);

  const fetchSellerGroups = async () => {
    setIsLoading(true);
    setAlert(null);

    try {
      const res = await fetch(`${API_URL}/seller-groups?${queryString}`, {
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load seller groups.");

      setSellerGroups(data.data || []);
      setPagination(data.pagination || defaultPagination);
      setMeta(data.meta || defaultMeta);

      if (data.status === "warning") {
        setAlert({ type: "warning", message: data.message });
      }
    } catch (error) {
      setSellerGroups([]);
      setAlert({ type: "error", message: getErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellerGroups();
  }, [queryString]);

  const openDetailsModal = (group: SellerGroupRecord) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  const openEditModal = (group: SellerGroupRecord) => {
    setSelectedGroup(group);
    setShowEditGroupModal(true);
  };

  const handleSaved = (message: string) => {
    setAlert({ type: "success", message });
    fetchSellerGroups();
  };

  const deactivateGroup = async (group: SellerGroupRecord) => {
    const nextStatus = group.seller_group_status === "active" ? "inactive" : "active";

    if (
      !window.confirm(
        nextStatus === "inactive"
          ? `Deactivate ${group.seller_group_name}? Active sellers assigned to this group may be hidden from assignment.`
          : `Activate ${group.seller_group_name}?`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/seller-groups/status/${group.seller_group_id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update group status.");

      setAlert({ type: "success", message: data.message });
      fetchSellerGroups();
    } catch (error) {
      setAlert({ type: "error", message: getErrorMessage(error) });
    }
  };

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Seller Groups"
          description="Manage seller groups, hierarchy, pool rates, and member commission rates."
          icon={FaUserPlus}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <NavLink
            to="/super_admin/users"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            Back to Users
          </NavLink>

          <button
            type="button"
            onClick={() => setShowNewGroupModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FiPlus className="h-4 w-4" />
            New Group
          </button>
        </div>
      </div>

      {alert && (
        <div
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${
            alert.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : alert.type === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {alert.message}
        </div>
      )}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Groups</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">{pagination.total}</h3>
          <p className="mt-2 text-sm text-slate-500">All seller groups</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Active Groups</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.active}</h3>
          <p className="mt-2 text-sm text-slate-500">Available for assignment</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Members</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">{meta.totalMembers}</h3>
          <p className="mt-2 text-sm text-slate-500">Members across groups</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Avg. Bailen Pool</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">
            {Number(meta.averageBailenPool || 0).toFixed(1)}%
          </h3>
          <p className="mt-2 text-sm text-slate-500">Current group average</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Seller Group Records</h2>
            <p className="text-sm text-slate-500">
              View pool rates, group heads, member count, and group status.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search group or head"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
              />
            </label>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value as SellerGroupStatus | "all");
                setPage(1);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            <button
              type="button"
              onClick={fetchSellerGroups}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_1fr_0.8fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Group</p>
              <p>Group Head</p>
              <p>Bailen Pool</p>
              <p>Maragondon</p>
              <p>General Trias</p>
              <p>Members</p>
              <p>Status</p>
              <p className="text-right">Action</p>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  Loading seller groups...
                </div>
              ) : sellerGroups.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="font-bold text-slate-700">No seller groups found.</p>
                  <p className="text-sm text-slate-500">Try changing your search or filters.</p>
                </div>
              ) : (
                sellerGroups.map((group) => (
                  <div
                    key={group.seller_group_id}
                    className="grid grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_1fr_0.8fr_1fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-bold text-slate-950">{group.seller_group_name}</p>
                      <p className="text-sm text-slate-500">
                        {group.seller_group_description || "No description"}
                      </p>
                    </div>

                    <p className="font-semibold text-slate-700">
                      {group.group_head_name || "No head assigned"}
                    </p>

                    <p className="font-bold text-blue-700">
                      {Number(group.seller_group_pool_rate_bailen).toFixed(2)}%
                    </p>
                    <p className="font-bold text-slate-700">
                      {Number(group.seller_group_pool_rate_maragondon).toFixed(2)}%
                    </p>
                    <p className="font-bold text-slate-700">
                      {Number(group.seller_group_pool_rate_general_trias).toFixed(2)}%
                    </p>

                    <div>
                      <p className="font-bold text-slate-950">{group.member_count}</p>
                      <p className="text-xs text-slate-500">{group.active_member_count} active</p>
                    </div>

                    <div>
                      <span
                        className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                          group.seller_group_status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {group.seller_group_status}
                      </span>
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openDetailsModal(group)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FiEye className="h-3.5 w-3.5" />
                        View
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditModal(group)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => deactivateGroup(group)}
                        className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition hover:bg-red-50"
                      >
                        <FiTrash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing {sellerGroups.length ? (pagination.page - 1) * pagination.limit + 1 : 0}-
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
      </section>

      {showNewGroupModal && (
        <NewGroupModal setShowNewGroupModal={setShowNewGroupModal} onSaved={handleSaved} />
      )}

      {showEditGroupModal && selectedGroup && (
        <EditGroupModal
          setShowEditGroupModal={setShowEditGroupModal}
          selectedGroup={selectedGroup}
          onSaved={handleSaved}
        />
      )}

      {showDetailsModal && selectedGroup && (
        <DetailsModal
          setShowDetailsModal={setShowDetailsModal}
          setShowEditGroupModal={setShowEditGroupModal}
          selectedGroup={selectedGroup}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
};

export default SellerGroup;
