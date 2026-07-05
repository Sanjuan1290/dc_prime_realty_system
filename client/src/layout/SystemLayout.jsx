import { useMemo, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FaCircle } from "react-icons/fa6";
import {
  FiActivity,
  FiClock,
  FiDollarSign,
  FiFileText,
  FiHome,
  FiLoader,
  FiLogOut,
  FiMap,
  FiMenu,
  FiSettings,
  FiShield,
  FiUsers,
  FiX,
} from "react-icons/fi";
import useCurrentUser from "../utils/useCurrentUser";
import { useFetch } from "../utils/useFetch";
import StatusAlert from "../components/Shared/StatusAlert";

const getFullName = (user) => {
  const name = [user?.first_name, user?.middle_name, user?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "User";
};

const getInitials = (user) => {
  const first = user?.first_name?.charAt(0) || "";
  const last = user?.last_name?.charAt(0) || "";

  return `${first}${last}`.toUpperCase() || "U";
};

const formatRole = (role = "") =>
  String(role)
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const SystemLayout = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [layoutAlert, setLayoutAlert] = useState(null);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const {
    data: currentUser,
    isLoading: isCurrentUserLoading,
    isError: isCurrentUserError,
  } = useCurrentUser();

  const {
    data: lotProjectsData,
    isLoading: isLotProjectsLoading,
    isFetching: isLotProjectsFetching,
    isError: isLotProjectsError,
    error: lotProjectsError,
  } = useQuery({
    queryKey: ["lot-project-options"],
    queryFn: () => useFetch("/projects/lot-projects/options"),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      setLayoutAlert({
        type: "loading",
        message: "Logging out of the system...",
      });

      const res = await fetch(`${import.meta.env.VITE_API_URL}/user/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Logout failed.");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.clear();
      navigate("/", { replace: true });
    },
    onError: (error) => {
      setLayoutAlert({
        type: "error",
        message: error?.message || "Logout failed. Redirecting to login.",
      });

      window.setTimeout(() => {
        queryClient.clear();
        navigate("/", { replace: true });
      }, 700);
    },
  });

  const user = currentUser?.user;

  const lotProjectItems = useMemo(() => {
    const projects = lotProjectsData?.data || [];

    return projects.map((project) => ({
      label: project.lot_project_name || project.label || "Lot Project",
      pathname:
        project.routePath ||
        `/lot-projects/${project.lot_project_slug || project.slug}`,
      icon: FiMap,
      isAbsolute: true,
    }));
  }, [lotProjectsData]);

  const navGroups = useMemo(
    () => [
      {
        title: "OVERVIEW",
        description: "Main summary",
        items: [{ label: "Dashboard", pathname: "", icon: FiHome }],
      },
      {
        title: "PROJECTS",
        description: "Project setup and configuration",
        items: [{ label: "Projects", pathname: "projects", icon: FiMap }],
      },
      {
        title: "LOT PROJECTS",
        description: isLotProjectsLoading
          ? "Loading lot projects..."
          : "Dynamic lot project workspaces",
        items: lotProjectItems,
        isLoading: isLotProjectsLoading,
        isError: isLotProjectsError,
        errorMessage:
          lotProjectsError?.message || "Failed to load lot projects.",
      },
      {
        title: "MANAGEMENT",
        description: "Seller and team management",
        items: [
          { label: "Accredited Sellers", pathname: "accredited", icon: FiUsers },
        ],
      },
      {
        title: "COMPLIANCE",
        description: "Documents and system records",
        items: [
          { label: "Documents", pathname: "documents", icon: FiFileText },
          { label: "Audit Logs", pathname: "audit-logs", icon: FiActivity },
        ],
      },
      {
        title: "EMPLOYEES",
        description: "Employee monitoring",
        items: [
          { label: "Employees", pathname: "employees", icon: FiUsers },
          { label: "Attendance", pathname: "attendance", icon: FiClock },
          { label: "Cash Advances", pathname: "cash-advance", icon: FiDollarSign },
        ],
      },
      {
        title: "ADMINISTRATION",
        description: "User access and system settings",
        items: [
          { label: "Users", pathname: "users", icon: FiShield },
          { label: "Settings", pathname: "settings", icon: FiSettings },
        ],
      },
    ],
    [
      isLotProjectsLoading,
      isLotProjectsError,
      lotProjectsError?.message,
      lotProjectItems,
    ]
  );

  const activeItem = useMemo(() => {
    const pathname = location.pathname;

    for (const group of navGroups) {
      for (const item of group.items) {
        if (!item.pathname) {
          if (pathname === "/super_admin") return item;
          continue;
        }

        if (item.isAbsolute && pathname.startsWith(item.pathname)) {
          return item;
        }

        if (!item.isAbsolute && pathname.includes(`/super_admin/${item.pathname}`)) {
          return item;
        }
      }
    }

    return { label: "Dashboard" };
  }, [location.pathname, navGroups]);

  if (isCurrentUserLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <StatusAlert type="loading" message="Loading system access..." />
      </div>
    );
  }

  if (isCurrentUserError) {
    return <Navigate to="/" replace />;
  }

  if (user?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      {isSidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/50 lg:hidden"
        />
      ) : null}

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
                <img src="/logo-mobile.png" alt="D&C Prime logo" className="h-7 w-7" />
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
              className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 lg:hidden"
              aria-label="Close sidebar"
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
              <h3 className="truncate text-base font-semibold text-slate-900">
                {activeItem?.label || "Dashboard"}
              </h3>
            </div>

            {isLotProjectsFetching ? (
              <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500">
                <FiLoader className="h-3.5 w-3.5 animate-spin" />
                Refreshing lot projects
              </div>
            ) : null}
          </div>
        </div>

        <nav className="overflow-y-auto px-3 py-4">
          {layoutAlert ? (
            <div className="mb-4">
              <StatusAlert
                type={layoutAlert.type}
                message={layoutAlert.message}
                onClose={
                  layoutAlert.type === "loading"
                    ? undefined
                    : () => setLayoutAlert(null)
                }
              />
            </div>
          ) : null}

          {navGroups.map((nav) => (
            <div key={nav.title} className="mb-5">
              <div className="mb-2 px-2">
                <p className="text-xs font-bold tracking-wider text-slate-600">
                  {nav.title}
                </p>

                {nav.description ? (
                  <p className="text-xs text-slate-400">{nav.description}</p>
                ) : null}
              </div>

              {nav.isLoading ? (
                <div className="mx-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
                    <FiLoader className="h-4 w-4 animate-spin" />
                    Loading projects...
                  </div>
                </div>
              ) : null}

              {nav.isError ? (
                <div className="mx-2 rounded-xl border border-red-200 bg-red-50 px-3 py-3">
                  <p className="text-xs font-bold text-red-700">
                    {nav.errorMessage}
                  </p>
                </div>
              ) : null}

              {!nav.isLoading && !nav.isError && nav.items.length === 0 ? (
                <div className="mx-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="text-xs font-semibold text-slate-500">
                    No records available.
                  </p>
                </div>
              ) : null}

              <div className="space-y-1">
                {nav.items.map((item) => {
                  const Icon = item.icon;

                  return (
                    <NavLink
                      key={item.pathname || item.label}
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
              {getFullName(user)}
            </p>

            <p className="truncate text-xs text-slate-500">
              {user?.email || "No email available"}
            </p>

            <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
              {formatRole(user?.role)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {logoutMutation.isPending ? (
              <FiLoader className="h-4 w-4 animate-spin" />
            ) : (
              <FiLogOut className="h-4 w-4" />
            )}

            {logoutMutation.isPending ? "Logging out..." : "Logout"}
          </button>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 text-sm backdrop-blur lg:left-72 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 lg:hidden"
            aria-label="Open sidebar"
          >
            <FiMenu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <FaCircle className="h-2.5 w-2.5 shrink-0 text-blue-600" />
              <h3 className="truncate text-base font-semibold">
                {activeItem?.label || "Dashboard"}
              </h3>
            </div>

            <p className="truncate text-xs text-gray-600 sm:text-sm">
              {location.pathname.startsWith("/lot-projects")
                ? "Lot project workspace"
                : "System workspace"}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <div className="hidden text-right sm:block">
            <h3 className="font-semibold">{getFullName(user)}</h3>
            <p className="text-xs text-slate-500">{formatRole(user?.role)}</p>
          </div>

          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-sm font-bold text-white">
            {getInitials(user)}
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