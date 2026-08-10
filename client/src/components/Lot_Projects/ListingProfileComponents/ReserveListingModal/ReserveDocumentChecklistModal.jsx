import { FiFileText, FiLayers, FiLoader, FiSearch, FiTrash2 } from 'react-icons/fi'
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
  addTemplateDocuments,
  removeDocument,
  updateDocumentRequirement,
  loadProjectDefaults,
  documentTemplates = [],
}) => (
  <div className="flex flex-col gap-4">
    <SectionCard
      title="Reservation Document Checklist"
      description="This listing's saved document requirements are selected automatically. Add templates or individual documents, then confirm Required / Optional before reserving."
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
      <section className="mb-4 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FiLayers className="h-4 w-4 text-indigo-600" />
              <h3 className="text-sm font-black text-slate-950">Document Templates</h3>
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              Add a full template without replacing documents already saved for this listing. Existing document requirements stay unchanged.
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-indigo-700 ring-1 ring-indigo-200">
            {documentTemplates.length} templates
          </span>
        </div>

        {documentTemplates.length ? (
          <div className="mt-3 grid max-h-[220px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {documentTemplates.map((template) => {
              const templateRows = Array.isArray(template.documents) ? template.documents : []
              const total = Number(template.totalDocuments ?? templateRows.length)
              const required = Number(template.requiredDocuments ?? templateRows.filter((document) => document.requirement === 'required').length)
              const addedCount = templateRows.filter((document) => isDocumentAdded(document.document_id || document.id)).length
              const fullyAdded = total > 0 && addedCount >= total

              return (
                <article key={template.template_id} className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-slate-950">{template.template_name}</p>
                      <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{template.template_description || 'No description'}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">{required} required / {total} docs</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-[11px] font-bold text-slate-500">{addedCount}/{total} already selected</span>
                    <button
                      type="button"
                      onClick={() => addTemplateDocuments(template)}
                      disabled={fullyAdded || !total || isSaving || isLoadingDefaults}
                      className={`h-9 rounded-lg border px-3 text-xs font-black transition ${fullyAdded
                        ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50'}`}
                    >
                      {fullyAdded ? 'Template Added' : 'Add Template'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-white/70 px-4 py-4 text-xs font-semibold text-slate-500">
            No active document templates are available.
          </div>
        )}
      </section>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-950">Document Library</h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">Add individual active documents that are not already selected.</p>
        </div>
        <button
          type="button"
          onClick={loadProjectDefaults}
          disabled={isLoadingDefaults || isSaving}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoadingDefaults ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}
          Reset to Project Defaults
        </button>
      </div>

      <div className="relative mb-3">
        <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={searchDocument}
          onChange={(event) => setSearchDocument(event.target.value)}
          placeholder="Search document name or description..."
          className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
        />
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
                  className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-black transition ${added
                    ? 'cursor-not-allowed border-slate-200 bg-white text-slate-400'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
                >
                  {added ? 'Added' : 'Add'}
                </button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 text-sm font-semibold text-slate-500">
          No active documents match your search.
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
                className={`flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 transition sm:flex-row sm:items-center sm:justify-between ${isDeleting ? 'opacity-60' : ''}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-950">{document.name}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {document.source || 'Listing Requirement'} · Active
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <label className="flex min-w-[150px] flex-col gap-1.5">
                    <span className="text-xs font-black text-slate-600">Requirement</span>
                    <select
                      value={document.requirement === 'optional' ? 'optional' : 'required'}
                      onChange={(event) => updateDocumentRequirement(documentId, event.target.value)}
                      disabled={isDeleting || isSaving}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                    </select>
                  </label>

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
              </div>
            )
          })}
        </div>
      </SectionCard>
    ) : (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">
        No documents selected. If you continue, the listing's saved requirements will be used; if none exist, project defaults will be used.
      </div>
    )}
  </div>
)

export default ReserveDocumentChecklistModal


