import { useState } from "react";
import {
  FiEdit2,
  FiEye,
  FiMap,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import { GrDocumentText } from "react-icons/gr";
import PageHeader from "../components/PageHeader";
import InputLabel from "../components/InputLabel";

const Projects = () => {
  const [search, setSearch] = useState("");
  const [isAddProjectModalOpen, setIsAddProjectModalOpen] = useState(false)

  const projects = [
    {
      id: 1,
      name: "Maragondon",
      location: "Maragondon, Cavite",
      location_code: "PE",
      default_docs: 9,
      required_docs: 9,
      status: "active",
    },
    {
      id: 2,
      name: "Bailen",
      location: "Bailen, Cavite",
      location_code: "LA",
      default_docs: 9,
      required_docs: 9,
      status: "active",
    },
  ];

  const stats = [
    {
      label: "Total Projects",
      value: projects.length,
    },
    {
      label: "Active",
      value: projects.filter((project) => project.status === "active").length,
    },
    {
      label: "Inactive",
      value: projects.filter((project) => project.status === "inactive").length,
    },
    {
      label: "Required Docs",
      value: projects.reduce(
        (total, project) => total + project.required_docs,
        0
      ),
    },
  ];

  return (
    <>
        <main className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex-1">
            <PageHeader
                title="Projects"
                description="Create projects and configure their default document requirements"
                icon={FiMap}
            />
            </div>

            <button
            type="button"
            onClick={() => { setIsAddProjectModalOpen(true) }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 sm:w-fit"
            >
            <FiPlus className="h-4 w-4" />
            Add Project
            </button>
        </div>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
            <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg"
            >
                <p className="text-sm font-bold text-slate-500">{stat.label}</p>
                <h3 className="mt-4 text-3xl font-black text-slate-950">
                {stat.value}
                </h3>
            </div>
            ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
                <FiSearch className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, location, administrator, tax no, pin..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
            </div>

            <select
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100 lg:w-52"
            >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
            </select>

            <button
                type="button"
                onClick={() => {
                setSearch("");
                }}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
                <FiSearch className="h-4 w-4" />
                Reset
            </button>
            </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
                <thead className="bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-sm font-bold text-slate-700">
                    <th className="px-5 py-4">Name</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Location Code</th>
                    <th className="px-5 py-4">Default Docs</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Actions</th>
                </tr>
                </thead>

                <tbody>
                {projects.map((project) => (
                    <tr
                    key={project.id}
                    className="border-b border-slate-100 transition hover:bg-slate-50 last:border-b-0"
                    >
                    <td className="px-5 py-4 font-bold text-slate-950">
                        {project.name}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                        {project.location}
                    </td>

                    <td className="px-5 py-4">
                        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700">
                        {project.location_code}
                        </span>
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                        {project.default_docs} docs / {project.required_docs} required
                    </td>

                    <td className="px-5 py-4">
                        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        Active
                        </span>
                    </td>

                    <td className="px-5 py-4">
                        <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <FiEye className="h-4 w-4" />
                            Details
                        </button>

                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                        >
                            <FiEdit2 className="h-4 w-4" />
                            Edit
                        </button>

                        <button
                            type="button"
                            className="inline-flex h-10 items-center gap-2 rounded-lg bg-red-600 px-3 text-sm font-bold text-white shadow-sm transition hover:bg-red-700"
                        >
                            <FiTrash2 className="h-4 w-4" />
                            Delete
                        </button>
                        </div>
                    </td>
                    </tr>
                ))}
                </tbody>
            </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 px-5 py-4 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
            <p>
                Showing 1-{projects.length} of {projects.length} records
            </p>

            <div className="flex items-center gap-2">
                <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none">
                <option>10</option>
                <option>25</option>
                <option>50</option>
                </select>

                <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
                Previous
                </button>

                <span className="h-10 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-950">
                Page 1 of 1
                </span>

                <button className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-400">
                Next
                </button>
            </div>
            </div>
        </section>
        </main>
        
        {
            isAddProjectModalOpen && <div className="flex justify-center items-center absolute z-50 inset-0 bg-[rgba(8,8,8,0.26)]">

                <div className="flex flex-col bg-white rounded-lg  p-4">

                    <div className="flex justify-between">
                        <h3 className="font-bold text-xl">ADD PROJECT</h3>
                        <FiX onClick={() => {setIsAddProjectModalOpen(false)}} className="bg-gray-100 px-2 py-1 h-8 w-10 border hover:bg-gray-300 duration-300 text-red-500 rounded-md cursor-pointer"/>
                    </div>

                    <div className="grid grid-cols-2 text-sm">
                        <div>
                            <section className="flex flex-col gap-3 ">
                                <div>
                                    <p className="font-semibold">Project Information</p>
                                    <p className="text-gray-600">Basic project details and status.</p>
                                </div>

                                <InputLabel label="Project name" type="text" placeholder=""/>
                                <InputLabel label="Location" type="text" placeholder=""/>
                                <InputLabel label="Location Code" type="text" placeholder="ex. LA, PE"/>
                                <InputLabel label="Administrator" type="text" placeholder="Enter admin name"/>
                                <InputLabel label="Tax declaration no." type="text" placeholder="AA-06-0005-xxxxx"/>
                                <InputLabel label="PIN" type="text" placeholder="022-06-0005-xxx-xx"/>

                                <div className="flex flex-col gap-1 ">
                                    <label className="font-bold text-gray-800 tracking-wider">Status</label>
                                    <select className="border border-gray-300 rounded-md py-2 px-3 outline-none focus:border-blue-600 focus:shadow-sm focus:shadow-blue-500 duration-150">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                            </section>

                            <section className="flex flex-col gap-1 bg-gray-100 border border-gray-100 rounded-md p-3">
                                <div className="flex items-center gap-2">
                                    <GrDocumentText />
                                    <h3 className="font-bold text-base"> Document Templates</h3>
                                </div>
                                <p className="text-gray-800">Select one or more templates. The selected documents appear on the right immediately.</p>

                                <div className="grid grid-cols-2 gap-2 my-4">
                                    <button className="border hover:bg-gray-700 hover:text-gray-50 duration-300 border-gray-400 rounded-md py-2 font-bold text-gray-700">Select All Templates</button>
                                    <button className="border hover:bg-gray-700 hover:text-gray-50 duration-300 border-gray-400 rounded-md py-2 font-bold text-gray-700">Clear Templates</button>
                                    <button className="border hover:bg-gray-700 hover:text-gray-50 duration-300 border-gray-400 rounded-md py-2 font-bold text-gray-700">Use All Library Docs</button>
                                </div>
                                
                                <InputLabel label="" type="text" placeholder="🔍 Search Templates..."/>

                                <div className="flex flex-col gap-2 mt-3">
                                    <div className="flex gap-4 items-start cursor-pointer hover:bg-blue-100 duration-300 py-2 px-3 border border-gray-300 rounded-md">
                                        <input type="checkbox" className=""/>
                                        <div>
                                            <p className="font-bold text-base">sample temp 2</p>
                                            <p className="font-semibold text-gray-600">No description</p>
                                            <p className="font-semibold">5 required / 5 docs</p>
                                        </div>
                                    </div>
                                </div>

                            </section>

                        </div>

                    </div>
                </div>
                
        </div>
        }
    </>
  );
};

export default Projects;