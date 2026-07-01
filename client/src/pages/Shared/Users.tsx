import { NavLink } from "react-router-dom";
import PageHeader from "../../components/Shared/PageHeader";
import { FaUserPlus } from "react-icons/fa";
import {
  FiEdit2,
  FiPlus,
  FiSearch,
  FiShield,
  FiUserCheck,
  FiUsers,
  FiX,
  FiMail,
  FiKey,
} from "react-icons/fi";
import { useState } from "react";
import CreateUserModal from "../../components/Shared/UsersComponent/CreateUserModal";
import EditUserModal from "../../components/Shared/UsersComponent/EditUserModal";

const Users = () => {
  const [showEditUser, setShowEditUser] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);

  const users = [
    {
      name: "CANTIGA, ROLINDA C.",
      email: "rolinda@gmail.com",
      role: "Agent",
      reportsUnder: "PARROCHO, JOSEPH E.",
      reportsUnderRole: "Manager",
      accreditationDate: "2026-06-28",
      status: "Active",
      contactNo: "0917 000 0000",
    },
    {
      name: "PARROCHO, JOSEPH E.",
      email: "joseph@gmail.com",
      role: "Manager",
      reportsUnder: "Direct to Developer",
      reportsUnderRole: "-",
      accreditationDate: "2026-06-25",
      status: "Active",
      contactNo: "0918 111 2222",
    },
    {
      name: "REYES, MARIA L.",
      email: "maria@gmail.com",
      role: "Broker",
      reportsUnder: "SANTOS, CARLO M.",
      reportsUnderRole: "Broker Network Manager",
      accreditationDate: "2026-06-21",
      status: "Inactive",
      contactNo: "0919 333 4444",
    },
  ];

  const stats = [
    {
      label: "Total Users",
      value: "3",
      icon: FiUsers,
    },
    {
      label: "Active",
      value: "2",
      icon: FiUserCheck,
    },
    {
      label: "Inactive",
      value: "1",
      icon: FiShield,
    },
  ];

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={"User Management"}
          description={
            "Create accounts and set hierarchy. Commission rates are controlled by Seller Groups, not individual accounts."
          }
          icon={FaUserPlus}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <NavLink
            to={"seller_group"}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            Seller Group
          </NavLink>

          <button
            onClick={() => setShowCreateUser(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FiPlus className="h-4 w-4" />
            Create User
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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

          <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Search users or email"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
              />
            </label>

            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="all_roles">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="broker_network_manager">
                Broker Network Manager
              </option>
              <option value="broker">Broker</option>
              <option value="manager">Manager</option>
              <option value="agent">Agent</option>
            </select>

            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="all_status">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1.5fr_1fr_1.3fr_1fr_0.8fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Name</p>
              <p>Role</p>
              <p>Reports Under</p>
              <p>Accreditation Date</p>
              <p>Status</p>
              <p className="text-right">Action</p>
            </div>

            <div className="divide-y divide-slate-100">
              {users.map((user) => (
                <div
                  key={user.email}
                  className="grid grid-cols-[1.5fr_1fr_1.3fr_1fr_0.8fr_1fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-bold text-slate-950">{user.name}</p>
                    <p className="text-sm text-slate-500">{user.email}</p>
                    <p className="text-xs font-semibold text-slate-400">
                      {user.contactNo}
                    </p>
                  </div>

                  <p className="font-semibold text-slate-700">{user.role}</p>

                  <div>
                    <p className="font-semibold text-slate-800">
                      {user.reportsUnder}
                    </p>
                    <p className="text-sm text-slate-500">
                      {user.reportsUnderRole}
                    </p>
                  </div>

                  <p className="font-semibold text-slate-700">
                    {user.accreditationDate}
                  </p>

                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                        user.status === "Active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {user.status}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowEditUser(true)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>

                    <button className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition hover:bg-red-50">
                      Deactivate
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showCreateUser && <CreateUserModal setShowCreateUser={setShowCreateUser}/> }

      {showEditUser && <EditUserModal setShowEditUser={setShowEditUser}/> }
    </main>
  );
};

export default Users;