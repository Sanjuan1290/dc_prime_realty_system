import { useMemo, useState } from "react";
import PageHeader from "../../components/Shared/PageHeader";
import { FaUserPlus } from "react-icons/fa";
import { FiEye, FiSearch, FiUsers } from "react-icons/fi";

type SellerRole =
  | "Broker Network Manager"
  | "Broker"
  | "Manager"
  | "Agent";

type SellerStatus = "Active" | "Inactive";

type AccreditedSeller = {
  id: number;
  name: string;
  userName: string;
  email: string;
  contactNo: string;
  role: SellerRole;
  reportsUnder: string;
  group: string;
  poolRate: number;
  sellerRateLabel: string;
  sellerRate: number;
  accreditationDate: string;
  status: SellerStatus;
  updatedAt: string;
  updatedBy: string;
};

const sellers: AccreditedSeller[] = [
  {
    id: 1,
    name: "Rowena Cortez",
    userName: "Rowena Cortez",
    email: "rowena@gmail.com",
    contactNo: "09876565",
    role: "Broker Network Manager",
    reportsUnder: "None",
    group: "NORTH STAR GROUP",
    poolRate: 8,
    sellerRateLabel: "Broker Network Manager Rate",
    sellerRate: 8,
    accreditationDate: "2026-06-16",
    status: "Active",
    updatedAt: "2026-06-28",
    updatedBy: "Super Admin",
  },
  {
    id: 2,
    name: "PANGILINAN, JAN CYRILLE",
    userName: "PANGILINAN, JAN CYRILLE",
    email: "pangilinan@gmail.com",
    contactNo: "0987655565",
    role: "Agent",
    reportsUnder: "PARROCHO, JOSEPH E.",
    group: "SARTE, JOHN CHRISTOPHER GROUP",
    poolRate: 8,
    sellerRateLabel: "Agent Rate",
    sellerRate: 5,
    accreditationDate: "2026-06-10",
    status: "Active",
    updatedAt: "2026-06-28",
    updatedBy: "Super Admin",
  },
  {
    id: 3,
    name: "CANTIGA, ROLINDA, C.",
    userName: "CANTIGA, ROLINDA, C.",
    email: "rolinda@gmail.com",
    contactNo: "0987658765",
    role: "Agent",
    reportsUnder: "PARROCHO, JOSEPH E.",
    group: "SARTE, JOHN CHRISTOPHER GROUP",
    poolRate: 8,
    sellerRateLabel: "Agent Rate",
    sellerRate: 5,
    accreditationDate: "2026-06-08",
    status: "Active",
    updatedAt: "2026-06-28",
    updatedBy: "Super Admin",
  },
  {
    id: 4,
    name: "PARROCHO, JOSEPH E.",
    userName: "PARROCHO, JOSEPH E.",
    email: "joseph@gmail.com",
    contactNo: "098765878",
    role: "Manager",
    reportsUnder: "SARTE, JOHN CHRISTOPHER",
    group: "SARTE, JOHN CHRISTOPHER GROUP",
    poolRate: 8,
    sellerRateLabel: "Manager Rate",
    sellerRate: 7,
    accreditationDate: "2026-06-21",
    status: "Active",
    updatedAt: "2026-06-28",
    updatedBy: "Super Admin",
  },
  {
    id: 5,
    name: "SARTE, JOHN CHRISTOPHER",
    userName: "SARTE, JOHN CHRISTOPHER",
    email: "johnchrist@gmail.com",
    contactNo: "09057545656",
    role: "Broker",
    reportsUnder: "None",
    group: "SARTE, JOHN CHRISTOPHER GROUP",
    poolRate: 8,
    sellerRateLabel: "Broker Rate",
    sellerRate: 8,
    accreditationDate: "2024-12-31",
    status: "Active",
    updatedAt: "2026-06-28",
    updatedBy: "Super Admin",
  },
];

