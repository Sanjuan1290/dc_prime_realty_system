import { NavLink, Outlet, useNavigate } from "react-router-dom"
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
  FiUserCheck,
  FiDollarSign,
  FiActivity,
  FiClock,
  FiX,
} from "react-icons/fi";
import type { IconType } from "react-icons";
import { useEffect } from "react";
import useCurrentUser from "../utils/useCurrentUser";

const SystemLayout = () => {

  const navGroups = [
    {
      title: "OVERVIEW",
      description: 'Main summary',
      items: [
        { label: "Dashboard", pathname: "", icon: FiHome }
      ],
    },
    {
      title: "MANAGEMENT",
      description: 'Projects, units, and buyers',
      items: [
        { label: "Projects", pathname: "projects", icon: FiMap },
        { label: "Listings", pathname: "listings", icon: FiGrid },
        { label: "Clients", pathname: "clients", icon: FiUsers },
        { label: "Accredited Sellers", pathname: "accredited", icon: FiUserCheck },
      ],
    },
    {
      title: "Finance",
      description: 'Payments and payouts',
      items: [
        { label: "Payments", pathname: "payments", icon: FiCreditCard },
        { label: "Commissions", pathname: "commissions", icon: FiDollarSign },
        { label: "Cash Advances", pathname: "cash-advance", icon: FiDollarSign },
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
      title: "RECORDS",
      items: [
        { label: "Reports", pathname: "reports", icon: FiBarChart2 },
        { label: "Employees", pathname: "employees", icon: FiUsers },
        { label: "Attendance", pathname: "attendance", icon: FiClock },
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
  
  const navigate = useNavigate()
  const { data: currentUser, isLoading, isError } = useCurrentUser();

  if (isLoading) return <p>Loading...</p>;
  
  if(isError) {
    navigate("/", { replace: true });
    return;
  }

  if (currentUser.user.must_change_password) {
    navigate("/change-password", { replace: true });
    return
  }

  return (
    <>
      <div className="flex fixed w-full top-0">
        <aside className="grid h-screen w-72 grid-cols-1 grid-rows-[auto_1fr_auto] border-r border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-gradient-to-b from-white to-emerald-50 px-4 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-black">
                <img src="/logo-mobile.png" alt="logo" className="h-6 w-6" />
              </div>

              <div>
                <p className="font-semibold text-slate-900">D&amp;C Prime</p>
                <p className="text-sm text-slate-500">Realty management</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 text-xs">
              <p className="font-semibold tracking-wider text-slate-400">
                CURRENT SECTION
              </p>

              <div className="mt-2 flex items-center gap-2">
                <FaCircle className="h-2.5 w-2.5 text-blue-600" />
                <h3 className="text-base font-semibold text-slate-900">Dashboard</h3>
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
                        className={({ isActive }) =>
                          [
                            "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
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
                                "flex h-9 w-9 items-center justify-center rounded-lg",
                                isActive
                                  ? "bg-blue-600 text-white"
                                  : "bg-slate-100 text-slate-500",
                              ].join(" ")}
                            >
                              <Icon className="h-4 w-4" />
                            </span>

                            <span>{item.label}</span>
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
            <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
              <p className="text-sm font-semibold text-slate-900">Super Admin</p>
              <p className="text-xs text-slate-500">superadmin@gmail.com</p>
            </div>

            <button
              type="button"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-red-50 hover:text-red-700"
            >
              Logout
            </button>
          </div>
        </aside>

        <header className="flex flex-1 justify-between px-4 py-2 border items-center text-sm max-h-fit left-0 right-0">
          <div className="flex flex-col">
            <div className="flex gap-2 items-center">
              <FaCircle className="text-blue-600"/>
              <h3 className="font-semibold text-base"> Dashboard</h3>
            </div>
            
            <p className="text-gray-700 ">Overview</p>
          </div>

          <h3 className="font-semibold ">Super Admin</h3>
        </header>
      </div>
      <Outlet />
    </>
  )
}

export default SystemLayout