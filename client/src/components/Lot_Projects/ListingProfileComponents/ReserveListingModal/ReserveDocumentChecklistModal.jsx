import { FiFileText, FiLoader, FiSearch, FiTrash2 } from 'react-icons/fi'
import { SectionCard } from './ReserveShared'

const ReserveDocumentChecklistModal = ({
  filteredDocuments,
  searchDocument,
  setSearchDocument,
  selectedDocuments,
  isSaving,
  isLoadingDefaults,
  deletingDocId,
  isDocumentAdded,
  addDocument,
  removeDocument,
  loadProjectDefaults,
}) => (
  <div className="flex flex-col gap-4">
    <SectionCard
      title="Reservation Document Checklist"
      description="Select the document requirements that will be created for this reservation."
      right={
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
            {selectedDocuments.length} docs
          </span>
          <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
            {selectedDocuments.filter((document) => document.requirement === 'required').length} required
          </span>
        </div>
      }
    >
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={searchDocument}
            onChange={(event) => setSearchDocument(event.target.value)}
            placeholder="Search document name or description..."
            className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
          />
        </div>

        <button
          type="button"
          onClick={loadProjectDefaults}
          disabled={isLoadingDefaults || isSaving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingDefaults ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}
          Load Project Defaults
        </button>
      </div>

      {filteredDocuments.length ? (
        <div className="grid max-h-[245px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
          {filteredDocuments.map((document) => {
            const documentId = document.document_id || document.id
            const added = isDocumentAdded(documentId)

            return (
              <div
                key={documentId}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
              >
                <div className="min-w-0">
                  <p className="break-words text-sm font-black text-slate-950">{document.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{document.description}</p>
                </div>

                <button
                  type="button"
                  onClick={() => addDocument(document)}
                  disabled={added || isSaving}
                  className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-black transition ${
                    added
                      ? 'cursor-not-allowed border-slate-200 bg-white text-slate-400'
                      : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                  }`}
                >
                  {added ? 'Added' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm font-semibold text-slate-500">
          No active documents found from the database. Add documents in System Documents first.
        </div>
      )}
    </SectionCard>

    {selectedDocuments.length ? (
      <SectionCard title="Selected Documents">
        <div className="space-y-2">
          {selectedDocuments.map((document) => {
            const documentId = document.document_id || document.id
            const isDeleting = Number(deletingDocId) === Number(documentId)

            return (
              <div
                key={documentId}
                className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition sm:flex-row sm:items-center sm:justify-between ${
                  isDeleting ? 'opacity-60' : ''
                }`}
              >
                <div>
                  <p className="text-sm font-black text-slate-950">{document.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {document.requirement === 'optional' ? 'Optional' : 'Required'} · Active
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => removeDocument(documentId)}
                  disabled={isDeleting || isSaving}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeleting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}
                  {isDeleting ? 'Removing...' : 'Remove'}
                </button>
              </div>
            )
          })}
        </div>
      </SectionCard>
    ) : (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">
        No documents selected yet. You can continue, but the reservation will use project defaults if available.
      </div>
    )}
  </div>
)

export default ReserveDocumentChecklistModal

