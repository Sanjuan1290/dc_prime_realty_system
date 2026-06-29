import { FiSearch } from "react-icons/fi";
import { RxCross2 } from "react-icons/rx";

type Props = {
    setShowAddTemplateModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const DocumentAddTemplate = ({ setShowAddTemplateModal }: Props) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <h3 className="text-xl font-bold text-gray-950">
                        Add Document Template
                    </h3>

                    <button
                        type="button"
                        onClick={() => setShowAddTemplateModal(false)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
                    >
                        <RxCross2 className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Template Name
                            </p>
                            <input
                                type="text"
                                className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>

                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Status
                            </p>
                            <select className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </label>

                        <label className="flex flex-col gap-2 md:col-span-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Template Description
                            </p>
                            <textarea
                                rows={4}
                                placeholder="Example: Standard requirements for residential lot buyers"
                                className="resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                            />
                        </label>
                    </div>

                    {/* Template Documents */}
                    <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-gray-200 bg-gray-50 p-4">
                        <div className="flex flex-col gap-1">
                            <h3 className="text-lg font-bold text-gray-950">
                                Template Documents
                            </h3>
                            <p className="text-sm text-gray-600">
                                Add documents to this template. Projects can select this template and still customize the list.
                            </p>
                        </div>

                        <div className="rounded-2xl border border-gray-200 bg-white p-4">
                            <div className="mb-3 flex flex-col gap-1">
                                <h3 className="text-sm font-bold text-gray-950">
                                    Add Existing Documents
                                </h3>
                                <p className="text-xs text-gray-500">
                                    Create new documents in the Document Library first, then search and add them to this template.
                                </p>
                            </div>

                            <div className="relative mb-4">
                                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search document library..."
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-10 pr-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                                />
                            </div>

                            <div className="grid max-h-[220px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-bold text-gray-950">
                                            CLIENT REGISTRATION FORM (Seller&apos;s Copy)
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            No description
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-bold text-gray-950">
                                            CLIENT REGISTRATION FORM (Administrator Copy)
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            No description
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                                    >
                                        Add
                                    </button>
                                </div>

                                <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                    <div className="min-w-0">
                                        <h3 className="truncate text-sm font-bold text-gray-950">
                                            OFFER TO BUY &amp; BUYER&apos;S PROFILE
                                        </h3>
                                        <p className="text-xs text-gray-500">
                                            No description
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Empty State */}
                        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-4 py-5">
                            <p className="text-sm text-gray-500">
                                No documents added to this template yet.
                            </p>
                        </div>

                        {/* Selected Documents */}
                        <div className="flex flex-col gap-3">
                            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-200 bg-white p-4 md:grid-cols-5 md:items-center">
                                <div className="flex min-w-0 flex-col gap-1 md:col-span-2">
                                    <h3 className="truncate text-sm font-bold text-gray-950">
                                        OFFER TO BUY &amp; BUYER&apos;S PROFILE
                                    </h3>
                                    <p className="text-xs text-gray-500">
                                        No description
                                    </p>
                                </div>

                                <label className="flex flex-col gap-1">
                                    <h3 className="text-xs font-semibold text-gray-600">
                                        Requirement
                                    </h3>
                                    <select className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                                        <option value="required">Required</option>
                                        <option value="optional">Optional</option>
                                    </select>
                                </label>

                                <label className="flex flex-col gap-1">
                                    <h3 className="text-xs font-semibold text-gray-600">
                                        Status
                                    </h3>
                                    <select className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </label>

                                <div className="flex md:justify-end">
                                    <button
                                        type="button"
                                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
                    <button
                        type="button"
                        onClick={() => setShowAddTemplateModal(false)}
                        className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                    >
                        Create Template
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DocumentAddTemplate;