import { useMemo, useState } from "react";
import { FiSearch } from "react-icons/fi";
import { RxCross2 } from "react-icons/rx";

const fallbackDocuments = [
  {
    document_id: 1,
    document_name: "Valid Government ID",
    document_description: "One clear copy of a government-issued valid ID.",
    document_is_required: true,
    document_status: "active",
  },
  {
    document_id: 2,
    document_name: "Proof of Billing",
    document_description: "Recent utility bill or billing statement.",
    document_is_required: false,
    document_status: "active",
  },
];

const EditDocumentTemplate = ({ template, documents = fallbackDocuments, onClose }) => {
  const startingDocuments = documents.filter((document) =>
    (template?.document_ids || []).includes(document.document_id)
  );

  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState({
    template_name: template?.template_name || "",
    template_description: template?.template_description || "",
    template_status: template?.template_status || "active",
  });
  const [selectedDocuments, setSelectedDocuments] = useState(startingDocuments);

  const selectedDocumentIds = useMemo(
    () => new Set(selectedDocuments.map((document) => document.document_id)),
    [selectedDocuments]
  );

  const availableDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return documents.filter((document) => {
      if (selectedDocumentIds.has(document.document_id)) return false;
      if (document.document_status !== "active") return false;
      if (!keyword) return true;

      const name = document.document_name?.toLowerCase() || "";
      const description = document.document_description?.toLowerCase() || "";

      return name.includes(keyword) || description.includes(keyword);
    });
  }, [documents, search, selectedDocumentIds]);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddDocument = (document) => {
    setSelectedDocuments((prev) => [...prev, document]);
  };

  const handleRemoveDocument = (documentId) => {
    setSelectedDocuments((prev) =>
      prev.filter((document) => document.document_id !== documentId)
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Edit Document Template
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Edit the checklist name, status, and selected documents.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]"
          >
            <RxCross2 className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Template Name
              </span>
              <input
                type="text"
                value={formData.template_name}
                onChange={(event) => handleChange("template_name", event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-semibold text-slate-700">
                Status
              </span>
              <select
                value={formData.template_status}
                onChange={(event) =>
                  handleChange("template_status", event.target.value)
                }
                className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>

            <label className="flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                Template Description
              </span>
              <textarea
                rows={4}
                value={formData.template_description}
                onChange={(event) =>
                  handleChange("template_description", event.target.value)
                }
                className="resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <h3 className="text-lg font-bold text-slate-950">
                Template Documents
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Add or remove documents from this template.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3">
                <h3 className="text-sm font-bold text-slate-950">
                  Add Existing Documents
                </h3>
                <p className="mt-1 text-xs text-slate-500">
                  Search active documents and add them to this template.
                </p>
              </div>

              <div className="relative mb-4">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search document library..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                />
              </div>

              {availableDocuments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                  No available documents found.
                </p>
              ) : (
                <div className="grid max-h-[220px] grid-cols-1 gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                  {availableDocuments.map((document) => (
                    <div
                      key={document.document_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-bold text-slate-950">
                          {document.document_name}
                        </h3>
                        <p className="line-clamp-1 text-xs text-slate-500">
                          {document.document_description || "No description"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddDocument(document)}
                        className="shrink-0 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedDocuments.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5">
                <p className="text-sm text-slate-500">
                  No documents added to this template yet.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {selectedDocuments.map((document) => (
                  <div
                    key={document.document_id}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5 md:items-center"
                  >
                    <div className="flex min-w-0 flex-col gap-1 md:col-span-2">
                      <h3 className="truncate text-sm font-bold text-slate-950">
                        {document.document_name}
                      </h3>
                      <p className="line-clamp-1 text-xs text-slate-500">
                        {document.document_description || "No description"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-500">
                        Requirement
                      </span>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {document.document_is_required ? "Required" : "Optional"}
                      </p>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-slate-500">
                        Status
                      </span>
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm capitalize text-slate-700">
                        {document.document_status}
                      </p>
                    </div>

                    <div className="flex md:justify-end">
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(document.document_id)}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Cancel
          </button>

          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            Save Changes
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditDocumentTemplate;
