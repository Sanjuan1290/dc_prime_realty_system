import { useMemo } from "react";
import { NavLink } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FiArrowRight,
  FiHome,
  FiMap,
  FiMapPin,
} from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import StatusAlert from "../../components/Shared/StatusAlert";
import { useFetch } from "../../utils/useFetch";

const PROJECT_TYPES = {
  lot: {
    title: "Lot Project Workspaces",
    description: "Choose a lot project to open its workspace.",
    endpoint: "/projects/lot-projects/options",
    queryKey: "lot-project-workspace-options",
    icon: FiMap,
    emptyMessage: "No lot project workspaces are available.",
    fallbackPath: (slug) => `/lot-projects/${slug}`,
    getName: (project) =>
      project.lot_project_name ||
      project.project_name ||
      project.label ||
      "Lot Project",
    getSlug: (project) =>
      project.lot_project_slug ||
      project.project_slug ||
      project.slug,
    getLocation: (project) =>
      project.lot_project_location ||
      project.project_location ||
      project.location ||
      "No location set",
    getStatus: (project) =>
      project.lot_project_status ||
      project.project_status ||
      project.status ||
      "active",
  },
  house_lot: {
    title: "House & Lot Project Workspaces",
    description: "Choose a house and lot project to open its workspace.",
    endpoint: "/projects/house-lot-projects/options",
    queryKey: "house-lot-project-workspace-options",
    icon: FiHome,
    emptyMessage: "No house and lot project workspaces are available.",
    fallbackPath: (slug) => `/house-lot-projects/${slug}`,
    getName: (project) =>
      project.house_lot_project_name ||
      project.project_name ||
      project.label ||
      "House & Lot Project",
    getSlug: (project) =>
      project.house_lot_project_slug ||
      project.project_slug ||
      project.slug,
    getLocation: (project) =>
      project.house_lot_project_location ||
      project.project_location ||
      project.location ||
      "No location set",
    getStatus: (project) =>
      project.house_lot_project_status ||
      project.project_status ||
      project.status ||
      "active",
  },
};

const normalizeStatus = (value = "") =>
  String(value || "active")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const ProjectWorkspaceList = ({ type = "lot" }) => {
  const config = PROJECT_TYPES[type] || PROJECT_TYPES.lot;
  const HeaderIcon = config.icon;
  const isFeatureEnabled =
    type !== "house_lot" ||
    import.meta.env.VITE_FEATURE_HOUSE_LOT === "true";

  const {
    data,
    isLoading,
    isFetching,
    isError,
    error,
  } = useQuery({
    queryKey: [config.queryKey],
    queryFn: () => useFetch(config.endpoint),
    enabled: isFeatureEnabled,
  });

  const projects = useMemo(() => {
    const records = Array.isArray(data?.data) ? data.data : [];

    return records
      .map((project) => {
        const slug = config.getSlug(project);

        return {
          id:
            project.lot_project_id ||
            project.house_lot_project_id ||
            project.project_id ||
            project.id ||
            slug,
          name: config.getName(project),
          slug,
          location: config.getLocation(project),
          status: config.getStatus(project),
          pathname:
            project.routePath ||
            project.route_path ||
            (slug ? config.fallbackPath(slug) : ""),
        };
      })
      .filter((project) => Boolean(project.pathname));
  }, [config, data]);

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          title={config.title}
          description={config.description}
          icon={HeaderIcon}
        />

        {!isLoading && !isError ? (
          <div className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 shadow-sm">
            {projects.length} project{projects.length === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>

      {!isFeatureEnabled ? (
        <StatusAlert
          type="info"
          message="House and lot project workspaces are not active yet."
        />
      ) : null}

      {isFeatureEnabled && isLoading ? (
        <StatusAlert
          type="loading"
          message={`Loading ${config.title.toLowerCase()}...`}
        />
      ) : null}

      {isFeatureEnabled && !isLoading && isFetching ? (
        <StatusAlert
          type="info"
          message={`Refreshing ${config.title.toLowerCase()}...`}
        />
      ) : null}

      {isFeatureEnabled && isError ? (
        <StatusAlert
          type="error"
          message={
            error?.message ||
            `Failed to load ${config.title.toLowerCase()}.`
          }
        />
      ) : null}

      {!isLoading && !isError && projects.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
            <HeaderIcon className="h-6 w-6" />
          </div>

          <h2 className="mt-4 text-lg font-black text-slate-950">
            No project workspaces yet
          </h2>

          <p className="mt-2 text-sm font-semibold text-slate-500">
            {config.emptyMessage}
          </p>
        </section>
      ) : null}

      {!isLoading && !isError && projects.length > 0 ? (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <NavLink
              key={project.id}
              to={project.pathname}
              className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                    <HeaderIcon className="h-5 w-5" />
                  </div>

                  <div className="min-w-0">
                    <h2 className="truncate text-base font-black text-slate-950">
                      {project.name}
                    </h2>

                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-500">
                      <FiMapPin className="h-4 w-4 shrink-0" />
                      <span className="truncate">{project.location}</span>
                    </p>
                  </div>
                </div>

                <FiArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-700" />
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-600">
                  {normalizeStatus(project.status)}
                </span>

                <span className="text-xs font-black text-blue-700">
                  Open workspace
                </span>
              </div>
            </NavLink>
          ))}
        </section>
      ) : null}
    </main>
  );
};

export default ProjectWorkspaceList;
