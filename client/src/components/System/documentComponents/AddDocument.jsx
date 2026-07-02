import { useState } from "react";
import { RxCross2 } from "react-icons/rx";

const AddDocument = ({ setShowAddDocumentModal }) => {
  const [formData, setFormData] = useState({
    document_name: "",
    document_description: "",
    document_is_reusable: "yes",
    document_status: "active",
    document_is_required: "required",
  });

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    setShowAddDocumentModal(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Add Document</h3>
            <p className="mt-1 text-sm text-slate-500">
              Create a reusable document for project and listing checklists.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setShowAddDocumentModal(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
          >
            <RxCross2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5 px-6 py-5">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Document Name
            </span>
            <input
              type="text"
              value={formData.document_name}
              onChange={(event) => handleChange("document_name", event.target.value)}
              placeholder="Example: Valid Government ID"
              className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-slate-700">
              Description
            </span>
            <textarea
              rows={4}
              value={formData.document_description}
              onChange={(event) =>
                handleChange("document_description", event.target.value)
              }
              placeholder="Example: Government-issued valid ID, two copies"
              className="resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Reusable Across Units
              </span>
              <select
                value={formData.document_is_reusable}
                onChange={(event) =>
                  handleChange("document_is_reusable", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Status
              </span>
              <select
                value={formData.document_status}
                onChange={(event) =>
                  handleChange("document_status", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Requirement
              </span>
              <select
                value={formData.document_is_required}
                onChange={(event) =>
                  handleChange("document_is_required", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="required">Required</option>
                <option value="optional">Optional</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button
            type="button"
            onClick={() => setShowAddDocumentModal(false)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            Add Document
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddDocument;
