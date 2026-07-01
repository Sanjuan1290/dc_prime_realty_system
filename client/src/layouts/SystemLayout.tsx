import { Navigate, NavLink, Outlet } from "react-router-dom";
import { FaCircle } from "react-icons/fa6";
import {
  FiBarChart2,
  FiCreditCard,
  FiFileText,
  FiGrid,
  FiHome,
  FiLogOut,
  FiMenu,
  FiSettings,
  FiShield,
  FiUsers,
  FiMap,
  FiDollarSign,
  FiActivity,
  FiClock,
  FiX,
} from "react-icons/fi";
import { useState } from "react";
import useCurrentUser from "../utils/useCurrentUser";

const SystemLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navGroups = [
    {
      title: "OVERVIEW",
      description: "Main summary",
      items: [{ label: "Dashboard", pathname: "", icon: FiHome }],
    },
    {
      title: "PROJECTS",
      description: "List of Projects",
      items: [
        { label: "Bailen Project", pathname: "/bailenProject", icon: FiMap },
      ],
    },
    {
      title: "MANAGEMENT",
      description: "management",
      items: [
        { label: "Accredited Sellers", pathname: "accredited", icon: FiMap },
      ],
    },
    {
      title: "COMPLIANCE",
      items: [
        { label: "Documents", pathname: "documents", icon: FiFileText },
        { label: "Audit Logs", pathname: "audit-logs", icon: FiActivity },
      ],
    },
    {
      title: "Employees",
      items: [
        { label: "Employees", pathname: "employees", icon: FiUsers },
        { label: "Attendance", pathname: "attendance", icon: FiClock },
        { label: "Cash Advances", pathname: "cash-advance", icon: FiDollarSign },
      ],
    },
    {
      title: "ADMINISTRATION",
      items: [
        { label: "Users", pathname: "users", icon: FiShield },
        { label: "Settings", pathname: "settings", icon: FiSettings },
      ],
    },
  ];

  const { data: currentUser, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <p className="rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
          Loading...
        </p>
      </div>
    );
  }

  if (isError) {
    return <Navigate to={"/"} replace />;
  }

  if (currentUser.user.must_change_password) {
    return <Navigate to={"/change-password"} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {isSidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      )}

      <aside
        className={[
          "fixed left-0 top-0 z-50 grid h-screen w-72 grid-cols-1 grid-rows-[auto_1fr_auto] border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-b from-white to-emerald-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-black shadow-sm">
                <img src="/logo-mobile.png" alt="logo" className="h-7 w-7" />
              </div>

              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">
                  D&amp;C Prime
                </p>
                <p className="truncate text-sm text-slate-500">
                  Realty management
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs shadow-sm">
            <p className="font-semibold tracking-wider text-slate-400">
              CURRENT SECTION
            </p>

            <div className="mt-2 flex items-center gap-2">
              <FaCircle className="h-2.5 w-2.5 text-blue-600" />
              <h3 className="text-base font-semibold text-slate-900">
                Dashboard
              </h3>
            </div>
          </div>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          {navGroups.map((nav) => (
            <div key={nav.title} className="mb-5">
              <div className="mb-2 px-2">
                <p className="text-xs font-bold tracking-wider text-slate-600">
                  {nav.title}
                </p>

                {nav.description && (
                  <p className="text-xs text-slate-400">{nav.description}</p>
                )}
              </div>

              <div className="space-y-1">
                {nav.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.pathname}
                      to={item.pathname}
                      end={item.pathname === ""}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) =>
                        [
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                          isActive
                            ? "bg-blue-100 text-blue-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        ].join(" ")
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={[
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition",
                              isActive
                                ? "bg-blue-600 text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-blue-600 group-hover:text-white",
                            ].join(" ")}
                          >
                            <Icon className="h-4 w-4" />
                          </span>

                          <span className="truncate">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="truncate text-sm font-semibold text-slate-900">
              Super Admin
            </p>
            <p className="truncate text-xs text-slate-500">
              superadmin@gmail.com
            </p>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <FiLogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 text-sm backdrop-blur lg:left-72 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
          >
            <FiMenu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FaCircle className="h-2.5 w-2.5 shrink-0 text-blue-600" />
              <h3 className="truncate text-base font-semibold">Dashboard</h3>
            </div>

            <p className="truncate text-xs text-gray-600 sm:text-sm">
              Overview
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <h3 className="font-semibold">Super Admin</h3>
            <p className="text-xs text-slate-500">System access</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            SA
          </div>
        </div>
      </header>

      <main className="min-h-screen pt-16 lg:pl-72">
        <div className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default SystemLayout;