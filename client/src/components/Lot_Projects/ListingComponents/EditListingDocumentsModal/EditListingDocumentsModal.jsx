import { useMemo, useState } from 'react'
import { FiAlertTriangle, FiCheckCircle, FiFileText, FiLayers, FiLoader, FiSearch, FiTrash2, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { resolveDocumentRequirement, resolveDocumentResponsibleParty } from '../../../../utils/documentRequirement.js'

const normalizeDocument = (document = {}) => ({
  id: Number(document.document_id || document.id || 0) || null,
  document_id: Number(document.document_id || document.id || 0) || null,
  name: document.name || document.document_name || 'Document',
  description: document.description || document.document_description || '',
  source: document.source || 'Project Default',
  requirement: resolveDocumentRequirement(document),
  responsibleParty: resolveDocumentResponsibleParty(document),
  status: String(document.status || document.lot_project_listing_document_status || document.lot_project_default_document_status || document.document_status || 'active').toLowerCase() === 'inactive'
    ? 'inactive'
    : 'active',
})

const CounterBadge = ({ children, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return <span className={`rounded-full px-3 py-1 text-xs font-black ${tones[tone] || tones.blue}`}>{children}</span>
}

const EditListingDocumentsModal = ({ selectedDocuments = [], setSelectedDocuments, libraryDocuments = [], projectDefaultDocuments = [], documentTemplates = [], templateDocuments = [], onClose, onSave, title = 'Edit Documents Before Adding Listing', subtitle = 'These requirements will be saved together with the new listing. Leave empty to use project defaults when saving.', saveLabel = 'Done', isSaving = false }) => {
  const [documents, setDocuments] = useState(() => {
    const docs = selectedDocuments?.length ? selectedDocuments : projectDefaultDocuments
    return docs.map(normalizeDocument)
  })

  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState(null)
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [pendingTemplate, setPendingTemplate] = useState(null)
  const [templateAdditionHistory, setTemplateAdditionHistory] = useState({})

  const library = useMemo(() => libraryDocuments.map(normalizeDocument).filter((document) => document.status === 'active'), [libraryDocuments])

  const activeTemplates = useMemo(() => (documentTemplates || [])
    .filter((template) => String(template.template_status || 'active').toLowerCase() !== 'inactive')
    .map((template) => {
      const rows = (templateDocuments || [])
        .filter((row) => String(row.template_id) === String(template.template_id))
        .map((row) => {
          const libraryDocument = library.find((document) => Number(document.document_id || document.id) === Number(row.document_id))
          if (!libraryDocument) return null
          return normalizeDocument({
            ...libraryDocument,
            ...row,
            source: `Template · ${template.template_name}`,
            requirement: resolveDocumentRequirement(row),
            responsibleParty: resolveDocumentResponsibleParty(row),
            status: 'active',
          })
        })
        .filter(Boolean)

      return {
        ...template,
        documents: rows,
        totalDocuments: rows.length,
        requiredDocuments: rows.filter((document) => document.requirement === 'required').length,
      }
    }), [documentTemplates, library, templateDocuments])

  const requiredCount = useMemo(() => documents.filter((document) => document.requirement === 'required').length, [documents])

  const filteredLibraryDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return library
    return library.filter((document) => `${document.name} ${document.description}`.toLowerCase().includes(keyword))
  }, [search, library])

  const getDocumentKey = (document = {}) => Number(document.document_id || document.id)

  const isDocumentAdded = (documentId) => documents.some((document) => getDocumentKey(document) === Number(documentId))

  const getTemplateHistoryKey = (template = {}) => String(template.template_id || template.id || template.template_name || 'template')

  const removeDocumentFromTemplateHistory = (documentId) => {
    const numericDocumentId = Number(documentId)
    setTemplateAdditionHistory((current) => Object.fromEntries(
      Object.entries(current)
        .map(([templateKey, entry]) => [
          templateKey,
          {
            ...entry,
            documentIds: (entry.documentIds || []).filter((id) => Number(id) !== numericDocumentId),
          },
        ])
        .filter(([, entry]) => entry.documentIds.length > 0)
    ))
  }

  const addDocument = (document) => {
    if (isDocumentAdded(document.document_id || document.id)) {
      setAlert({ type: 'info', message: 'This document is already added.' })
      return
    }

    removeDocumentFromTemplateHistory(document.document_id || document.id)
    setDocuments((current) => [
      ...current,
      normalizeDocument({ ...document, source: 'Document Library', status: 'active' }),
    ])

    setAlert({ type: 'success', message: `${document.name} added to listing requirements.` })
  }

  const removeDocument = (documentId) => {
    removeDocumentFromTemplateHistory(documentId)
    setDeletingId(documentId)
    setAlert({ type: 'loading', message: 'Removing document requirement...' })

    window.setTimeout(() => {
      setDocuments((current) => current.filter((document) => getDocumentKey(document) !== Number(documentId)))
      setDeletingId(null)
      setAlert({ type: 'warning', message: 'Document requirement removed.' })
    }, 250)
  }

  const addTemplateDocuments = (template) => {
    const templateRows = Array.isArray(template?.documents) ? template.documents : []
    const additions = templateRows.filter((document) => !isDocumentAdded(getDocumentKey(document)))
    if (!additions.length) {
      setAlert({ type: 'info', message: 'All documents from this template are already selected.' })
      return
    }

    const additionIds = additions.map(getDocumentKey).filter(Boolean)
    setDocuments((current) => [...current, ...additions.map((document) => normalizeDocument(document))])
    setTemplateAdditionHistory((current) => ({
      ...current,
      [getTemplateHistoryKey(template)]: {
        documentIds: additionIds,
        templateName: template.template_name || 'Template',
      },
    }))
    setAlert({ type: 'success', message: `${additionIds.length} document${additionIds.length === 1 ? '' : 's'} added from ${template.template_name || 'template'}.` })
  }

  const undoTemplateDocuments = (template) => {
    const templateKey = getTemplateHistoryKey(template)
    const history = templateAdditionHistory[templateKey]
    const undoIds = new Set((history?.documentIds || []).map(Number))
    if (!undoIds.size) return

    setDocuments((current) => current.filter((document) => !undoIds.has(getDocumentKey(document))))
    setTemplateAdditionHistory((current) => {
      const next = { ...current }
      delete next[templateKey]
      return next
    })
    setAlert({ type: 'warning', message: `Undid the most recent ${template.template_name || 'template'} addition.` })
  }

  const updateDocument = (documentId, key, value) => {
    setDocuments((current) => current.map((document) => getDocumentKey(document) === Number(documentId) ? { ...document, [key]: value } : document))
    setAlert({ type: 'info', message: 'Document requirement updated.' })
  }

  const loadProjectDefaults = () => {
    setIsLoadingDefaults(true)
    setAlert({ type: 'loading', message: 'Resetting to project default requirements...' })

    window.setTimeout(() => {
      setDocuments(projectDefaultDocuments.map(normalizeDocument))
      setTemplateAdditionHistory({})
      setPendingTemplate(null)
      setIsLoadingDefaults(false)
      setAlert({ type: 'success', message: 'Checklist reset to project defaults.' })
    }, 650)
  }

  const handleDone = async () => {
    setIsSavingDraft(true)
    setAlert({ type: 'loading', message: 'Saving document requirements...' })

    try {
      if (onSave) {
        await onSave(documents)
      } else {
        setSelectedDocuments?.(documents)
      }

      setAlert({ type: 'success', message: 'Document requirements saved.' })
      window.setTimeout(() => onClose?.(), 250)
    } catch (error) {
      setAlert({ type: 'error', message: error?.message || 'Failed to save document requirements.' })
    } finally {
      setIsSavingDraft(false)
    }
  }

  const isBusy = isLoadingDefaults || isSavingDraft || isSaving

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-lg font-black text-slate-950">{title}</h2>

          <button type="button" onClick={onClose} disabled={isBusy} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60" aria-label="Close edit documents modal"><FiX className="h-4 w-4" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={alert.type === 'loading' ? undefined : () => setAlert(null)} className="mb-4" /> : null}

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-950">Listing Document Requirements</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">{subtitle}</p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <CounterBadge>{documents.length} docs</CounterBadge>
                <CounterBadge tone="emerald">{requiredCount} required</CounterBadge>
              </div>
            </div>
          </section>

          <section className="mt-4 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <FiLayers className="h-4 w-4 text-indigo-600" />
                  <h3 className="text-base font-black text-slate-950">Document Templates</h3>
                </div>
                <p className="mt-1 text-sm font-semibold text-slate-600">Add a saved template without replacing requirements already selected for this listing.</p>
              </div>
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-indigo-700 ring-1 ring-indigo-200">{activeTemplates.length} templates</span>
            </div>

            {activeTemplates.length ? (
              <div className="mt-3 grid max-h-[260px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                {activeTemplates.map((template) => {
                  const total = Number(template.totalDocuments || 0)
                  const addedCount = (template.documents || []).filter((document) => isDocumentAdded(getDocumentKey(document))).length
                  const fullyAdded = total > 0 && addedCount >= total
                  const history = templateAdditionHistory[getTemplateHistoryKey(template)]
                  const undoCount = (history?.documentIds || []).filter((documentId) => isDocumentAdded(documentId)).length

                  return (
                    <article key={template.template_id} className="rounded-xl border border-indigo-100 bg-white p-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black text-slate-950">{template.template_name}</p>
                          <p className="mt-1 line-clamp-2 text-xs font-semibold text-slate-500">{template.template_description || 'No description'}</p>
                        </div>
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-1 text-[10px] font-black text-indigo-700">{template.requiredDocuments} required / {total} docs</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-slate-500">{addedCount}/{total} already selected</span>
                        <div className="flex flex-wrap gap-2">
                          {undoCount ? <button type="button" onClick={() => undoTemplateDocuments(template)} disabled={isBusy} className="h-9 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-black text-amber-800 hover:bg-amber-100 disabled:opacity-50">Undo Template Add ({undoCount})</button> : null}
                          <button type="button" onClick={() => setPendingTemplate(template)} disabled={fullyAdded || !total || isBusy} className={`h-9 rounded-lg border px-3 text-xs font-black transition ${fullyAdded ? 'cursor-not-allowed border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-indigo-200 bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50'}`}>{fullyAdded ? 'Template Added' : 'Add Template'}</button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            ) : <div className="mt-3 rounded-xl border border-dashed border-indigo-200 bg-white/70 p-4 text-sm font-semibold text-slate-500">No active document templates are available.</div>}
          </section>

          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-950">Add Existing Documents</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Create missing documents in Document Library first, then search and add them here.</p>
              </div>

              <button type="button" onClick={loadProjectDefaults} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                {isLoadingDefaults ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}
                Reset to Project Defaults
              </button>
            </div>

            <div className="relative mb-3">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search document library..." className="h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50" />
            </div>

            <div className="grid max-h-[235px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {filteredLibraryDocuments.length === 0 ? <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500 md:col-span-2">No active documents found.</div> : null}
              {filteredLibraryDocuments.map((document) => {
                const libraryDocumentKey = getDocumentKey(document)
                const added = isDocumentAdded(libraryDocumentKey)
                return (
                  <div key={libraryDocumentKey} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                    <div className="min-w-0"><p className="break-words text-sm font-black text-slate-950">{document.name}</p><p className="mt-1 text-xs font-semibold text-slate-500">{document.description}</p></div>
                    <button type="button" onClick={() => addDocument(document)} disabled={added || isBusy} className={`h-10 shrink-0 rounded-lg border px-4 text-sm font-black transition ${added ? 'cursor-not-allowed border-slate-200 bg-white text-slate-400' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}>{added ? 'Added' : 'Add'}</button>
                  </div>
                )
              })}
            </div>
          </section>

          {documents.length ? (
            <section className="mt-4 space-y-2">
              {documents.map((document) => {
                const documentKey = getDocumentKey(document)
                const isDeleting = Number(deletingId) === Number(documentKey)
                return (
                  <div key={documentKey} className={`grid gap-4 rounded-xl border bg-white p-4 shadow-sm transition md:grid-cols-[1fr_140px_180px_120px_auto] md:items-center ${isDeleting ? 'border-red-200 opacity-70' : 'border-slate-200 hover:border-blue-200'}`}>
                    <div className="min-w-0"><p className="break-words text-base font-black text-slate-950">{document.name}</p><p className="mt-1 text-sm font-semibold text-slate-500">{document.description}</p><p className="mt-1 text-xs font-semibold text-slate-400">Source: {document.source}</p></div>
                    <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Requirement</span><select value={document.requirement} onChange={(event) => updateDocument(documentKey, 'requirement', event.target.value)} disabled={isBusy || isDeleting} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"><option value="required">Required</option><option value="optional">Optional</option></select></label>
                    <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Responsible Party</span><select value={document.responsibleParty} onChange={(event) => updateDocument(documentKey, 'responsibleParty', event.target.value)} disabled={isBusy || isDeleting} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"><option value="client">Client</option><option value="internal">Company / Internal</option><option value="seller">Seller / Agent</option></select></label>
                    <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Status</span><select value={document.status} onChange={(event) => updateDocument(documentKey, 'status', event.target.value)} disabled={isBusy || isDeleting} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                    <button type="button" onClick={() => removeDocument(documentKey)} disabled={isBusy || isDeleting} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{isDeleting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}{isDeleting ? 'Removing...' : 'Remove'}</button>
                  </div>
                )
              })}
            </section>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">No listing-specific requirements selected. Project defaults will be used only when this listing has no saved requirements.</div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={handleDone} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {isSavingDraft ? <><FiLoader className="h-4 w-4 animate-spin" />Saving...</> : <><FiCheckCircle className="h-4 w-4" />{onSave ? 'Proceed to Review' : saveLabel}</>}
          </button>
        </div>
      </div>

      {pendingTemplate ? (() => {
        const templateRows = Array.isArray(pendingTemplate.documents) ? pendingTemplate.documents : []
        const additions = templateRows.filter((document) => !isDocumentAdded(getDocumentKey(document)))
        const alreadySelected = Math.max(templateRows.length - additions.length, 0)
        return (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
              <div className="flex items-start gap-3 border-b border-slate-200 p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700"><FiAlertTriangle className="h-5 w-5" /></div>
                <div>
                  <h3 className="text-lg font-black text-slate-950">Add Document Template?</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-600">Confirm the documents that will be added from <span className="font-black">{pendingTemplate.template_name}</span>.</p>
                </div>
              </div>
              <div className="space-y-4 p-5">
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Template Docs</p><p className="mt-1 text-lg font-black">{templateRows.length}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3"><p className="text-[10px] font-black uppercase text-slate-500">Already Selected</p><p className="mt-1 text-lg font-black">{alreadySelected}</p></div>
                  <div className="rounded-xl bg-indigo-50 p-3"><p className="text-[10px] font-black uppercase text-indigo-600">New To Add</p><p className="mt-1 text-lg font-black text-indigo-700">{additions.length}</p></div>
                </div>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-200">
                  {additions.map((document) => <div key={getDocumentKey(document)} className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 last:border-0"><span className="text-sm font-black text-slate-800">{document.name}</span><span className="text-xs font-bold text-slate-500">{document.requirement === 'required' ? 'Required' : 'Optional'} · {document.responsibleParty === 'internal' ? 'Company / Internal' : document.responsibleParty === 'seller' ? 'Seller / Agent' : 'Client'}</span></div>)}
                  {!additions.length ? <div className="p-4 text-sm font-semibold text-slate-500">All documents from this template are already selected.</div> : null}
                </div>
                <p className="text-xs font-semibold text-slate-500">Existing selected documents will not be replaced or changed.</p>
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
                <button type="button" onClick={() => setPendingTemplate(null)} className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700">Cancel</button>
                <button type="button" onClick={() => { addTemplateDocuments(pendingTemplate); setPendingTemplate(null) }} disabled={!additions.length} className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-black text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50">Confirm & Add {additions.length} Document{additions.length === 1 ? '' : 's'}</button>
              </div>
            </div>
          </div>
        )
      })() : null}
    </div>
  )
}

export default EditListingDocumentsModal


