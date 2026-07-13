import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import useCurrentUser from "../../utils/useCurrentUser";
import { FaUserPlus } from "react-icons/fa";
import {
  FiAlertTriangle,
  FiEdit2,
  FiKey,
  FiPlus,
  FiRefreshCw,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import CreateUserModal from "../../components/System/userComponents/CreateUserModal";
import EditUserModal from "../../components/System/userComponents/EditUserModal";
import { formatDateTime } from "../../utils/formatDateTime";
import { useFetch, useFetchPatch } from "../../utils/useFetch";
import { ADMIN_MANAGEABLE_USER_ROLES, PERMISSIONS, canManageUserRole, hasPermission } from "../../config/permissions";

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};


const ResetPasswordConfirmModal = ({ user, onClose, onConfirm, isSaving }) => {
  if (!user) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-3xl border border-amber-100 bg-white shadow-2xl">
        <div className="flex items-start gap-3 border-b border-amber-100 bg-amber-50 px-6 py-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white text-amber-700 shadow-sm">
            <FiAlertTriangle className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <h2 className="text-xl font-black text-amber-950">Reset Password?</h2>
            <p className="mt-1 text-sm font-semibold leading-6 text-amber-800">
              This will set the temporary password to <span className="font-black">password</span> and force the user to open /change-password on next login.
            </p>
          </div>
        </div>

        <div className="p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase tracking-wide text-slate-400">User</p>
            <p className="mt-1 font-black text-slate-950">{user.full_name}</p>
            <p className="text-sm font-semibold text-slate-500">{user.email}</p>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="h-11 rounded-2xl border border-slate-200 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-amber-600 px-5 text-sm font-black text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiKey className="h-4 w-4" />
              {isSaving ? 'Resetting...' : 'Yes, Reset Password'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

const Users = () => {
  const { data: currentUserData } = useCurrentUser();
  const actorRole = currentUserData?.user?.role || "";
  const canCreateUsers = hasPermission(actorRole, PERMISSIONS.SYSTEM_USERS_CREATE);
  const canEditUsers = hasPermission(actorRole, PERMISSIONS.SYSTEM_USERS_EDIT);
  const canResetPasswords = hasPermission(actorRole, PERMISSIONS.SYSTEM_USERS_RESET_PASSWORD);
  const canChangeStatus = hasPermission(actorRole, PERMISSIONS.SYSTEM_USERS_CHANGE_STATUS);
  const canManageSellerGroups = actorRole === "super_admin";
  const allowedRoles = actorRole === "admin"
    ? ADMIN_MANAGEABLE_USER_ROLES
    : Object.keys(roleLabels);
  const canManageAccount = (user) => canManageUserRole(actorRole, user?.role);
  const queryClient = useQueryClient();
  const [showEditUser, setShowEditUser] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [alert, setAlert] = useState(null);
  const [activeAction, setActiveAction] = useState(null);

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
    queryKey: ["users", queryString],
    queryFn: () => useFetch(`/user/getUsers?${queryString}`),
    keepPreviousData: true,
  });

  const users = data?.data || [];
  const summary = data?.summary || {
    total: 0,
    active: 0,
    inactive: 0,
    mustChangePassword: 0,
  };
  const pagination = data?.pagination || {
    page,
    limit,
    total: 0,
    totalPages: 1,
    hasNext: false,
    hasPrev: false,
  };

  const toggleStatusMutation = useMutation({
    mutationFn: (user) => useFetchPatch(`/user/toggleUserStatus/${user.id}`),
    onMutate: (user) => {
      setActiveAction({ type: "status", userId: user.id });
      setAlert({ type: "loading", message: `${user.status === "active" ? "Deactivating" : "Activating"} user...` });
    },
    onSuccess: (result) => {
      setAlert({ type: "success", message: result.message || "User status updated." });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
    },
    onError: (mutationError) => {
      setAlert({ type: "error", message: mutationError.message });
    },
    onSettled: () => setActiveAction(null),
  });

  const resetPasswordMutation = useMutation({
    mutationFn: (user) => useFetchPatch(`/user/resetPassword/${user.id}`, { password: "password" }),
    onMutate: (user) => {
      setActiveAction({ type: "reset", userId: user.id });
      setAlert({ type: "loading", message: "Resetting password..." });
    },
    onSuccess: (result) => {
      setResetTarget(null);
      setAlert({ type: "success", message: result.message || "Password reset." });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (mutationError) => {
      setAlert({ type: "error", message: mutationError.message });
    },
    onSettled: () => setActiveAction(null),
  });

  const stats = [
    { label: "Total Users", value: summary.total, icon: FiUsers, description: "All system accounts" },
    { label: "Active", value: summary.active, icon: FiUserCheck, description: "Can access the system" },
    { label: "Inactive", value: summary.inactive, icon: FiShield, description: "Blocked from login" },
    { label: "Password Change", value: summary.mustChangePassword, icon: FiKey, description: "Required on next login" },
  ];

  const handleResetPassword = (user) => {
    setResetTarget(user);
    setAlert({ type: "warning", message: `Review and confirm password reset for ${user.full_name}.` });
  };

  const confirmResetPassword = () => {
    if (!resetTarget || resetPasswordMutation.isPending) return;
    resetPasswordMutation.mutate(resetTarget);
  };

  const handleToggleStatus = (user) => {
    const action = user.status === "active" ? "deactivate" : "activate";
    const confirmed = window.confirm(`Are you sure you want to ${action} ${user.full_name}?`);
    if (!confirmed) return;
    toggleStatusMutation.mutate(user);
  };

  const openEditModal = (user) => {
    setSelectedUser(user);
    setShowEditUser(true);
  };

  const handleSaved = (message) => {
    setAlert({ type: "success", message });
    queryClient.invalidateQueries({ queryKey: ["users"] });
    queryClient.invalidateQueries({ queryKey: ["accredited"] });
  };

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="User Management"
          description="Create accounts and set hierarchy. Commission rates are controlled by Seller Groups, not individual accounts."
          icon={FaUserPlus}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          {canManageSellerGroups ? (
            <NavLink to="seller_group" className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Seller Group</NavLink>
          ) : null}
          {canCreateUsers ? (
            <button type="button" onClick={() => setShowCreateUser(true)} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"><FiPlus className="h-4 w-4" />Create User</button>
          ) : null}
        </div>
      </div>

      {actorRole === "admin" ? (
        <StatusAlert
          type="info"
          title="Admin account controls"
          message="You can create, edit, reset, activate, and deactivate seller accounts. Admin and Super Admin accounts are protected."
        />
      ) : null}
      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === "loading" ? undefined : () => setAlert(null)} /> : null}
      {isLoading ? <StatusAlert type="loading" message="Loading users..." /> : null}
      {!isLoading && isFetching ? <StatusAlert type="info" message="Refreshing users..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || "Failed to load users."} /> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                  <h3 className="mt-2 text-3xl font-bold text-slate-950">{stat.value}</h3>
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
              <p className="mt-3 text-sm text-slate-500">{stat.description}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">System Users</h2>
            <p className="text-sm text-slate-500">Search, filter, create, and update system accounts.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search users..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            >
              <option value="all">All Roles</option>
              {Object.entries(roleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value);
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
              onClick={() => queryClient.invalidateQueries({ queryKey: ["users"] })}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <FiRefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[1.4fr_1.25fr_0.9fr_1.1fr_1.2fr_0.9fr_1.4fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>User</p>
              <p>Contact</p>
              <p>Role</p>
              <p>Seller Group</p>
              <p>Reports Under</p>
              <p>Status</p>
              <p className="text-right">Actions</p>
            </div>

            <div className="divide-y divide-slate-100">
              {isLoading ? (
                <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">Loading users...</div>
              ) : users.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">No users found.</div>
              ) : (
                users.map((user) => (
                  <div key={user.id} className="grid grid-cols-[1.4fr_1.25fr_0.9fr_1.1fr_1.2fr_0.9fr_1.4fr] items-center px-4 py-4 text-sm">
                    <div>
                      <p className="font-bold text-slate-950">{user.full_name}</p>
                      <p className="text-xs text-slate-500">Last login: {user.last_login ? formatDateTime(user.last_login) : "Never"}</p>
                    </div>
                    <div>
                      <p className="font-semibold text-slate-800">{user.email}</p>
                      <p className="text-xs text-slate-500">{user.contact_no || "No contact"}</p>
                    </div>
                    <p className="font-semibold text-slate-700">{roleLabels[user.role] || user.role}</p>
                    <p className="font-semibold text-slate-700">{user.seller_group_name || "—"}</p>
                    <p className="text-slate-600">{user.reports_under_name || "Direct / None"}</p>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${user.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      {user.status}
                    </span>
                    <div className="flex justify-end gap-2">
                      {canManageAccount(user) ? (
                        <>
                          {canEditUsers ? <button type="button" onClick={() => openEditModal(user)} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50"><FiEdit2 className="h-3.5 w-3.5" />Edit</button> : null}
                          {canResetPasswords ? <button type="button" onClick={() => handleResetPassword(user)} disabled={resetPasswordMutation.isPending || toggleStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 hover:bg-amber-100 disabled:opacity-60"><FiKey className="h-3.5 w-3.5" />{activeAction?.type === "reset" && activeAction?.userId === user.id ? "Resetting..." : "Reset"}</button> : null}
                          {canChangeStatus ? <button type="button" onClick={() => handleToggleStatus(user)} disabled={resetPasswordMutation.isPending || toggleStatusMutation.isPending} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60">{activeAction?.type === "status" && activeAction?.userId === user.id ? "Updating..." : user.status === "active" ? "Deactivate" : "Activate"}</button> : null}
                        </>
                      ) : (
                        <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-black text-slate-500">Protected account</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-slate-500">
            Showing page {pagination.page} of {pagination.totalPages} • {pagination.total} records
          </p>

          <div className="flex items-center gap-2">
            <select value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
            <button type="button" disabled={!pagination.hasPrev} onClick={() => setPage((current) => Math.max(current - 1, 1))} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Prev</button>
            <button type="button" disabled={!pagination.hasNext} onClick={() => setPage((current) => current + 1)} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50">Next</button>
          </div>
        </div>
      </section>

      {showCreateUser && canCreateUsers ? <CreateUserModal setShowCreateUser={setShowCreateUser} onSaved={handleSaved} allowedRoles={allowedRoles} actorRole={actorRole} /> : null}
      {showEditUser && selectedUser && canEditUsers && canManageAccount(selectedUser) ? <EditUserModal setShowEditUser={setShowEditUser} selectedUser={selectedUser} onSaved={handleSaved} allowedRoles={allowedRoles} actorRole={actorRole} /> : null}
      {canResetPasswords ? <ResetPasswordConfirmModal
        user={resetTarget}
        onClose={() => {
          setResetTarget(null);
          setAlert(null);
        }}
        onConfirm={confirmResetPassword}
        isSaving={resetPasswordMutation.isPending}
      /> : null}
    </main>
  );
};

export default Users;
