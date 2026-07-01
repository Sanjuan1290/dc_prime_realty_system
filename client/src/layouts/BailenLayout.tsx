import { Navigate, NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { FaCircle } from "react-icons/fa6";
import {
  FiActivity,
  FiFileText,
  FiGrid,
  FiHome,
  FiLogOut,
  FiMap,
  FiMenu,
  FiSettings,
  FiX,
} from "react-icons/fi";
import useCurrentUser from "../utils/useCurrentUser";

const BailenLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const navGroups = [
    {
      title: "OVERVIEW",
      description: "Bailen summary",
      items: [{ label: "Dashboard", pathname: "", icon: FiHome }],
    },
    {
      title: "PROJECT",
      description: "Project records",
      items: [{ label: "Maragondon Project", pathname: "/maragondonProject", icon: FiMap }],
    },
    {
      title: "LISTINGS",
      description: "Lots and inventory",
      items: [{ label: "Listings", pathname: "listings", icon: FiGrid }],
    },
    {
      title: "COMPLIANCE",
      description: "Requirements",
      items: [{ label: "Documents", pathname: "documents", icon: FiFileText }],
    },
    {
      title: "ADMINISTRATION",
      description: "Project settings",
      items: [{ label: "Settings", pathname: "settings", icon: FiSettings }],
    },
  ];

  const { data: currentUser, isLoading, isError } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Loading Bailen...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return <Navigate to="/" replace />;
  }

  if (currentUser.user.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  const userInitials = `${currentUser.user.first_name?.[0] ?? ""}${
    currentUser.user.last_name?.[0] ?? ""
  }`.toUpperCase();

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
          "fixed left-0 top-0 z-50 grid h-screen w-72 grid-rows-[auto_1fr_auto] border-r border-slate-200 bg-white shadow-xl transition-transform duration-300 lg:translate-x-0 lg:shadow-none",
          isSidebarOpen ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="border-b border-slate-200 bg-gradient-to-b from-emerald-50 via-white to-white px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 shadow-sm">
                <img src="/logo-mobile.png" alt="D&C Prime logo" className="h-8 w-8" />
              </div>

              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-slate-950">
                  D&amp;C Prime Realty
                </p>
                <p className="truncate text-xs font-medium text-slate-500">
                  Bailen Management
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 lg:hidden"
            >
              <FiX className="h-5 w-5" />
            </button>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-100 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-wider text-slate-400">
                  ACTIVE PROJECT
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <FaCircle className="h-2.5 w-2.5 text-emerald-600" />
                  <h2 className="text-base font-bold text-slate-950">Bailen</h2>
                </div>
              </div>

              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                LA
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold text-slate-400">Location</p>
                <p className="mt-1 font-bold text-slate-800">Cavite</p>
              </div>

              <div className="rounded-xl bg-slate-50 p-3">
                <p className="font-semibold text-slate-400">Status</p>
                <p className="mt-1 font-bold text-emerald-700">Active</p>
              </div>
            </div>
          </div>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          {navGroups.map((group) => (
            <div key={group.title} className="mb-5">
              <div className="mb-2 px-2">
                <p className="text-xs font-bold tracking-wider text-slate-500">
                  {group.title}
                </p>
                <p className="text-xs text-slate-400">{group.description}</p>
              </div>

              <div className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.pathname}
                      to={item.pathname}
                      end={item.pathname === ""}
                      onClick={() => setIsSidebarOpen(false)}
                      className={({ isActive }) =>
                        [
                          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition",
                          isActive
                            ? "bg-emerald-50 text-emerald-700"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
                        ].join(" ")
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span
                            className={[
                              "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                              isActive
                                ? "bg-emerald-600 text-white"
                                : "bg-slate-100 text-slate-500 group-hover:bg-emerald-600 group-hover:text-white",
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
          <div className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="truncate text-sm font-bold text-slate-950">
              {currentUser.user.first_name} {currentUser.user.last_name}
            </p>
            <p className="truncate text-xs text-slate-500">
              {currentUser.user.email}
            </p>
          </div>

          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <FiLogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:left-72 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 lg:hidden"
          >
            <FiMenu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FiActivity className="h-4 w-4 shrink-0 text-emerald-600" />
              <h1 className="truncate text-base font-bold text-slate-950">
                Bailen Project
              </h1>
            </div>

            <p className="truncate text-xs font-medium text-slate-500 sm:text-sm">
              Project dashboard and lot inventory
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-bold text-slate-950">
              {currentUser.user.first_name} {currentUser.user.last_name}
            </p>
            <p className="text-xs text-slate-500">Project access</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white">
            {userInitials || "U"}
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

export default BailenLayout;