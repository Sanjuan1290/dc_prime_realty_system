import { useMemo, useState } from 'react'
import { FiCheckCircle, FiFileText, FiLoader, FiSearch, FiTrash2, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const normalizeRequirement = (value, fallback = 'required') => {
  const clean = String(value || fallback).trim().toLowerCase()
  return clean === 'optional' ? 'optional' : 'required'
}

const normalizeDocument = (document) => ({
  ...document,
  id: document.id || document.document_id,
  document_id: document.document_id || document.id,
  name: document.name || document.document_name,
  description: document.description || document.document_description || 'Project Default',
  source: document.source || 'Project Default',
  requirement: normalizeRequirement(
    document.requirement,
    document.lot_project_default_document_is_required === false ? 'optional' : 'required'
  ),
  status: String(document.status || document.lot_project_default_document_status || document.document_status || 'active').toLowerCase() === 'inactive'
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

const EditListingDocumentsModal = ({ selectedDocuments = [], setSelectedDocuments, libraryDocuments = [], projectDefaultDocuments = [], onClose, onSave, title = 'Edit Documents Before Adding Listing', subtitle = 'These requirements will be saved together with the new listing. Leave empty to use project defaults when saving.', saveLabel = 'Done', isSaving = false }) => {
  const [documents, setDocuments] = useState(() => {
    const docs = selectedDocuments?.length ? selectedDocuments : projectDefaultDocuments
    return docs.map(normalizeDocument)
  })

  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState(null)
  const [isLoadingDefaults, setIsLoadingDefaults] = useState(false)
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const library = useMemo(() => libraryDocuments.map(normalizeDocument).filter((document) => document.status === 'active'), [libraryDocuments])

  const requiredCount = useMemo(() => documents.filter((document) => document.requirement === 'required').length, [documents])

  const filteredLibraryDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    if (!keyword) return library
    return library.filter((document) => `${document.name} ${document.description}`.toLowerCase().includes(keyword))
  }, [search, library])

  const getDocumentKey = (document = {}) => Number(document.document_id || document.id)

  const isDocumentAdded = (documentId) => documents.some((document) => getDocumentKey(document) === Number(documentId))

  const addDocument = (document) => {
    if (isDocumentAdded(document.document_id || document.id)) {
      setAlert({ type: 'info', message: 'This document is already added.' })
      return
    }

    setDocuments((current) => [
      ...current,
      normalizeDocument({ ...document, description: document.description || 'Custom Listing Requirement', source: 'Document Library', requirement: 'required', status: 'active' }),
    ])

    setAlert({ type: 'success', message: `${document.name} added to listing requirements.` })
  }

  const removeDocument = (documentId) => {
    setDeletingId(documentId)
    setAlert({ type: 'loading', message: 'Removing document requirement...' })

    window.setTimeout(() => {
      setDocuments((current) => current.filter((document) => getDocumentKey(document) !== Number(documentId)))
      setDeletingId(null)
      setAlert({ type: 'warning', message: 'Document requirement removed.' })
    }, 250)
  }

  const updateDocument = (documentId, key, value) => {
    setDocuments((current) => current.map((document) => getDocumentKey(document) === Number(documentId) ? { ...document, [key]: value } : document))
    setAlert({ type: 'info', message: 'Document requirement updated.' })
  }

  const loadProjectDefaults = () => {
    setIsLoadingDefaults(true)
    setAlert({ type: 'loading', message: 'Loading project default requirements...' })

    window.setTimeout(() => {
      setDocuments(projectDefaultDocuments.map(normalizeDocument))
      setIsLoadingDefaults(false)
      setAlert({ type: 'success', message: 'Project default documents loaded.' })
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

          <section className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-base font-black text-slate-950">Add Existing Documents</h3>
                <p className="mt-1 text-sm font-semibold text-slate-500">Create missing documents in Document Library first, then search and add them here.</p>
              </div>

              <button type="button" onClick={loadProjectDefaults} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
                {isLoadingDefaults ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiFileText className="h-4 w-4" />}
                Load Project Defaults
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
                  <div key={documentKey} className={`grid gap-4 rounded-xl border bg-white p-4 shadow-sm transition md:grid-cols-[1fr_140px_120px_auto] md:items-center ${isDeleting ? 'border-red-200 opacity-70' : 'border-slate-200 hover:border-blue-200'}`}>
                    <div className="min-w-0"><p className="break-words text-base font-black text-slate-950">{document.name}</p><p className="mt-1 text-sm font-semibold text-slate-500">{document.description}</p><p className="mt-1 text-xs font-semibold text-slate-400">Source: {document.source}</p></div>
                    <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Requirement</span><select value={document.requirement} onChange={(event) => updateDocument(documentKey, 'requirement', event.target.value)} disabled={isBusy || isDeleting} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"><option value="required">Required</option><option value="optional">Optional</option></select></label>
                    <label className="flex flex-col gap-1.5"><span className="text-sm font-black text-slate-700">Status</span><select value={document.status} onChange={(event) => updateDocument(documentKey, 'status', event.target.value)} disabled={isBusy || isDeleting} className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:opacity-60"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
                    <button type="button" onClick={() => removeDocument(documentKey)} disabled={isBusy || isDeleting} className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60">{isDeleting ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}{isDeleting ? 'Removing...' : 'Remove'}</button>
                  </div>
                )
              })}
            </section>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm font-semibold text-slate-500">No custom document requirements selected. Saving the listing will use project defaults.</div>
          )}
        </div>

        <div className="flex shrink-0 justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={handleDone} disabled={isBusy} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60">
            {isSavingDraft ? <><FiLoader className="h-4 w-4 animate-spin" />Saving...</> : <><FiCheckCircle className="h-4 w-4" />{saveLabel}</>}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditListingDocumentsModal

