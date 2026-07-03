import { useMemo, useState } from 'react'
import { FiSearch, FiX } from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const EditListingDocumentsModal = ({ documents = [], projectDefaults = [], selectedDocuments = [], setSelectedDocuments, onClose }) => {
  const [search, setSearch] = useState('')
  const [alert, setAlert] = useState(null)

  const filteredDocuments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return documents.filter((item) => !keyword || item.document_name?.toLowerCase().includes(keyword) || item.document_description?.toLowerCase().includes(keyword))
  }, [documents, search])

  const selectedIds = selectedDocuments.map((item) => Number(item.document_id))
  const requiredCount = selectedDocuments.filter((item) => item.requirement === 'required').length

  const addDocument = (document) => {
    if (selectedIds.includes(Number(document.document_id))) return
    setSelectedDocuments((current) => [...current, {
      document_id: Number(document.document_id),
      document_name: document.document_name,
      document_description: document.document_description,
      requirement: document.document_is_required ? 'required' : 'optional',
      status: document.document_status || 'active',
    }])
    setAlert({ type: 'success', message: `${document.document_name} added.` })
  }

  const loadProjectDefaults = () => {
    setSelectedDocuments(projectDefaults.map((item) => ({
      document_id: Number(item.document_id),
      document_name: item.document_name,
      document_description: item.document_description,
      requirement: item.requirement || 'required',
      status: item.status || 'active',
    })))
    setAlert({ type: 'success', message: 'Project defaults loaded.' })
  }

  const updateDocument = (documentId, key, value) => {
    setSelectedDocuments((current) => current.map((item) => Number(item.document_id) === Number(documentId) ? { ...item, [key]: value } : item))
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-3">
      <div className="max-h-[96vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h3 className="text-xl font-bold text-slate-950">Edit Documents Before Adding Listing</h3>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[72vh] overflow-y-auto p-5">
          <section className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-bold text-slate-950">Draft Listing Document Requirements</h4>
                <p className="text-sm font-semibold text-slate-500">These requirements save with the new listing. Leave empty to use project defaults.</p>
              </div>
              <div className="flex gap-2 text-xs font-bold">
                <span className="rounded-full bg-blue-50 px-3 py-1 text-blue-700">{selectedDocuments.length} docs</span>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{requiredCount} required</span>
              </div>
            </div>
          </section>

          {alert ? <StatusAlert type={alert.type} message={alert.message} onClose={() => setAlert(null)} className="mb-4" /> : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h4 className="font-bold text-slate-950">Add Existing Documents</h4>
                <p className="text-sm font-semibold text-slate-500">Create missing documents in Document Library first, then search and add them here.</p>
              </div>
              <button type="button" onClick={loadProjectDefaults} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Load Project Defaults</button>
            </div>
            <label className="relative mt-4 block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search document library..." className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
            <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto pr-1 md:grid-cols-2">
              {filteredDocuments.map((document) => {
                const added = selectedIds.includes(Number(document.document_id))
                return (
                  <div key={document.document_id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="min-w-0">
                      <h5 className="truncate text-sm font-bold text-slate-950">{document.document_name}</h5>
                      <p className="truncate text-xs font-semibold text-slate-500">{document.document_description || 'No description'}</p>
                    </div>
                    <button type="button" onClick={() => addDocument(document)} disabled={added} className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400">{added ? 'Added' : 'Add'}</button>
                  </div>
                )
              })}
            </div>
          </section>

          <section className="mt-4">
            {selectedDocuments.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-5 text-sm font-semibold text-slate-500">No custom document requirements selected. Saving the listing will use project defaults.</div>
            ) : (
              <div className="space-y-3">
                {selectedDocuments.map((document) => (
                  <div key={document.document_id} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-[1fr_auto_auto_auto] md:items-center">
                    <div className="min-w-0">
                      <h5 className="text-sm font-bold text-slate-950">{document.document_name}</h5>
                      <p className="text-xs font-semibold text-slate-500">{document.document_description || 'From library'}</p>
                    </div>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-600">Requirement</span>
                      <select value={document.requirement} onChange={(event) => updateDocument(document.document_id, 'requirement', event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option value="required">Required</option>
                        <option value="optional">Optional</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-600">Status</span>
                      <select value={document.status} onChange={(event) => updateDocument(document.document_id, 'status', event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>
                    <button type="button" onClick={() => setSelectedDocuments((current) => current.filter((item) => Number(item.document_id) !== Number(document.document_id)))} className="h-10 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Done</button>
        </div>
      </div>
    </div>
  )
}

export default EditListingDocumentsModal
