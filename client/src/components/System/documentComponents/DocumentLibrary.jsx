import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FiArchive, FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiX } from "react-icons/fi";
import { FaCircle } from "react-icons/fa6";
import StatusAlert from "../../Shared/StatusAlert";
import { formatDateTime } from "../../../utils/formatDateTime";
import { useFetch, useFetchDelete, useFetchPatch } from "../../../utils/useFetch";
import { getDocumentResponsiblePartyLabel } from "../../../utils/documentRequirement";

const usageRows = (usage = {}) => [
  ['Document Templates', usage.templates],
  ['Project Defaults', usage.projectDefaults],
  ['Listing Requirements', usage.listingRequirements],
  ['Buyer Document Records', usage.buyerDocumentRecords],
  ['Legacy Project Defaults', usage.legacyProjectDefaults],
  ['Uploaded Files', usage.uploadedFiles],
].filter(([, count]) => Number(count || 0) > 0);

const DocumentLifecycleModal = ({ state, canEdit, isSaving, onClose, onDelete, onStatusChange }) => {
  if (!state?.document) return null;
  const document = state.document;
  const usage = state.usage || {};
  const isInactive = String(document.document_status || 'active').toLowerCase() === 'inactive';
  const deleteBlocked = state.mode === 'delete' && Boolean(usage.inUse);
  const permanentDelete = state.mode === 'delete' && !usage.inUse;
  const targetStatus = state.targetStatus || (isInactive ? 'active' : 'inactive');
  const isDeactivate = targetStatus === 'inactive';
  const rows = usageRows(usage);

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div role="dialog" aria-modal="true" className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className={`text-xs font-black uppercase tracking-[0.16em] ${deleteBlocked ? 'text-amber-600' : permanentDelete ? 'text-red-600' : 'text-blue-600'}`}>
              {deleteBlocked ? 'Protected Document History' : permanentDelete ? 'Permanent Deletion' : 'Document Lifecycle'}
            </p>
            <h3 className="mt-1 text-xl font-black text-slate-950">
              {deleteBlocked ? 'This document is already in use' : permanentDelete ? 'Permanently delete unused document?' : isDeactivate ? 'Deactivate document?' : 'Reactivate document?'}
            </h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">{document.document_name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"><FiX /></button>
        </div>

        <div className="space-y-4 px-6 py-5">
          {deleteBlocked ? (
            <>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold leading-6 text-amber-900">
                Permanent deletion is blocked because this library document has historical or current usage. Deactivate it instead to prevent future use while preserving existing listings, buyer-document records, and uploaded files.
              </div>
              {rows.length ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200">
                  {rows.map(([label, count]) => (
                    <div key={label} className="flex items-center justify-between border-b border-slate-100 px-4 py-3 text-sm last:border-b-0">
                      <span className="font-semibold text-slate-600">{label}</span>
                      <span className="font-black text-slate-950">{Number(count || 0).toLocaleString('en-PH')}</span>
                    </div>
                  ))}
                </div>
              ) : null}
              {Number(usage.activeUploadedFiles || 0) > 0 ? <p className="text-xs font-bold text-slate-500">Active uploaded files preserved: {Number(usage.activeUploadedFiles).toLocaleString('en-PH')}</p> : null}
            </>
          ) : permanentDelete ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold leading-6 text-red-900">
              The system verified that this document has never been linked to a template, project, listing, buyer document, or uploaded file. Permanent deletion cannot be undone.
            </div>
          ) : isDeactivate ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold leading-6 text-blue-900">
              Deactivation removes this document from future selection lists. Existing templates, projects, listings, buyer requirements, document statuses, and uploaded files stay intact.
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold leading-6 text-emerald-900">
              Reactivation makes this document available for future templates, projects, listings, and reservations again. Existing historical records are unchanged.
            </div>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50">{deleteBlocked && (isInactive || !canEdit) ? 'Close' : 'Cancel'}</button>
          {deleteBlocked && !isInactive && canEdit ? (
            <button type="button" onClick={() => onStatusChange('inactive')} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-black text-white hover:bg-amber-700 disabled:opacity-50"><FiArchive />{isSaving ? 'Deactivating...' : 'Deactivate Document'}</button>
          ) : null}
          {permanentDelete ? (
            <button type="button" onClick={onDelete} disabled={isSaving} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"><FiTrash2 />{isSaving ? 'Deleting...' : 'Delete Permanently'}</button>
          ) : null}
          {state.mode === 'status' ? (
            <button type="button" onClick={() => onStatusChange(targetStatus)} disabled={isSaving} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-white disabled:opacity-50 ${isDeactivate ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
              {isDeactivate ? <FiArchive /> : <FiRefreshCw />}{isSaving ? 'Saving...' : isDeactivate ? 'Deactivate Document' : 'Reactivate Document'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};

const Document_Library = ({ documents = [], onEditDocument, canEdit = false, canDelete = false }) => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [alert, setAlert] = useState(null);
  const [checkingDocumentId, setCheckingDocumentId] = useState(null);
  const [lifecycleDialog, setLifecycleDialog] = useState(null);

  const invalidateDocumentViews = () => {
    queryClient.invalidateQueries({ queryKey: ["documents"] });
    queryClient.invalidateQueries({ queryKey: ["templates"] });
    queryClient.invalidateQueries({ queryKey: ["lot-listing-profile"] });
  };

  const deleteMutation = useMutation({
    mutationFn: (documentId) => useFetchDelete(`/documents/deleteDocument/${documentId}`, { confirmationHandled: 'compact' }),
    onMutate: () => setAlert({ type: "loading", message: "Permanently deleting unused document..." }),
    onSuccess: (data) => {
      setLifecycleDialog(null);
      setAlert({ type: "success", message: data?.message || "Unused document permanently deleted." });
      invalidateDocumentViews();
    },
    onError: async (error) => {
      if (error?.code === 'DOCUMENT_IN_USE') {
        const document = lifecycleDialog?.document;
        setLifecycleDialog(document ? { mode: 'delete', document, usage: error?.data?.usage || { inUse: true } } : null);
        setAlert({ type: 'warning', message: error.message });
        return;
      }
      setAlert({ type: "error", message: error.message || "Failed to delete document." });
    },
  });

  const statusMutation = useMutation({
    mutationFn: ({ documentId, status }) => useFetchPatch(`/documents/${documentId}/status`, { status }, { confirmationHandled: 'compact' }),
    onMutate: ({ status }) => setAlert({ type: 'loading', message: status === 'inactive' ? 'Deactivating document...' : 'Reactivating document...' }),
    onSuccess: (data) => {
      setLifecycleDialog(null);
      setAlert({ type: 'success', message: data?.message || 'Document status updated.' });
      invalidateDocumentViews();
    },
    onError: (error) => setAlert({ type: 'error', message: error?.message || 'Failed to update document status.' }),
  });

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return documents;
    return documents.filter((document) =>
      document.document_name?.toLowerCase().includes(keyword)
      || document.document_code?.toLowerCase().includes(keyword)
      || document.document_description?.toLowerCase().includes(keyword)
      || document.document_status?.toLowerCase().includes(keyword)
      || getDocumentResponsiblePartyLabel(document.document_responsible_party).toLowerCase().includes(keyword)
    );
  }, [documents, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedDocuments = useMemo(() => filteredDocuments.slice((currentPage - 1) * pageSize, currentPage * pageSize), [currentPage, filteredDocuments, pageSize]);

  const loadUsage = async (document, mode = 'delete', targetStatus = null) => {
    setCheckingDocumentId(document.document_id);
    setAlert({ type: 'loading', message: 'Checking document usage...' });
    try {
      const data = await useFetch(`/documents/${document.document_id}/usage`);
      setLifecycleDialog({ mode, targetStatus, document, usage: data?.usage || { inUse: false } });
      setAlert(null);
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Unable to check document usage.' });
    } finally {
      setCheckingDocumentId(null);
    }
  };

  const handleDelete = (document) => loadUsage(document, 'delete');
  const handleStatus = (document) => loadUsage(document, 'status', document.document_status === 'active' ? 'inactive' : 'active');
  const isSavingLifecycle = deleteMutation.isPending || statusMutation.isPending;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-gray-900">Document Library</h3>
        <p className="max-w-3xl text-sm leading-6 text-gray-600">Master list of reusable documents. Deactivate documents that have already been used so historical listing and buyer records remain intact. Permanent deletion is available only for documents with no usage history.</p>
      </div>

      {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === "loading" ? undefined : () => setAlert(null)} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative w-full sm:max-w-md">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search document name, code, or description..." className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition focus:border-gray-400 focus:bg-white focus:ring-2 focus:ring-gray-100" />
        </div>
        <button type="button" onClick={() => { setSearch(""); setPage(1); }} className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]">Reset</button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="hidden grid-cols-6 border-b border-gray-200 bg-gray-50 px-5 py-3 text-sm font-bold text-gray-700 md:grid">
          <p className="col-span-2">Document</p><p>Responsible</p><p>Status</p><p>Updated</p><p className="text-right">Actions</p>
        </div>

        {filteredDocuments.length === 0 ? <div className="px-5 py-6 text-sm text-gray-500">No documents found.</div> : paginatedDocuments.map((document) => {
          const isChecking = checkingDocumentId === document.document_id;
          const isActive = String(document.document_status || 'active').toLowerCase() === 'active';
          return (
            <div key={document.document_id} className="grid gap-4 border-b border-gray-100 px-5 py-4 text-sm text-gray-700 last:border-b-0 md:grid-cols-6 md:items-center">
              <div className="col-span-2 flex flex-col gap-1">
                <h3 className="font-bold text-gray-900">{document.document_name}</h3>
                <p className="w-fit rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide text-slate-600">{document.document_code || `DOC-${String(document.document_id).padStart(6, "0")}`}</p>
                <p className="text-gray-500">{document.document_description || "No description"}</p>
              </div>
              <p className="text-xs font-bold text-slate-600">{getDocumentResponsiblePartyLabel(document.document_responsible_party)}</p>
              <p className={`flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold ${isActive ? "border-green-500 bg-green-100 text-green-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}><FaCircle className="h-2 w-2" />{isActive ? 'Active' : 'Deactivated'}</p>
              <p className="text-gray-600">{formatDateTime(document.document_updated_at || document.document_created_at)}</p>
              <div className="flex flex-wrap items-center gap-2 md:justify-end">
                {canEdit ? <button type="button" onClick={() => onEditDocument(document)} disabled={isSavingLifecycle || isChecking} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"><FiEdit2 className="h-4 w-4" />Edit</button> : null}
                {canEdit ? <button type="button" onClick={() => handleStatus(document)} disabled={isSavingLifecycle || isChecking} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium disabled:opacity-60 ${isActive ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}>{isActive ? <FiArchive className="h-4 w-4" /> : <FiRefreshCw className="h-4 w-4" />}{isChecking ? 'Checking...' : isActive ? 'Deactivate' : 'Reactivate'}</button> : null}
                {canDelete ? <button type="button" onClick={() => handleDelete(document)} disabled={isSavingLifecycle || isChecking} className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-60"><FiTrash2 className="h-4 w-4" />{isChecking ? 'Checking...' : 'Delete'}</button> : null}
                {!canEdit && !canDelete ? <span className="text-xs font-semibold text-gray-400">View only</span> : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-gray-600">Showing {filteredDocuments.length ? ((currentPage - 1) * pageSize) + 1 : 0}-{Math.min(currentPage * pageSize, filteredDocuments.length)} of {filteredDocuments.length} documents</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-gray-200 bg-white px-3 text-sm font-bold text-gray-700">{[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select>
          <button type="button" onClick={() => setPage(currentPage - 1)} disabled={currentPage <= 1} className="h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Previous</button>
          <span className="h-9 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700">Page {currentPage} of {totalPages}</span>
          <button type="button" onClick={() => setPage(currentPage + 1)} disabled={currentPage >= totalPages} className="h-9 rounded-lg border border-gray-200 bg-white px-4 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300">Next</button>
        </div>
      </div>

      <DocumentLifecycleModal
        state={lifecycleDialog}
        canEdit={canEdit}
        isSaving={isSavingLifecycle}
        onClose={() => { if (!isSavingLifecycle) setLifecycleDialog(null); }}
        onDelete={() => lifecycleDialog?.document && deleteMutation.mutate(lifecycleDialog.document.document_id)}
        onStatusChange={(status) => lifecycleDialog?.document && statusMutation.mutate({ documentId: lifecycleDialog.document.document_id, status })}
      />
    </div>
  );
};

export default Document_Library;
