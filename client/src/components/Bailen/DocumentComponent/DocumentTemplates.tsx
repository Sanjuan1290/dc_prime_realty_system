import { FiSearch, FiEdit2, FiTrash2  } from "react-icons/fi"
import { FaCircle } from "react-icons/fa6";

const DocumentTemplates = () => {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-1">
                <h3 className="text-xl font-bold text-gray-900">
                    Document Templates
                </h3>
                <p className="max-w-2xl text-sm leading-6 text-gray-600">
                    A template contains many documents. Projects can select a template, then still edit, add, or remove documents.
                </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative w-full sm:max-w-md">
                    <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />

                    <input
                        type="text"
                        placeholder="Search templates..."
                        className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
                    />
                </div>

                <button
                    type="button"
                    className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                >
                    Reset
                </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="hidden grid-cols-6 border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-bold text-gray-700 md:grid">
                    <p className="col-span-2">Template</p>
                    <p>Documents</p>
                    <p>Status</p>
                    <p>Updated</p>
                    <p className="text-right">Actions</p>
                </div>

                <div className="grid gap-4 border-b border-gray-100 px-5 py-4 text-sm text-gray-700 md:grid-cols-6 md:items-center">
                    <div className="flex flex-col gap-1 col-span-2">
                        <h3 className="font-bold text-gray-900">
                            Required for Submission (For OFW&apos;s or Representative)
                        </h3>
                        <p className="text-gray-500">
                            No description
                        </p>
                    </div>

                    <p className="text-gray-700">
                        2 docs / 2 required
                    </p>

                    <p className="flex w-fit items-center gap-1 rounded-full border border-green-500 bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                        <FaCircle className="h-2 w-2" />
                        Active
                    </p>

                    <p className="text-gray-600">
                        2026-06-28
                    </p>

                    <div className="flex items-center gap-2 md:justify-end">
                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
                        >
                            <FiEdit2 className="h-4 w-4" />
                            Edit
                        </button>

                        <button
                            type="button"
                            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                        >
                            <FiTrash2 className="h-4 w-4" />
                            Delete
                        </button>
                    </div>
                </div>
            </div>
    </div>
  )
}

export default DocumentTemplates