const Accredited = () => {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"All roles" | SellerRole>(
    "All roles"
  );
  const [statusFilter, setStatusFilter] = useState<
    "All statuses" | SellerStatus
  >("All statuses");

  const filteredSellers = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return sellers.filter((seller) => {
      const matchesSearch =
        !keyword ||
        seller.name.toLowerCase().includes(keyword) ||
        seller.email.toLowerCase().includes(keyword) ||
        seller.role.toLowerCase().includes(keyword) ||
        seller.reportsUnder.toLowerCase().includes(keyword) ||
        seller.group.toLowerCase().includes(keyword);

      const matchesRole =
        roleFilter === "All roles" || seller.role === roleFilter;

      const matchesStatus =
        statusFilter === "All statuses" || seller.status === statusFilter;

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [search, roleFilter, statusFilter]);

  const activeCount = sellers.filter((seller) => seller.status === "Active").length;
  const inactiveCount = sellers.filter(
    (seller) => seller.status === "Inactive"
  ).length;

  const roleBreakdown = [
    {
      label: "BNM",
      value: sellers.filter((seller) => seller.role === "Broker Network Manager")
        .length,
      description: "Broker Network Manager",
    },
    {
      label: "Brokers",
      value: sellers.filter((seller) => seller.role === "Broker").length,
      description: "Broker group leaders",
    },
    {
      label: "Managers",
      value: sellers.filter((seller) => seller.role === "Manager").length,
      description: "Unit managers",
    },
    {
      label: "Agents",
      value: sellers.filter((seller) => seller.role === "Agent").length,
      description: "Frontline sellers",
    },
  ];

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={"Accredited Sellers"}
        description={
          "Read-only seller directory. Rates are managed by Seller Groups in User Management."
        }
        icon={FaUserPlus}
      />

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.5fr]">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">
                  Total Sellers
                </p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">
                  {sellers.length}
                </h3>
              </div>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FiUsers className="h-5 w-5" />
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              All accredited seller records
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">Active</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">
                  {activeCount}
                </h3>
              </div>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FiUsers className="h-5 w-5" />
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Can be assigned to clients
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-500">Inactive</p>
                <h3 className="mt-2 text-2xl font-bold text-slate-950">
                  {inactiveCount}
                </h3>
              </div>

              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                <FiUsers className="h-5 w-5" />
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-500">
              Hidden from active assignment
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-slate-600">
                Role Breakdown
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Count per commission hierarchy level.
              </p>
            </div>

            <span className="rounded-lg bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
              {sellers.length} total
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {roleBreakdown.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-slate-200 bg-slate-50 p-4"
              >
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {item.label}
                </p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {item.value}
                </h4>
                <p className="mt-2 text-xs text-slate-500">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="grid gap-3 xl:grid-cols-[1fr_180px_180px]">
          <label className="relative block">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              type="text"
              placeholder="Search sellers, users, roles, reports under, or group..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <select
            value={roleFilter}
            onChange={(event) =>
              setRoleFilter(event.target.value as "All roles" | SellerRole)
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="All roles">All roles</option>
            <option value="Broker Network Manager">
              Broker Network Manager
            </option>
            <option value="Broker">Broker</option>
            <option value="Manager">Manager</option>
            <option value="Agent">Agent</option>
          </select>

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(
                event.target.value as "All statuses" | SellerStatus
              )
            }
            className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
          >
            <option value="All statuses">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <div className="min-w-[1450px]">
              <div className="grid grid-cols-[1.25fr_1.1fr_1.15fr_1.45fr_1.85fr_0.75fr_0.6fr_0.7fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-700">
                <p>Seller</p>
                <p>Contact</p>
                <p>Role</p>
                <p>Reports Under</p>
                <p>Seller Group / Commission Setup</p>
                <p>Accreditation</p>
                <p>Status</p>
                <p className="text-right">Actions</p>
              </div>

              <div className="divide-y divide-slate-100">
                {filteredSellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="grid grid-cols-[1.25fr_1.1fr_1.15fr_1.45fr_1.85fr_0.75fr_0.6fr_0.7fr] items-center px-4 py-5 text-sm transition hover:bg-slate-50"
                  >
                    <div>
                      <p className="font-bold uppercase text-slate-950">
                        {seller.name}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        User: {seller.userName}
                      </p>
                    </div>

                    <div>
                      <p className="font-medium text-slate-700">
                        {seller.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {seller.contactNo}
                      </p>
                    </div>

                    <p className="font-medium text-slate-700">{seller.role}</p>

                    <div>
                      <p className="font-medium text-slate-700">
                        {seller.reportsUnder}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Managed through User Management
                      </p>
                    </div>

                    <div>
                      <p className="text-sm text-slate-700">
                        Group:{" "}
                        <span className="font-bold text-slate-950">
                          {seller.group}
                        </span>
                      </p>

                      <p className="text-sm text-slate-700">
                        Pool:{" "}
                        <span className="font-bold text-slate-950">
                          {seller.poolRate}%
                        </span>
                      </p>

                      <p className="text-sm text-slate-700">
                        {seller.sellerRateLabel}:{" "}
                        <span className="font-bold text-slate-950">
                          {seller.sellerRate}%
                        </span>
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Updated {seller.updatedAt} by {seller.updatedBy}
                      </p>
                    </div>

                    <p className="font-medium text-slate-700">
                      {seller.accreditationDate}
                    </p>

                    <div>
                      <span
                        className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
                          seller.status === "Active"
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                        }`}
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {seller.status}
                      </span>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                      >
                        <FiEye className="h-3.5 w-3.5" />
                        Details
                      </button>
                    </div>
                  </div>
                ))}

                {filteredSellers.length === 0 && (
                  <div className="px-4 py-12 text-center">
                    <p className="font-bold text-slate-700">
                      No accredited sellers found.
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      Try changing your search or filters.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Showing 1-{filteredSellers.length} of {filteredSellers.length}{" "}
              records
            </p>

            <div className="flex items-center gap-2">
              <select className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none">
                <option>10</option>
                <option>25</option>
                <option>50</option>
              </select>

              <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
                Previous
              </button>

              <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700">
                Page 1 of 1
              </button>

              <button className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
                Next
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Accredited;