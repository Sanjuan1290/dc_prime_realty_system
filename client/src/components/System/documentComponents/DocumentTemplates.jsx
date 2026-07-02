import { useMemo, useState } from "react";
import {
  FiEdit2,
  FiLayers,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { FaCircle } from "react-icons/fa6";

const fallbackTemplates = [
  {
    template_id: 1,
    template_name: "Standard Lot Buyer Checklist",
    template_description: "Default document checklist for regular residential lot buyers.",
    template_status: "active",
    document_ids: [1, 2, 3],
    template_updated_at: "2026-06-24 10:15",
  },
];

const fallbackDocuments = [
  { document_id: 1, document_is_required: true },
  { document_id: 2, document_is_required: false },
  { document_id: 3, document_is_required: true },
];

const formatDate = (value) => value || "—";

const StatusBadge = ({ status }) => {
  const isActive = status === "active";

  return (
    <span
      className={[
        "inline-flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold capitalize",
        isActive
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-red-200 bg-red-50 text-red-700",
      ].join(" ")}
    >
      <FaCircle className="h-2 w-2" />
      {status}
    </span>
  );
};

const DocumentTemplates = ({
  templates = fallbackTemplates,
  documents = fallbackDocuments,
  onEditTemplate,
}) => {
  const [search, setSearch] = useState("");

  const filteredTemplates = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return templates;

    return templates.filter((template) => {
      const name = template.template_name?.toLowerCase() || "";
      const description = template.template_description?.toLowerCase() || "";
      const status = template.template_status?.toLowerCase() || "";

      return (
        name.includes(keyword) ||
        description.includes(keyword) ||
        status.includes(keyword)
      );
    });
  }, [templates, search]);

  const getTemplateDocuments = (template) => {
    const ids = new Set(template.document_ids || []);
    return documents.filter((document) => ids.has(document.document_id));
  };

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FiLayers className="h-5 w-5" />
          </span>

          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Document Templates
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              A template groups documents into a checklist. Projects can select a template and customize it later.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:w-80">
            <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search templates..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
            />
          </div>

          <button
            type="button"
            onClick={() => setSearch("")}
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98]"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="hidden grid-cols-12 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500 md:grid">
          <p className="col-span-5">Template</p>
          <p className="col-span-2">Documents</p>
          <p className="col-span-2">Status</p>
          <p className="col-span-2">Updated</p>
          <p className="col-span-1 text-right">Actions</p>
        </div>

        {filteredTemplates.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm font-semibold text-slate-700">
              No templates found
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Try another keyword or reset the search.
            </p>
          </div>
        ) : (
          filteredTemplates.map((template) => {
            const templateDocuments = getTemplateDocuments(template);
            const requiredCount = templateDocuments.filter((document) =>
              Boolean(document.document_is_required)
            ).length;

            return (
              <div
                key={template.template_id}
                className="grid gap-4 border-b border-slate-100 px-5 py-4 text-sm text-slate-700 last:border-b-0 md:grid-cols-12 md:items-center"
              >
                <div className="md:col-span-5">
                  <p className="font-bold text-slate-950">
                    {template.template_name}
                  </p>
                  <p className="mt-1 line-clamp-2 text-slate-500">
                    {template.template_description || "No description"}
                  </p>
                </div>

                <p className="font-semibold text-slate-700 md:col-span-2">
                  {templateDocuments.length} docs / {requiredCount} required
                </p>

                <div className="md:col-span-2">
                  <StatusBadge status={template.template_status} />
                </div>

                <p className="text-slate-500 md:col-span-2">
                  {formatDate(template.template_updated_at)}
                </p>

                <div className="flex items-center gap-2 md:col-span-1 md:justify-end">
                  <button
                    type="button"
                    onClick={() => onEditTemplate?.(template)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-blue-700 active:scale-[0.98]"
                    title="Edit"
                  >
                    <FiEdit2 className="h-4 w-4" />
                  </button>

                  <button
                    type="button"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 active:scale-[0.98]"
                    title="Delete"
                  >
                    <FiTrash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
};

export default DocumentTemplates;
