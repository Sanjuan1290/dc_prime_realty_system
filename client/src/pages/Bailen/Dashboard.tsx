import {
  FiArrowUpRight,
  FiBarChart2,
  FiCheckCircle,
  FiClock,
  FiFileText,
  FiGrid,
  FiMap,
  FiTrendingUp,
  FiUsers,
} from "react-icons/fi";

const Dashboard = () => {
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
    { label: "Project Name", value: "Bailen" },
    { label: "Location", value: "Bailen, Cavite" },
    { label: "Location Code", value: "LA" },
    { label: "Administrator", value: "LINDA A. VILLMOAR" },
    { label: "Tax Declaration No.", value: "AA-23-0235-00105" },
    { label: "PIN", value: "032-26-0311-023-02" },
  ];

  const recentActivities = [
    {
      title: "Listing LA-0203 updated",
      description: "Price per sqm and lot status were reviewed.",
      time: "Today",
    },
    {
      title: "Document checklist reviewed",
      description: "Required buyer documents checked for Bailen.",
      time: "Today",
    },
    {
      title: "Cadastral lot CAD-004 added",
      description: "New cadastral lot number added to the project.",
      time: "Yesterday",
    },
  ];

  return (
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
                Track lot counts, sales movement, project details, document requirements,
                and recent updates in one project workspace.
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
                  className="inline-flex items-center gap-2 rounded-xl border border-white/25 bg-white/10 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15"
                >
                  Project Details
                </button>
              </div>
            </div>

            <div className="rounded-3xl border border-white/20 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm font-bold text-emerald-50">Project Health</p>

              <div className="mt-5 flex items-end justify-between gap-4">
                <div>
                  <p className="text-4xl font-bold">Active</p>
                  <p className="mt-1 text-sm text-emerald-50">Current project status</p>
                </div>

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-emerald-700">
                  <FiBarChart2 className="h-8 w-8" />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-emerald-50">Location Code</p>
                  <p className="mt-1 text-xl font-bold">LA</p>
                </div>

                <div className="rounded-2xl bg-white/10 p-4">
                  <p className="text-xs text-emerald-50">Cadastral Lots</p>
                  <p className="mt-1 text-xl font-bold">4</p>
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
                  <p className="text-sm font-semibold text-slate-500">{card.label}</p>
                  <h2 className="mt-3 text-3xl font-bold text-slate-950">{card.value}</h2>
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
              <h2 className="text-lg font-bold text-slate-950">Inventory Status</h2>
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
              <h2 className="text-lg font-bold text-slate-950">Document Summary</h2>
              <p className="text-sm text-slate-500">Default project requirements.</p>
            </div>

            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
              <FiFileText className="h-6 w-6" />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Default Docs</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">3</p>
            </div>

            <div className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-500">Templates</p>
              <p className="mt-2 text-3xl font-bold text-slate-950">2</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-800">
              Required for Submission
            </p>
            <p className="mt-1 text-sm text-emerald-700">
              Standard buyer document set is active.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Project Details</h2>
          <p className="text-sm text-slate-500">Main Bailen project information.</p>

          <div className="mt-5 divide-y divide-slate-100">
            {projectDetails.map((detail) => (
              <div
                key={detail.label}
                className="grid gap-1 py-3 sm:grid-cols-[160px_1fr]"
              >
                <p className="text-sm font-semibold text-slate-500">{detail.label}</p>
                <p className="text-sm font-bold text-slate-950">{detail.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Recent Activity</h2>
              <p className="text-sm text-slate-500">Latest project actions.</p>
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
                    <p className="font-bold text-slate-950">{activity.title}</p>
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
    </main>
  );
};

export default Dashboard;