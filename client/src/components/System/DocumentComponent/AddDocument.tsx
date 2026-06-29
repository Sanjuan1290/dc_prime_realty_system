import { RxCross2 } from "react-icons/rx";

type Props = {
    setShowAddDocumentModal: React.Dispatch<React.SetStateAction<boolean>>;
};

const AddDocument = ({ setShowAddDocumentModal }: Props) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
                    <h3 className="text-xl font-bold text-gray-950">
                        Add Document
                    </h3>

                    <button
                        type="button"
                        onClick={() => setShowAddDocumentModal(false)}
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 active:scale-[0.98]"
                    >
                        <RxCross2 className="h-5 w-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex flex-col gap-5 px-6 py-5">
                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-gray-700">
                            Document Name
                        </p>

                        <input
                            type="text"
                            className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <label className="flex flex-col gap-2">
                        <p className="text-sm font-semibold text-gray-700">
                            Description
                        </p>

                        <textarea
                            rows={4}
                            placeholder="Example: Government-issued valid ID, two copies"
                            className="resize-none rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 shadow-sm outline-none transition placeholder:text-gray-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                    </label>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Reusable Across Units
                            </p>

                            <select className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                                <option value="yes">Yes</option>
                                <option value="no">No</option>
                            </select>
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

                        <label className="flex flex-col gap-2">
                            <p className="text-sm font-semibold text-gray-700">
                                Status
                            </p>

                            <select className="h-11 rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                                <option value="requried">Required</option>
                                <option value="optional">Optional</option>
                            </select>
                        </label>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-gray-200 bg-white px-6 py-4">
                    <button
                        type="button"
                        onClick={() => setShowAddDocumentModal(false)}
                        className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-[0.98]"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
                    >
                        Add Document
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddDocument;