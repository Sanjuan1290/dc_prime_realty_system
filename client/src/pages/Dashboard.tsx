import { FiBarChart2 } from "react-icons/fi"
import { FaPesoSign } from "react-icons/fa6";
import { FiHome, FiCreditCard, FiUsers, FiFileText } from "react-icons/fi";

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
            { agent: 'Agent A1 One', role: 'Agent', total_sales: 490600, active: 1, cacelled: 0, commission_earned: 23300.00 },
            { agent: 'Agent A2 One', role: 'broker', total_sales: 490600, active: 1, cacelled: 0, commission_earned: 23300.00 },
            { agent: 'Agent A3 One', role: 'manager', total_sales: 490600, active: 1, cacelled: 0, commission_earned: 23300.00 },
            { agent: 'Agent A4 One', role: 'Agent', total_sales: 490600, active: 1, cacelled: 0, commission_earned: 23300.00 },
            { agent: 'Agent A5 One', role: 'Agent', total_sales: 490600, active: 1, cacelled: 0, commission_earned: 23300.00 },
    ]

  return (
    <main className="flex flex-col gap-8 ml-80 my-20 px-4">
        <div className="flex gap-4 items-center ">
            <FiBarChart2 className="text-blue-700 bg-white h-11 w-11 p-2 border rounded-lg "/>
            <div className="flex flex-col">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p>Real-time system summary from MySQL</p>
            </div>
        </div>

        <div className="grid grid-cols-4 gap-2 ">
            {
                stats.map(stat => {
                    const Icon = stat.icon

                    return <div className="flex flex-col  hover:cursor-pointer hover:shadow-lg hover:-translate-y-1 ease-in-out duration-300 border border-blue-200 hover:bg-blue-100 bg-gray-50 px-4 py-6 rounded-lg "> 
                        <div className="flex items-center justify-between w-full">
                            <div>
                                <p className="text-sm font-bold text-blue-800">{stat.label}</p>
                                <h3 className="font-bold text-2xl my-2 underline">{stat.total}</h3>
                            </div>
                            <Icon className="text-blue-700 bg-blue-100 w-10 h-10 p-2 rounded-lg mb-4"/>    
                        </div>

                        <p className="text-xs ">{stat.description}</p>
                    </div>
                }
                )
            }
        </div>

        <div className="flex flex-col border border-gray-300 rounded-lg bg-gray-50 ">
            <div className="grid grid-cols-6 border-b border-gray-300 bg-gray-50 px-4 py-3 font-semibold text-sm text-gray-600">
                <p>Agent</p>
                <p>Role</p>
                <p>Total Sales</p>
                <p>Active</p>
                <p>Cancelled</p>
                <p>Commission Earned</p>
            </div>

            
            {
                top_sales.map(ts => (
                    <div className="grid grid-cols-6 border-b border-gray-300 bg-gray-50 px-4 py-3 text-xs">
                        <p className="font-semibold">{ts.agent}</p>
                        <p>{ts.role}</p>
                        <p>{ts.total_sales}</p>
                        <p>{ts.active}</p>
                        <p>{ts.cacelled}</p>
                        <p>{ts.commission_earned}</p>
                    </div>
                ))
            }
        </div>

    </main>
  )
}

export default Dashboard