import { useMemo, useState } from "react";
import {
  FiArchive,
  FiEdit2,
  FiFileText,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { FaCircle } from "react-icons/fa6";

const fallbackDocuments = [
  {
    document_id: 1,
    document_name: "Valid Government ID",
    document_description: "One clear copy of a government-issued valid ID.",
    document_is_reusable: true,
    document_is_required: true,
    document_status: "active",
    document_updated_at: "2026-06-21 13:20",
  },
  {
    document_id: 2,
    document_name: "Proof of Billing",
    document_description: "Recent utility bill or billing statement under the buyer name.",
    document_is_reusable: true,
    document_is_required: false,
    document_status: "active",
    document_updated_at: "2026-06-22 10:30",
  },
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

const Document_Library = ({ documents = fallbackDocuments, onEditDocument }) => {
  const [search, setSearch] = useState("");

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    if (!keyword) return documents;

    return documents.filter((document) => {
      const name = document.document_name?.toLowerCase() || "";
      const description = document.document_description?.toLowerCase() || "";
      const status = document.document_status?.toLowerCase() || "";

      return (
        name.includes(keyword) ||
        description.includes(keyword) ||
        status.includes(keyword)
      );
    });
  }, [documents, search]);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            <FiArchive className="h-5 w-5" />
          </span>

          <div>
            <h3 className="text-xl font-bold text-slate-950">
              Document Library
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
              Master list of reusable documents. Required or optional rules can be set later in templates, projects, and listings.
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
              placeholder="Search documents..."
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
          <p className="col-span-4">Document</p>
          <p className="col-span-2">Reusable</p>
          <p className="col-span-2">Requirement</p>
          <p className="col-span-2">Status</p>
          <p className="col-span-1">Updated</p>
          <p className="col-span-1 text-right">Actions</p>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-5 py-12 text-center">
            <FiFileText className="h-10 w-10 text-slate-300" />
            <div>
              <p className="text-sm font-semibold text-slate-700">
                No documents found
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Try another keyword or reset the search.
              </p>
            </div>
          </div>
        ) : (
          filteredDocuments.map((document) => (
            <div
              key={document.document_id}
              className="grid gap-4 border-b border-slate-100 px-5 py-4 text-sm text-slate-700 last:border-b-0 md:grid-cols-12 md:items-center"
            >
              <div className="md:col-span-4">
                <p className="font-bold text-slate-950">
                  {document.document_name}
                </p>
                <p className="mt-1 line-clamp-2 text-slate-500">
                  {document.document_description || "No description"}
                </p>
              </div>

              <div className="md:col-span-2">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                  {document.document_is_reusable ? "Reusable" : "One-time"}
                </span>
              </div>

              <div className="md:col-span-2">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {document.document_is_required ? "Required" : "Optional"}
                </span>
              </div>

              <div className="md:col-span-2">
                <StatusBadge status={document.document_status} />
              </div>

              <p className="text-slate-500 md:col-span-1">
                {formatDate(document.document_updated_at)}
              </p>

              <div className="flex items-center gap-2 md:col-span-1 md:justify-end">
                <button
                  type="button"
                  onClick={() => onEditDocument?.(document)}
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
          ))
        )}
      </div>
    </section>
  );
};

export default Document_Library;
