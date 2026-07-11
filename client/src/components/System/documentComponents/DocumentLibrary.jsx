import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FiEdit2, FiSearch, FiTrash2 } from "react-icons/fi";
import { FaCircle } from "react-icons/fa6";
import StatusAlert from "../../Shared/StatusAlert";
import { formatDateTime } from "../../../utils/formatDateTime";
import { useFetchDelete } from "../../../utils/useFetch";

const Document_Library = ({ documents = [], onEditDocument }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [alert, setAlert] = useState(null);
  const [deletingDocumentId, setDeletingDocumentId] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: (documentId) => useFetchDelete(`/documents/deleteDocument/${documentId}`),
    onMutate: (documentId) => {
      setDeletingDocumentId(documentId);
      setAlert({ type: "loading", message: "Deleting document..." });
    },
    onSuccess: (data) => {
      setAlert({ type: "success", message: data?.message || "Document deleted successfully." });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      queryClient.invalidateQueries({ queryKey: ["templates"] });
    },
    onError: (error) => setAlert({ type: "error", message: error.message || "Failed to delete document." }),
    onSettled: () => setDeletingDocumentId(null),
  });

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return documents;

    return documents.filter(
      (document) =>
        document.document_name?.toLowerCase().includes(keyword) ||
        document.document_description?.toLowerCase().includes(keyword) ||
        document.document_status?.toLowerCase().includes(keyword)
    );
  }, [documents, search]);

  const handleDelete = (document) => {
    const confirmed = window.confirm(`Delete "${document.document_name}"? This cannot be undone.`);
    if (!confirmed) return;
    deleteMutation.mutate(document.document_id);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-gray-900">Document Library</h3>
        <p className="max-w-2xl text-sm leading-6 text-gray-600">Master list of reusable documents. Required/optional is decided in templates, projects, and listings.</p>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === "loading" ? undefined : () => setAlert(null)} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search document name or description..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100"
          />
        </div>
        <button type="button" onClick={() => setSearch("")} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]">
          Reset
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-6 border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-bold text-gray-700 md:grid">
          <p className="col-span-2">Document</p>
          <p>Reusable</p>
          <p>Status</p>
          <p>Updated</p>
          <p className="text-right">Actions</p>
        </div>

        {filteredDocuments.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-500">No documents found.</div>
        ) : (
          filteredDocuments.map((document) => {
            const isDeleting = deleteMutation.isPending && deletingDocumentId === document.document_id;

            return (
              <div key={document.document_id} className="grid gap-4 border-b border-gray-100 px-5 py-4 text-sm text-gray-700 last:border-b-0 md:grid-cols-6 md:items-center">
                <div className="col-span-2 flex flex-col gap-1">
                  <h3 className="font-bold text-gray-900">{document.document_name}</h3>
                  <p className="text-gray-500">{document.document_description || "No description"}</p>
                </div>
                <p className="text-gray-700">{document.document_is_reusable ? "Yes" : "No"}</p>
                <p className={`flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${document.document_status === "active" ? "border-green-500 bg-green-100 text-green-800" : "border-red-500 bg-red-100 text-red-800"}`}>
                  <FaCircle className="h-2 w-2" />
                  {document.document_status}
                </p>
                <p className="text-gray-600">{formatDateTime(document.document_updated_at || document.document_created_at)}</p>
                <div className="flex items-center gap-2 md:justify-end">
                  <button type="button" onClick={() => onEditDocument(document)} disabled={deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                    <FiEdit2 className="h-4 w-4" />
                    Edit
                  </button>
                  <button type="button" onClick={() => handleDelete(document)} disabled={deleteMutation.isPending} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                    <FiTrash2 className="h-4 w-4" />
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Document_Library;

