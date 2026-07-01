import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  FiAlertCircle,
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiFileText,
  FiGrid,
  FiMap,
  FiRefreshCcw,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

import type { BailenCadastralLotNumber, ProjectBailen } from "../../types/project";
import EditProject from "../../components/Bailen/DashboardComponent/EditProject";

type ProjectResponse = {
  success: boolean;
  data: ProjectBailen;
};

type BailenDefaultDocument = {
  default_document_id: number;
  project_bailen_id: number;
  document_id: number;
  document_name: string;
  document_description: string | null;
  document_is_reusable: boolean | 0 | 1;
  document_status: "active" | "inactive";
  document_is_required: boolean | 0 | 1;
};

type BailenDocumentsResponse = {
  success: boolean;
  data: BailenDefaultDocument[];
};

type BailenCadastralLotNumbersResponse = {
  success: boolean;
  data: BailenCadastralLotNumber[];
};

const Dashboard = () => {
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);

  const {
    data: projectData,
    isLoading: isProjectLoading,
    isError: isProjectError,
    refetch: refetchProject,
  } = useQuery<ProjectResponse>({
    queryKey: ["bailen-project"],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/bailen/project/getProject`,
        {
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch Bailen project.");
      }

      return data;
    },
  });

  const {
    data: documentsData,
    isLoading: isDocumentsLoading,
    isError: isDocumentsError,
    refetch: refetchDocuments,
  } = useQuery<BailenDocumentsResponse>({
    queryKey: ["bailen-documents"],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/bailen/project/getDocuments`,
        {
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch Bailen documents.");
      }

      return data;
    },
  });


  const {
    data: cadastralData,
    isLoading: isCadastralLoading,
    isError: isCadastralError,
    refetch: refetchCadastral,
  } = useQuery<BailenCadastralLotNumbersResponse>({
    queryKey: ["bailen-cadastral-lot-numbers"],
    queryFn: async () => {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/bailen/project/getCadastralLotNumber`,
        {
          credentials: "include",
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch cadastral lot numbers.");
      }

      return data;
    },
  });

  const project = projectData?.data;
  const defaultDocuments = documentsData?.data || [];
  const cadastralLotNumbers = cadastralData?.data || [];

  const requiredDocuments = defaultDocuments.filter(
    (document) => Number(document.document_is_required) === 1
  );

  const optionalDocuments = defaultDocuments.filter(
    (document) => Number(document.document_is_required) !== 1
  );

  const activeDocuments = defaultDocuments.filter(
    (document) => document.document_status === "active"
  );

  const isLoading = isProjectLoading || isDocumentsLoading || isCadastralLoading;
  const isError = isProjectError || isDocumentsError || isCadastralError;

  const overviewCards = [
    {
      label: "Total Listings",
      value: "128",
      helper: "All registered Bailen lots",
      icon: FiGrid,
    },
    {
      label: "Available Lots",
      value: "84",
      helper: "Ready for reservation",
      icon: FiCheckCircle,
    },
    {
      label: "Reserved",
      value: "21",
      helper: "Pending buyer completion",
      icon: FiClock,
    },
    {
      label: "Total Value",
      value: "₱72.4M",
      helper: "Current inventory value",
      icon: FiTrendingUp,
    },
  ];

  const inventoryStatus = [
    { label: "Available", value: 84, width: "66%" },
    { label: "Reserved", value: 21, width: "18%" },
    { label: "Active", value: 16, width: "12%" },
    { label: "Hold", value: 7, width: "6%" },
  ];

  const projectDetails = [
    {
      label: "Project Name",
      value: project?.project_bailen_name || "-",
    },
    {
      label: "Location",
      value: project?.project_bailen_location || "-",
    },
    {
      label: "Location Code",
      value: project?.project_bailen_location_code || "-",
    },
    {
      label: "Cadastral Lot Numbers",
      value:
        cadastralLotNumbers.length > 0
          ? cadastralLotNumbers
              .map((item) => item.bailen_cadastral_lot_number)
              .join(", ")
          : "-",
    },
    {
      label: "Administrator",
      value: project?.project_bailen_administrator_name || "-",
    },
    {
      label: "Tax Declaration No.",
      value: project?.project_bailen_tax_declaration_no || "-",
    },
    {
      label: "PIN",
      value: project?.project_bailen_pin || "-",
    },
    {
      label: "Status",
      value: project?.project_bailen_status || "-",
    },
  ];

  const recentActivities = [
    {
      title: "Bailen project details ready",
      description: "Project information and document requirements are loaded.",
      time: "Today",
    },
    {
      title: `${defaultDocuments.length} default documents configured`,
      description: "These documents apply as the default Bailen checklist.",
      time: "Today",
    },
    {
      title: `${cadastralLotNumbers.length} cadastral lot numbers configured`,
      description: "These are selectable when adding or editing Bailen listings.",
      time: "Today",
    },
    {
      title: "Listing summary placeholder active",
      description: "Connect the listing summary endpoint once the API is ready.",
      time: "System",
    },
  ];

  const handleRefresh = () => {
    refetchProject();
    refetchDocuments();
    refetchCadastral();
  };

  if (isLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-sm font-bold text-slate-700">
            Loading Bailen dashboard...
          </p>
        </div>
      </main>
    );
  }

  if (isError) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center">
        <div className="w-full max-w-md rounded-3xl border border-red-200 bg-white p-6 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-600">
            <FiAlertCircle className="h-7 w-7" />
          </div>

          <h2 className="mt-4 text-xl font-bold text-slate-950">
            Failed to load Bailen dashboard
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Check the Bailen project API, then refresh the dashboard.
          </p>

          <button
            type="button"
            onClick={handleRefresh}
            className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white duration-150 hover:bg-blue-700"
          >
            <FiRefreshCcw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </main>
    );
  }

  return (
    <>
      {isEditProjectModalOpen && (
        <EditProject
          setIsEditProjectModalOpen={setIsEditProjectModalOpen}
        />
      )}

      <main className="flex flex-col gap-6">
        <section className="overflow-hidden rounded-3xl border border-emerald-100 bg-white shadow-sm">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 via-emerald-500 to-slate-900" />

            <div className="relative grid gap-6 p-6 text-white lg:grid-cols-[1.5fr_0.8fr] lg:p-8">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                  <FiMap className="h-4 w-4" />
                  Bailen Project Dashboard
                </div>

                <h1 className="mt-5 max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                  Manage Bailen lots, project records, and inventory status.
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-emerald-50">
                  Track lot counts, project details, document requirements, and
                  recent updates in one project workspace.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition hover:bg-emerald-50"
                  >
                    View Listings
                    <FiArrowUpRight className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEditProjectModalOpen(true)}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                  >
                    <FiEdit2 className="h-4 w-4" />
                    Edit Details
                  </button>
                </div>
              </div>

              <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur">
                <p className="text-sm font-bold text-emerald-50">
                  Project Health
                </p>

                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-4xl font-bold capitalize">
                      {project?.project_bailen_status || "Active"}
                    </p>
                    <p className="mt-1 text-sm text-emerald-50">
                      Current project status
                    </p>
                  </div>

                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-700">
                    <FiBarChart2 className="h-8 w-8" />
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs text-emerald-50">Location Code</p>
                    <p className="mt-1 text-xl font-bold">
                      {project?.project_bailen_location_code || "LA"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white/10 p-4">
                    <p className="text-xs text-emerald-50">Default Docs</p>
                    <p className="mt-1 text-xl font-bold">
                      {defaultDocuments.length}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-500">
                      {card.label}
                    </p>

                    <h2 className="mt-3 text-3xl font-bold text-slate-950">
                      {card.value}
                    </h2>
                  </div>

                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-500">{card.helper}</p>
              </div>
            );
          })}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Inventory Status
                </h2>

                <p className="text-sm text-slate-500">
                  Current Bailen lot movement by status.
                </p>
              </div>

              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                View Report
                <FiArrowUpRight className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-5">
              {inventoryStatus.map((item) => (
                <div key={item.label}>
                  <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                    <p className="font-bold text-slate-700">{item.label}</p>
                    <p className="font-bold text-slate-950">{item.value}</p>
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-emerald-600"
                      style={{ width: item.width }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Document Summary
                </h2>

                <p className="text-sm text-slate-500">
                  Default project requirements.
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <FiFileText className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">Total</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {defaultDocuments.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">Required</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {requiredDocuments.length}
                </p>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-500">Active</p>
                <p className="mt-2 text-3xl font-bold text-slate-950">
                  {activeDocuments.length}
                </p>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-bold text-emerald-800">
                Default checklist is ready
              </p>

              <p className="mt-1 text-sm text-emerald-700">
                {requiredDocuments.length} required and{" "}
                {optionalDocuments.length} optional document
                {optionalDocuments.length === 1 ? "" : "s"} are assigned.
              </p>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Project Details
                </h2>

                <p className="text-sm text-slate-500">
                  Main Bailen project information.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsEditProjectModalOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
              >
                <FiEdit2 className="h-4 w-4" />
                Edit Details
              </button>
            </div>

            <div className="mt-5 divide-y divide-slate-100">
              {projectDetails.map((detail) => (
                <div
                  key={detail.label}
                  className="grid gap-1 py-3 sm:grid-cols-[170px_1fr]"
                >
                  <p className="text-sm font-semibold text-slate-500">
                    {detail.label}
                  </p>

                  <p
                    className={[
                      "text-sm font-bold",
                      detail.label === "Status" &&
                      detail.value.toLowerCase() === "active"
                        ? "text-emerald-700"
                        : "text-slate-950",
                    ].join(" ")}
                  >
                    {detail.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Recent Activity
                </h2>

                <p className="text-sm text-slate-500">
                  Latest project actions.
                </p>
              </div>

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
                <FiUsers className="h-6 w-6" />
              </div>
            </div>

            <div className="mt-6 space-y-4">
              {recentActivities.map((activity) => (
                <div
                  key={activity.title}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-950">
                        {activity.title}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {activity.description}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      {activity.time}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                Default Documents
              </h2>

              <p className="text-sm text-slate-500">
                Documents assigned to Bailen by default.
              </p>
            </div>

          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {defaultDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center md:col-span-2 xl:col-span-3">
                <FiFileText className="mx-auto h-8 w-8 text-slate-300" />

                <p className="mt-3 font-bold text-slate-700">
                  No default documents yet
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  Click Edit Documents to assign requirements.
                </p>
              </div>
            ) : (
              defaultDocuments.map((document) => (
                <div
                  key={document.default_document_id}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-bold leading-5 text-slate-950">
                        {document.document_name}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        {document.document_description || "No description"}
                      </p>
                    </div>

                    <span
                      className={[
                        "shrink-0 rounded-full px-3 py-1 text-xs font-bold",
                        document.document_status === "active"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700",
                      ].join(" ")}
                    >
                      {document.document_status}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <span
                      className={[
                        "rounded-full px-3 py-1 text-xs font-bold",
                        Number(document.document_is_required) === 1
                          ? "bg-blue-50 text-blue-700"
                          : "bg-slate-100 text-slate-600",
                      ].join(" ")}
                    >
                      {Number(document.document_is_required) === 1
                        ? "Required"
                        : "Optional"}
                    </span>

                    <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-slate-500">
                      Library Doc #{document.document_id}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </>
  );
};

export default Dashboard;
