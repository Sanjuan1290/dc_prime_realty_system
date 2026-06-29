import { useState } from "react";
import {
  FiEdit2,
  FiEye,
  FiMap,
  FiSearch
} from "react-icons/fi";
import PageHeader from "../../components/Shared/PageHeader";
import EditProjectModal from "../../components/Shared/ProjectsComponent/EditProjectModal";
import DetailsProjectModal from "../../components/Shared/ProjectsComponent/DetailsProjectModal";
import { NavLink } from "react-router-dom";

const Projects = () => {
  const [search, setSearch] = useState("");
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false)
  const [isDetailsProjectModalOpen, setIsDetailsProjectModalOpen] = useState(false)

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
                            <NavLink
                                to="/Bailen"
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                                <FiEye className="h-4 w-4" />
                                Go to this Project
                            </NavLink>

                            <button
                                type="button"
                                onClick={() => {setIsDetailsProjectModalOpen(true)}}
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                                <FiEye className="h-4 w-4" />
                                Details
                            </button>

                            <button
                                type="button"
                                onClick={() => {setIsEditProjectModalOpen(true)}}
                                className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                            >
                                <FiEdit2 className="h-4 w-4" />
                                Edit
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
            isEditProjectModalOpen && <EditProjectModal setIsEditProjectModalOpen={setIsEditProjectModalOpen}/>
        }

        {
            isDetailsProjectModalOpen && <DetailsProjectModal setIsDetailsProjectModalOpen={setIsDetailsProjectModalOpen}/>
        }
    </>
  );
};

export default Projects;