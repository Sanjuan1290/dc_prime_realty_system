import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import PageHeader from "../../components/Shared/PageHeader";
import { FaUserPlus } from "react-icons/fa";
import {
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

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const sellerRoles = [
  "broker_network_manager",
  "broker",
  "manager",
  "agent",
];

const sampleUsers = [
  {
    id: 1,
    first_name: "Robert",
    middle_name: "Cortez",
    last_name: "San Juan",
    full_name: "ROBERT CORTEZ SAN JUAN",
    contact_no: "0912 345 6789",
    email: "superadmin@gmail.com",
    role: "super_admin",
    status: "active",
    must_change_password: false,
    last_login: "2026-07-02T08:30:00.000Z",
    seller_group_id: null,
    seller_group_name: null,
    reports_under_user_id: null,
    reports_under_name: null,
    reports_under_role: null,
    accreditation_date: null,
    accredited_seller_status: null,
  },
  {
    id: 2,
    first_name: "Maria",
    middle_name: "Reyes",
    last_name: "Dela Cruz",
    full_name: "MARIA REYES DELA CRUZ",
    contact_no: "0917 222 3333",
    email: "maria@dcprime.test",
    role: "broker_network_manager",
    status: "active",
    must_change_password: true,
    last_login: "2026-07-01T11:10:00.000Z",
    seller_group_id: 1,
    seller_group_name: "Prime Sales Team",
    reports_under_user_id: null,
    reports_under_name: null,
    reports_under_role: null,
    accreditation_date: "2026-06-15T00:00:00.000Z",
    accredited_seller_status: "active",
  },
  {
    id: 3,
    first_name: "Juan",
    middle_name: "Lazaro",
    last_name: "Santos",
    full_name: "JUAN LAZARO SANTOS",
    contact_no: "0918 555 1010",
    email: "juan@dcprime.test",
    role: "broker",
    status: "active",
    must_change_password: false,
    last_login: "2026-06-30T09:45:00.000Z",
    seller_group_id: 1,
    seller_group_name: "Prime Sales Team",
    reports_under_user_id: 2,
    reports_under_name: "MARIA REYES DELA CRUZ",
    reports_under_role: "broker_network_manager",
    accreditation_date: "2026-06-18T00:00:00.000Z",
    accredited_seller_status: "active",
  },
  {
    id: 4,
    first_name: "Lea",
    middle_name: "Garcia",
    last_name: "Ramos",
    full_name: "LEA GARCIA RAMOS",
    contact_no: null,
    email: "lea@dcprime.test",
    role: "agent",
    status: "inactive",
    must_change_password: false,
    last_login: null,
    seller_group_id: 2,
    seller_group_name: "External Realty Group",
    reports_under_user_id: 3,
    reports_under_name: "JUAN LAZARO SANTOS",
    reports_under_role: "broker",
    accreditation_date: "2026-06-20T00:00:00.000Z",
    accredited_seller_status: "inactive",
  },
];

const Users = () => {
  const [showEditUser, setShowEditUser] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [users, setUsers] = useState(sampleUsers);
  const [alert, setAlert] = useState(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const filteredUsers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !keyword ||
        user.full_name.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        (user.contact_no || "").toLowerCase().includes(keyword) ||
        (user.seller_group_name || "").toLowerCase().includes(keyword);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, search, roleFilter, statusFilter]);

  const pagination = useMemo(() => {
    const total = filteredUsers.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      page: Math.min(page, totalPages),
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }, [filteredUsers.length, limit, page]);

  const pagedUsers = useMemo(() => {
    const start = (pagination.page - 1) * pagination.limit;
    return filteredUsers.slice(start, start + pagination.limit);
  }, [filteredUsers, pagination]);

  const summary = useMemo(
    () => ({
      total: users.length,
      active: users.filter((user) => user.status === "active").length,
      inactive: users.filter((user) => user.status === "inactive").length,
      mustChangePassword: users.filter((user) => Boolean(user.must_change_password)).length,
    }),
    [users]
  );

  const stats = [
    {
      label: "Total Users",
      value: summary.total,
      icon: FiUsers,
      description: "All system accounts",
    },
    {
      label: "Active",
      value: summary.active,
      icon: FiUserCheck,
      description: "Can access the system",
    },
    {
      label: "Inactive",
      value: summary.inactive,
      icon: FiShield,
      description: "Blocked from login",
    },
    {
      label: "Password Change",
      value: summary.mustChangePassword,
      icon: FiKey,
      description: "Required on next login",
    },
  ];

  const openEditModal = (user) => {
    setSelectedUser(user);
    setShowEditUser(true);
  };

  const updateUserStatus = (user) => {
    const nextStatus = user.status === "active" ? "inactive" : "active";

    setUsers((currentUsers) =>
      currentUsers.map((currentUser) =>
        currentUser.id === user.id
          ? { ...currentUser, status: nextStatus }
          : currentUser
      )
    );

    setAlert({
      type: "success",
      message: `${user.full_name} is now ${nextStatus}.`,
    });
  };

  const handleSaved = (message) => {
    setAlert({ type: "success", message });
  };

  const fetchUsers = () => {
    setAlert({ type: "success", message: "Preview data refreshed." });
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
          <NavLink
            to="seller_group"
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            Seller Group
          </NavLink>

          <button
            type="button"
            onClick={() => setShowCreateUser(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FiPlus className="h-4 w-4" />
            Create User
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
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">
                    {stat.label}
                  </p>
                  <h3 className="mt-2 text-3xl font-bold text-slate-950">
                    {stat.value}
                  </h3>
                </div>

                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">{stat.description}</p>
            </div>
          );
        })}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Users List</h2>
            <p className="text-sm text-slate-500">
              View account details, hierarchy, and user status.
            </p>
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
                placeholder="Search users or email"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
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
                <option key={value} value={value}>
                  {label}
                </option>
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
              onClick={fetchUsers}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1180px]">
            <div className="grid grid-cols-[1.5fr_1fr_1.3fr_1.1fr_1fr_0.9fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Name</p>
              <p>Role</p>
              <p>Reports Under</p>
              <p>Seller Group</p>
              <p>Accreditation</p>
              <p>Status</p>
              <p className="text-right">Action</p>
            </div>

            <div className="divide-y divide-slate-100">
              {pagedUsers.length === 0 ? (
                <div className="px-4 py-10 text-center">
                  <p className="font-bold text-slate-700">No users found.</p>
                  <p className="text-sm text-slate-500">
                    Try changing your search or filters.
                  </p>
                </div>
              ) : (
                pagedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="grid grid-cols-[1.5fr_1fr_1.3fr_1.1fr_1fr_0.9fr_1fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-bold uppercase text-slate-950">
                        {user.full_name}
                      </p>
                      <p className="text-sm text-slate-500">{user.email}</p>
                      <p className="text-xs font-semibold text-slate-400">
                        {user.contact_no || "No contact no."}
                      </p>
                    </div>

                    <p className="font-semibold text-slate-700">
                      {roleLabels[user.role]}
                    </p>

                    <div>
                      <p className="font-semibold text-slate-800">
                        {user.reports_under_name ||
                          (sellerRoles.includes(user.role)
                            ? "Direct to Developer"
                            : "Not applicable")}
                      </p>
                      <p className="text-sm text-slate-500">
                        {user.reports_under_role
                          ? roleLabels[user.reports_under_role]
                          : sellerRoles.includes(user.role)
                            ? "No parent seller"
                            : "System account"}
                      </p>
                    </div>

                    <p className="font-semibold text-slate-700">
                      {user.seller_group_name || "-"}
                    </p>

                    <p className="font-semibold text-slate-700">
                      {(user.accreditation_date && formatDateTime(user.accreditation_date)) || "-"}
                    </p>

                    <div className="flex flex-col gap-1">
                      <span
                        className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                          user.status === "active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        {user.status}
                      </span>
                      {Boolean(user.must_change_password) && (
                        <span className="w-fit rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                          Change password
                        </span>
                      )}
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(user)}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FiEdit2 className="h-3.5 w-3.5" />
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => updateUserStatus(user)}
                        className={`inline-flex h-9 items-center justify-center rounded-lg border px-3 text-xs font-bold transition ${
                          user.status === "active"
                            ? "border-red-200 bg-white text-red-600 hover:bg-red-50"
                            : "border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50"
                        }`}
                      >
                        {user.status === "active" ? "Deactivate" : "Activate"}
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
            Showing {pagedUsers.length ? (pagination.page - 1) * pagination.limit + 1 : 0}-
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

      {showCreateUser && (
        <CreateUserModal
          setShowCreateUser={setShowCreateUser}
          onSaved={handleSaved}
        />
      )}

      {showEditUser && selectedUser && (
        <EditUserModal
          setShowEditUser={setShowEditUser}
          selectedUser={selectedUser}
          onSaved={handleSaved}
        />
      )}
    </main>
  );
};

export default Users;
