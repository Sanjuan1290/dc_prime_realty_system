import { FiX } from "react-icons/fi"

type Props = {
    setIsDetailsProjectModalOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const DetailsProjectModal = ({setIsDetailsProjectModalOpen} : Props) => {

    const details = [
    {
        name: "ID",
        value: 2,
    },
    {
        name: "Name",
        value: "Maragondon",
    },
    {
        name: "Location",
        value: "Maragondon, Cavite",
    },
    {
        name: "Location Code",
        value: "PE",
    },
    {
        name: "Administrator",
        value: "LINDA A. VILLMOAR",
    },
    {
        name: "Tax Declaration No.",
        value: "AA-23-0235-00105",
    },
    {
        name: "PIN",
        value: "032-26-0311-023-02",
    },
    {
        name: "Status",
        value: "active",
    },
    {
        name: "Document Template",
        value: "sample temp 2",
    },
    {
        name: "Default Documents",
        value: 9,
    },
    {
        name: "Required Documents",
        value: 9,
    },
    {
        name: "Ended At",
        value: "-",
    },
    {
        name: "Created At",
        value: "2026-06-17",
    },
    {
        name: "Updated At",
        value: "2026-06-17",
    },
];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-2xl">

            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-950">Project Details</h3>
                </div>

                <FiX onClick={() => {setIsDetailsProjectModalOpen(false)}} className="h-9 w-9 cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-slate-500 duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-600"/>
            </div>

            <div className="grid grid-cols-2 gap-2 items-center justify-center w-fit px-4 py-4">
                {
                    details.map(detail => (
                        <div className="flex gap-2">
                            <h3 className="font-semibold">{detail.name}</h3>
                            <p>{detail.value}</p>
                        </div>
                    ))
                }
            </div>
        </div>
    </div>
  )
}

export default DetailsProjectModal