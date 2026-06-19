import { FiBarChart2 } from "react-icons/fi"

const Dashboard = () => {
  return (
    <main className="ml-80 mt-20">
        <div className="flex gap-4 items-center">
            <FiBarChart2 className="text-blue-700 bg-white h-11 w-11 p-2 border rounded-lg "/>
            <div className="flex flex-col">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <p>Real-time system summary from MySQL</p>
            </div>
        </div>
    </main>
  )
}

export default Dashboard