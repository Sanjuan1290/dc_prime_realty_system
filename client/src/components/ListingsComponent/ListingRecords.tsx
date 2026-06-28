import { useState } from "react";
import { FaCircle } from "react-icons/fa6";

const ListingRecords = () => {

    const [tableHead, setTableHead] = useState([
        "Unit Type",
        "Unit ID",
        "Old Unit IDs",
        "Area",
        "Price Per SQM",
        "Net Selling Price",
        "LMF",
        "TCP",
        "Reservation Fee",
        "Project",
        "Status",
        "Action",
    ])
    const [tableBody, setTableBody] = useState([
        {
            unit_type: 'Inner',
            unit_id: 'LA-0203',
            old_unit_id: [
                'LA-204',
                'LA-202'
            ],
            area: 1000,
            price_per_sqm: 555,
            net_selling_price: 1000 * 555,
            LMF: .10,
            TCP: 610500,
            reservation_fee: 50000,
            project: 'Bailen',
            status: 'available'
        },{
            unit_type: 'Inner',
            unit_id: 'LA-0203',
            old_unit_id: [
                'LA-204',
                'LA-202'
            ],
            area: 1000,
            price_per_sqm: 555,
            net_selling_price: 1000 * 555,
            LMF: .10,
            TCP: 610500,
            reservation_fee: 50000,
            project: 'Bailen',
            status: 'available'
        },{
            unit_type: 'Inner',
            unit_id: 'LA-0203',
            old_unit_id: [
                'LA-204',
                'LA-202'
            ],
            area: 1000,
            price_per_sqm: 555,
            net_selling_price: 1000 * 555,
            LMF: .10,
            TCP: 610500,
            reservation_fee: 50000,
            project: 'Bailen',
            status: 'available'
        }
    ])
    const [records, setRecords] = useState([
        {
            unitType: "Inner",
            unitId: "LA-0203",
            oldUnitIds: "-",
            area: "1,000",
            pricePerSqm: "₱555.00",
            lmf: "10%",
            rs: "₱50,000.00",
            project: "Bailen",
            status: "Superseded",
        },
    ])


return (
  <div className="flex flex-col gap-5">
    {/* Filters */}
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        <input
          type="text"
          placeholder="Search unit ID..."
          className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
        />

        <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100">
          <option value="all_projects">All Projects</option>
          <option value="bailen">Bailen</option>
          <option value="maragondon">Maragondon</option>
        </select>

        <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100">
          <option value="all_lot_types">All Lot Types</option>
          <option value="inner">Inner</option>
          <option value="corner">Corner</option>
          <option value="end">End</option>
        </select>

        <select className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100">
          <option value="all_status">All Status</option>
          <option value="available">Available</option>
          <option value="reserved">Reserved</option>
          <option value="active">Active</option>
          <option value="hold">Hold</option>
          <option value="sold">Sold</option>
          <option value="inactive">Inactive</option>
          <option value="superseded">Superseded</option>
        </select>

        <button className="h-10 rounded-lg border border-gray-300 bg-gray-50 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-100 active:scale-[0.98]">
          Reset
        </button>
      </div>
    </div>

    {/* Table */}
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[1200px] border-collapse text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {tableHead.map((th) => (
                <th
                  key={th}
                  className="whitespace-nowrap border-b border-gray-200 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600"
                >
                  {th}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {tableBody.map((tb, index) => (
              <tr
                key={index}
                className="transition hover:bg-gray-50"
              >
                <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900">
                  {tb.unit_type}
                </td>

                <td className="whitespace-nowrap px-4 py-4 font-semibold text-gray-900">
                  {tb.unit_id}
                </td>

                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {tb.old_unit_id?.length ? (
                      tb.old_unit_id.map((oldId) => (
                        <span
                          key={oldId}
                          className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600"
                        >
                          {oldId}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                  {tb.area}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                  {tb.price_per_sqm}
                </td>

                <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900">
                  {tb.net_selling_price}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                  {tb.LMF}
                </td>

                <td className="whitespace-nowrap px-4 py-4 font-medium text-gray-900">
                  {tb.TCP}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                  {tb.reservation_fee}
                </td>

                <td className="whitespace-nowrap px-4 py-4 text-gray-700">
                  {tb.project}
                </td>

                <td className="whitespace-nowrap px-4 py-4">
                  <div className="inline-flex items-center gap-1.5 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold capitalize text-green-700">
                    <FaCircle className="text-[7px]" />
                    <span>{tb.status}</span>
                  </div>
                </td>

                <td className="whitespace-nowrap px-4 py-4">
                  <div className="flex items-center gap-2">
                    <button className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-100 active:scale-[0.97]">
                      Details
                    </button>

                    <button className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition hover:bg-blue-100 active:scale-[0.97]">
                      Edit
                    </button>

                    <button className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.97]">
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
}

export default ListingRecords