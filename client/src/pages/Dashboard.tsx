import { FiBarChart2 } from "react-icons/fi";
import { FaPesoSign } from "react-icons/fa6";
import { FiHome, FiCreditCard, FiUsers, FiFileText } from "react-icons/fi";

import PageHeader from "../components/PageHeader";

const Dashboard = () => {
  const stats = [
    {
      label: "Total Sales",
      total: "₱490,600.00",
      description:
        "Contract value from active, reserved, paid, and closed client units",
      icon: FaPesoSign,
    },
    {
      label: "Pending Sales",
      total: "₱0.00",
      description: "Reserved client-unit contract value",
      icon: FiHome,
    },
    {
      label: "Tracked Collections",
      total: "₱490,600.00",
      description: "100.00% collection progress",
      icon: FiCreditCard,
    },
    {
      label: "Clients",
      total: "1",
      description: "Registered client records",
      icon: FiUsers,
    },
    {
      label: "Listed Lot Value",
      total: "₱490,600.00",
      description: "All non-inactive listings",
      icon: FiHome,
    },
    {
      label: "Available Lot Value",
      total: "₱0.00",
      description: "Available inventory value",
      icon: FiHome,
    },
    {
      label: "Sold Lot Value",
      total: "₱490,600.00",
      description: "Sold inventory value",
      icon: FaPesoSign,
    },
    {
      label: "Pending Documents",
      total: "9",
      description: "Not submitted or rejected checklist items",
      icon: FiFileText,
    },
    {
      label: "Total Commission",
      total: "₱35,680.00",
      description: "Full commission liability, including future releases",
      icon: FaPesoSign,
    },
    {
      label: "Eligible",
      total: "₱10,035.00",
      description: "Only eligible commission releases ready to pay",
      icon: FaPesoSign,
    },
    {
      label: "Commission Released",
      total: "₱5,575.00",
      description: "Already released commission value",
      icon: FaPesoSign,
    },
    {
      label: "Cash Advance Deducted",
      total: "₱16,725.00",
      description: "Cash advances already deducted from commission releases",
      icon: FiCreditCard,
    },
    {
      label: "Net Remaining",
      total: "₱13,380.00",
      description: "Commission still payable after released amounts and cash advances",
      icon: FaPesoSign,
    },
  ];

  const top_sales = [
    {
      agent: "Agent A1 One",
      role: "Agent",
      total_sales: 490600,
      active: 1,
      cacelled: 0,
      commission_earned: 23300.0,
    },
    {
      agent: "Agent A2 One",
      role: "broker",
      total_sales: 490600,
      active: 1,
      cacelled: 0,
      commission_earned: 23300.0,
    },
    {
      agent: "Agent A3 One",
      role: "manager",
      total_sales: 490600,
      active: 1,
      cacelled: 0,
      commission_earned: 23300.0,
    },
    {
      agent: "Agent A4 One",
      role: "Agent",
      total_sales: 490600,
      active: 1,
      cacelled: 0,
      commission_earned: 23300.0,
    },
    {
      agent: "Agent A5 One",
      role: "Agent",
      total_sales: 490600,
      active: 1,
      cacelled: 0,
      commission_earned: 23300.0,
    },
  ];

  return (
    <main className="flex flex-col gap-6">
        
      <PageHeader title={'Dashboard'} description="Real-time system summary from MySQL" icon={FiBarChart2}/>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div
              key={stat.label}
              className="group flex min-h-[170px] cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-slate-600">
                    {stat.label}
                  </p>

                  <h3 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
                    {stat.total}
                  </h3>
                </div>

                <Icon className="h-11 w-11 shrink-0 rounded-xl bg-blue-50 p-2.5 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white" />
              </div>

              <div className="mt-4">
                <p className="text-sm leading-5 text-slate-500">
                  {stat.description}
                </p>

                <button
                  type="button"
                  className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  Click to view formula
                </button>
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Top Sales</h2>
            <p className="text-sm text-slate-500">
              Seller performance and commission summary
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[850px]">
            <div className="grid grid-cols-6 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Agent</p>
              <p>Role</p>
              <p>Total Sales</p>
              <p>Active</p>
              <p>Cancelled</p>
              <p>Commission Earned</p>
            </div>

            {top_sales.map((ts) => (
              <div
                key={`${ts.agent}-${ts.role}`}
                className="grid grid-cols-6 border-b border-slate-100 px-5 py-4 text-sm text-slate-600 transition hover:bg-slate-50 last:border-b-0"
              >
                <p className="font-semibold text-slate-950">{ts.agent}</p>
                <p className="capitalize">{ts.role}</p>
                <p>₱{ts.total_sales.toLocaleString()}</p>
                <p>{ts.active}</p>
                <p>{ts.cacelled}</p>
                <p>₱{ts.commission_earned.toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
};

export default Dashboard;