import {
  FiX,
} from "react-icons/fi";

import InputLabel from "../InputLabel";
import { GrDocumentText } from "react-icons/gr";

type Props = {
    setIsEditProjectModalOpen: React.Dispatch<React.SetStateAction<boolean>>
}

const EditProjectModal = ({ setIsEditProjectModalOpen } : Props) => {

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">

                <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">

                    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                        <div>
                          <h3 className="text-lg font-black tracking-tight text-slate-950">ADD PROJECT</h3>
                          <p className="mt-1 text-sm text-slate-500">Create project details and default document requirements.</p>
                        </div>

                        <FiX onClick={() => {setIsEditProjectModalOpen(false)}} className="h-9 w-9 cursor-pointer rounded-xl border border-slate-200 bg-white p-2 text-slate-500 duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-600"/>
                    </div>

                    <div className="grid max-h-[calc(92vh-74px)] grid-cols-1 gap-4 overflow-y-auto p-4 text-sm lg:grid-cols-[430px_1fr]">
                        <div className="space-y-4">
                            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                <div>
                                    <p className="font-bold text-slate-950">Project Information</p>
                                    <p className="text-sm text-slate-500">Basic project details and status.</p>
                                </div>

                                <InputLabel label="Project name" type="text" placeholder=""/>
                                <InputLabel label="Location" type="text" placeholder=""/>
                                <InputLabel label="Location Code" type="text" placeholder="ex. LA, PE"/>
                                <InputLabel label="Administrator" type="text" placeholder="Enter admin name"/>
                                <InputLabel label="Tax declaration no." type="text" placeholder="AA-06-0005-xxxxx"/>
                                <InputLabel label="PIN" type="text" placeholder="022-06-0005-xxx-xx"/>

                                <div className="flex flex-col gap-1">
                                    <label className="text-sm font-bold tracking-wide text-slate-700">Status</label>
                                    <select className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none duration-150 focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>

                            </section>

                            <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                                <div className="flex items-start gap-2">
                                    <GrDocumentText className="mt-1 text-slate-700" />
                                    <div>
                                      <h3 className="font-bold text-slate-950">Document Templates</h3>
                                      <p className="mt-1 text-sm text-slate-500">Select one or more templates. The selected documents appear on the right immediately.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm duration-300 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">Select All Templates</button>
                                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm duration-300 hover:border-red-200 hover:bg-red-50 hover:text-red-700">Clear Templates</button>
                                    <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 shadow-sm duration-300 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 sm:col-span-2">Use All Library Docs</button>
                                </div>
                                
                                <InputLabel label="" type="text" placeholder="🔍 Search Templates..."/>

                                <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
                                    <div className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm duration-300 hover:border-blue-200 hover:bg-blue-50">
                                        <input type="checkbox" className="mt-1 h-4 w-4 cursor-pointer"/>
                                        <div>
                                            <p className="font-bold text-slate-950">sample temp 1</p>
                                            <p className="text-xs font-semibold text-slate-500">No description</p>
                                            <p className="mt-2 text-xs font-bold text-slate-600">5 required / 5 docs</p>
                                        </div>
                                    </div>

                                    <div className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm duration-300 hover:border-blue-200 hover:bg-blue-50">
                                        <input type="checkbox" className="mt-1 h-4 w-4 cursor-pointer"/>
                                        <div>
                                            <p className="font-bold text-slate-950">sample temp 2</p>
                                            <p className="text-xs font-semibold text-slate-500">No description</p>
                                            <p className="mt-2 text-xs font-bold text-slate-600">5 required / 5 docs</p>
                                        </div>
                                    </div>
                                </div>

                            </section>
                        </div>

                        <div className="flex min-h-0 flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 xl:flex-row xl:items-start xl:justify-between">
                                <div className="flex flex-col gap-1 text-slate-500">
                                    <div className="flex items-center gap-2 text-base text-slate-950">
                                        <GrDocumentText />
                                        <h3 className="font-bold">Default Document Requirements</h3>
                                    </div>
                                    <p className="text-sm">These become the default checklist for listings created</p>
                                    <p className="text-sm">under this project. Listings can still be customized later.</p>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <p className="rounded-full bg-blue-50 px-3 py-1 text-center text-xs font-bold text-blue-700">2 templates</p>
                                    <p className="rounded-full bg-emerald-50 px-3 py-1 text-center text-xs font-bold text-emerald-700">9 required</p>
                                    <p className="rounded-full bg-slate-100 px-3 py-1 text-center text-xs font-bold text-slate-600">0 optional</p>
                                </div>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <div className="flex items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                                    <p className="text-xs font-bold text-blue-700">sample temp 1</p>
                                    <FiX className="cursor-pointer text-blue-500 hover:text-blue-800"/>
                                </div>
                                <div className="flex items-center justify-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1">
                                    <p className="text-xs font-bold text-blue-700">sample temp 2</p>
                                    <FiX className="cursor-pointer text-blue-500 hover:text-blue-800"/>
                                </div>
                            </div>

                            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                                <div className="flex flex-col gap-1">
                                    <h3 className="font-bold text-slate-950">Add Existing Documents</h3>
                                    <p className="text-xs text-slate-500">Create missing documents in Document Library first, then search and add them here.</p>

                                    <input type="text" placeholder="🔍 Search document library..." className="mt-2 h-10 w-full rounded-lg border border-slate-200 bg-white px-4 text-sm outline-none duration-150 placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/>
                                </div>

                                <div className="grid max-h-56 grid-cols-1 gap-3 overflow-y-auto pr-1 xl:grid-cols-2">
                                    {
                                        Array.from({ length: 10 }).map(() =>(
                                            <div className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold leading-5 text-slate-950">client registration form seller's copy</p>
                                                    <span className="text-xs text-slate-500">No description</span>
                                                </div>
                                                <button className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500 shadow-sm duration-150 hover:bg-slate-100">Added</button>
                                            </div>
                                        ))
                                    }
                                    
                                </div>

                            </div>

                            <div className="flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_140px_120px_auto] md:items-end">
                                        <div className="flex flex-col items-start">
                                            <h3 className="font-bold leading-5 text-slate-950">Contract to sell</h3>
                                            <p className="text-xs text-slate-500">From library</p>
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="mb-1 text-xs font-bold text-slate-600">Requirement</h3>
                                            <select className="h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none duration-150 focus:border-blue-500">
                                                <option value="required">Required</option>
                                                <option value="optional">Optional</option>
                                            </select>
                                        </div>
                                        <div className="flex flex-col">
                                            <h3 className="mb-1 text-xs font-bold text-slate-600">Status</h3>
                                            <select className="h-10 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold outline-none duration-150 focus:border-blue-500">
                                                <option value="active">Active</option>
                                                <option value="inactive">Inactive</option>
                                            </select>
                                        </div>

                                        <div className="flex items-center justify-start md:justify-center">
                                            <button className="h-10 rounded-lg bg-red-600 px-4 text-sm font-bold tracking-wide text-white duration-150 hover:bg-red-700">remove</button>
                                        </div>

                                    </div>
                                    
                                </div>

                        </div>
                    </div>
                </div>
                
        </div>
  )
}

export default EditProjectModal