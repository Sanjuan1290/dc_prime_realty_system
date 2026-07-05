import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  FiCheckCircle,
  FiFileText,
  FiLoader,
  FiPlus,
  FiSave,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'
import { useFetch } from '../../../../utils/useFetch'

const makeRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2)}`

const getProjectValue = (project, keys, fallback = '') => {
  for (const key of keys) {
    if (project?.[key] !== undefined && project?.[key] !== null && project?.[key] !== '') {
      return project[key]
    }
  }

  return fallback
}

const normalizeLotValue = (lot) => {
  if (typeof lot === 'string') return lot

  return (
    lot?.lot_project_cadastral_lot_number ||
    lot?.bailen_cadastral_lot_number ||
    lot?.lotNumber ||
    lot?.value ||
    ''
  )
}

const normalizeDocument = (document, requiredFallback = true) => ({
  document_id: Number(document.document_id),
  document_name: document.document_name || document.name || 'Untitled Document',
  document_description: document.document_description || document.description || 'No description',
  requirement:
    document.requirement ||
    (document.lot_project_default_document_is_required ?? document.document_is_required ?? requiredFallback
      ? 'required'
      : 'optional'),
  status:
    document.status ||
    document.lot_project_default_document_status ||
    document.document_status ||
    'active',
})

const Field = ({ label, value, onChange, placeholder, required = false }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    <input
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />
  </label>
)

const Badge = ({ children, tone = 'blue' }) => {
  const tones = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    slate: 'bg-slate-100 text-slate-600',
  }

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-black ${tones[tone] || tones.blue}`}>
      {children}
    </span>
  )
}

const EditProjectModal = ({ project, onClose, onSave, isSaving = false }) => {
  const [form, setForm] = useState({
    lot_project_name: getProjectValue(project, ['lot_project_name', 'project_bailen_name', 'name']),
    lot_project_location: getProjectValue(project, ['lot_project_location', 'project_bailen_location', 'location']),
    lot_project_location_code: getProjectValue(project, ['lot_project_location_code', 'project_bailen_location_code', 'locationCode']),
    lot_project_administrator_name: getProjectValue(project, ['lot_project_administrator_name', 'project_bailen_administrator_name', 'administrator_name']),
    lot_project_tax_declaration_no: getProjectValue(project, ['lot_project_tax_declaration_no', 'project_bailen_tax_declaration_no', 'tax_declaration_no']),
    lot_project_pin: getProjectValue(project, ['lot_project_pin', 'project_bailen_pin', 'pin']),
    lot_project_status: getProjectValue(project, ['lot_project_status', 'project_bailen_status', 'status'], 'active'),
  })

  const [lots, setLots] = useState(() => {
    const projectLots = project?.cadastral_lots || project?.cadastralLots || []

    if (!projectLots.length) {
      return [{ rowId: makeRowId(), value: '' }]
    }

    return projectLots.map((lot) => ({
      rowId: makeRowId(),
      value: normalizeLotValue(lot),
    }))
  })

  const [selectedTemplates, setSelectedTemplates] = useState([])
  const [selectedDocuments, setSelectedDocuments] = useState(() => {
    const defaults = project?.default_documents || project?.defaultDocuments || []
    return defaults.map((document) => normalizeDocument(document))
  })
  const [templateSearch, setTemplateSearch] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [alert, setAlert] = useState(null)

  const { data: documentsData, isLoading: isDocumentsLoading, isError: isDocumentsError, error: documentsError } = useQuery({
    queryKey: ['documents'],
    queryFn: () => useFetch('/documents/getDocuments'),
  })

  const { data: templatesData, isLoading: isTemplatesLoading, isError: isTemplatesError, error: templatesError } = useQuery({
    queryKey: ['templates'],
    queryFn: () => useFetch('/documents/getTemplates'),
  })

  const documentLibrary = useMemo(() => {
    const rows = documentsData?.documents || documentsData?.data || []
    return rows.filter((document) => document.document_status === 'active')
  }, [documentsData])

  const templateOptions = useMemo(() => {
    const rows = templatesData?.templates || templatesData?.data || []
    return rows.filter((template) => template.template_status === 'active')
  }, [templatesData])

  const templateDocuments = templatesData?.template_documents || templatesData?.templateDocuments || []

  const selectedDocumentIds = useMemo(
    () => new Set(selectedDocuments.map((document) => Number(document.document_id))),
    [selectedDocuments]
  )

  const requiredCount = useMemo(
    () => selectedDocuments.filter((document) => document.requirement === 'required').length,
    [selectedDocuments]
  )

  const optionalCount = useMemo(
    () => selectedDocuments.filter((document) => document.requirement === 'optional').length,
    [selectedDocuments]
  )

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase()
    if (!keyword) return templateOptions

    return templateOptions.filter((template) =>
      `${template.template_name} ${template.template_description || ''}`.toLowerCase().includes(keyword)
    )
  }, [templateOptions, templateSearch])

  const filteredLibraryDocuments = useMemo(() => {
    const keyword = documentSearch.trim().toLowerCase()
    const available = documentLibrary.filter((document) => !selectedDocumentIds.has(Number(document.document_id)))

    if (!keyword) return available

    return available.filter((document) =>
      `${document.document_name} ${document.document_description || ''}`.toLowerCase().includes(keyword)
    )
  }, [documentLibrary, documentSearch, selectedDocumentIds])

  const updateField = (key, value) => {
    setAlert(null)
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateLot = (rowId, value) => {
    setAlert(null)
    setLots((current) => current.map((lot) => (lot.rowId === rowId ? { ...lot, value } : lot)))
  }

  const addLot = () => {
    setLots((current) => [...current, { rowId: makeRowId(), value: '' }])
    setAlert({ type: 'info', message: 'New cadastral lot field added.' })
  }

  const removeLot = (rowId) => {
    setLots((current) => {
      if (current.length === 1) return current.map((lot) => ({ ...lot, value: '' }))
      return current.filter((lot) => lot.rowId !== rowId)
    })
    setAlert({ type: 'warning', message: 'Cadastral lot removed. Save changes to update the project.' })
  }

  const toggleTemplate = (template) => {
    const templateId = Number(template.template_id)
    const alreadySelected = selectedTemplates.includes(templateId)

    if (alreadySelected) {
      setSelectedTemplates((current) => current.filter((id) => id !== templateId))
      setAlert({ type: 'info', message: `${template.template_name} removed from template selection.` })
      return
    }

    const docsInTemplate = templateDocuments
      .filter((item) => Number(item.template_id) === templateId)
      .map((item) => normalizeDocument(item, item.document_is_required !== false))
      .filter((document) => document.document_id)

    setSelectedTemplates((current) => [...current, templateId])
    setSelectedDocuments((current) => {
      const existingIds = new Set(current.map((document) => Number(document.document_id)))
      const nextDocs = docsInTemplate.filter((document) => !existingIds.has(Number(document.document_id)))
      return [...current, ...nextDocs]
    })
    setAlert({ type: 'success', message: `${template.template_name} applied to the default checklist.` })
  }

  const addDocument = (document) => {
    const normalized = normalizeDocument(document)

    if (selectedDocumentIds.has(Number(normalized.document_id))) {
      setAlert({ type: 'info', message: 'Document is already included.' })
      return
    }

    setSelectedDocuments((current) => [...current, normalized])
    setAlert({ type: 'success', message: `${normalized.document_name} added.` })
  }

  const removeDocument = (documentId) => {
    setSelectedDocuments((current) => current.filter((document) => Number(document.document_id) !== Number(documentId)))
    setAlert({ type: 'warning', message: 'Document removed from default requirements. Save changes to apply.' })
  }

  const updateDocument = (documentId, key, value) => {
    setSelectedDocuments((current) =>
      current.map((document) =>
        Number(document.document_id) === Number(documentId) ? { ...document, [key]: value } : document
      )
    )
  }

  const selectAllTemplates = () => {
    const activeTemplateIds = templateOptions.map((template) => Number(template.template_id))
    const allDocs = templateDocuments
      .filter((item) => activeTemplateIds.includes(Number(item.template_id)))
      .map((item) => normalizeDocument(item, item.document_is_required !== false))
      .filter((document) => document.document_id)

    const uniqueDocs = Array.from(
      new Map([...selectedDocuments, ...allDocs].map((document) => [Number(document.document_id), document])).values()
    )

    setSelectedTemplates(activeTemplateIds)
    setSelectedDocuments(uniqueDocs)
    setAlert({ type: 'success', message: 'All active templates were applied.' })
  }

  const clearTemplates = () => {
    setSelectedTemplates([])
    setAlert({ type: 'warning', message: 'Template selection cleared. Documents already selected remain until removed.' })
  }

  const useAllLibraryDocs = () => {
    const allDocs = documentLibrary.map((document) => normalizeDocument(document))
    const uniqueDocs = Array.from(
      new Map([...selectedDocuments, ...allDocs].map((document) => [Number(document.document_id), document])).values()
    )

    setSelectedDocuments(uniqueDocs)
    setAlert({ type: 'success', message: 'All active library documents were added.' })
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.lot_project_name.trim()) {
      setAlert({ type: 'error', message: 'Project name is required.' })
      return
    }

    if (!form.lot_project_location.trim()) {
      setAlert({ type: 'error', message: 'Location is required.' })
      return
    }

    if (!form.lot_project_location_code.trim()) {
      setAlert({ type: 'error', message: 'Location code is required.' })
      return
    }

    const cleanLots = lots.map((lot) => lot.value.trim()).filter(Boolean)
    const uniqueLots = [...new Set(cleanLots)]

    if (!uniqueLots.length) {
      setAlert({ type: 'error', message: 'Add at least one cadastral lot number.' })
      return
    }

    const payload = {
      ...form,
      lot_project_location_code: form.lot_project_location_code.trim().toUpperCase(),
      cadastralLots: uniqueLots,
      defaultDocuments: selectedDocuments.map((document) => ({
        document_id: Number(document.document_id),
        is_required: document.requirement === 'required',
        requirement: document.requirement,
        status: document.status || 'active',
      })),
      // Backward-compatible keys for older dashboard handlers.
      project_bailen_name: form.lot_project_name,
      project_bailen_location: form.lot_project_location,
      project_bailen_location_code: form.lot_project_location_code.trim().toUpperCase(),
      project_bailen_administrator_name: form.lot_project_administrator_name,
      project_bailen_tax_declaration_no: form.lot_project_tax_declaration_no,
      project_bailen_pin: form.lot_project_pin,
      project_bailen_status: form.lot_project_status,
      cadastral_lots: uniqueLots,
      default_documents: selectedDocuments,
    }

    setAlert({ type: 'loading', message: 'Saving project details and default requirements...' })
    onSave?.(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <form
        onSubmit={handleSubmit}
        className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <div>
            <h2 className="text-base font-black text-slate-950">Edit Project</h2>
            <p className="text-xs font-semibold text-slate-500">Update project details, cadastral lots, and default documents.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close edit project modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          {isSaving ? <StatusAlert type="loading" message="Saving project changes..." className="mb-4" /> : null}
          {isDocumentsLoading || isTemplatesLoading ? <StatusAlert type="loading" message="Loading documents and templates..." className="mb-4" /> : null}
          {isDocumentsError ? <StatusAlert type="error" message={documentsError?.message || 'Failed to load documents.'} className="mb-4" /> : null}
          {isTemplatesError ? <StatusAlert type="error" message={templatesError?.message || 'Failed to load templates.'} className="mb-4" /> : null}

          <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="flex min-w-0 flex-col gap-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-black text-slate-950">Project Information</h3>
                  <p className="text-xs font-semibold text-slate-500">Basic project details and status.</p>
                </div>

                <div className="grid gap-3">
                  <Field label="Project Name" value={form.lot_project_name} onChange={(value) => updateField('lot_project_name', value)} placeholder="Example: Bailen Lot Project" required />
                  <Field label="Location" value={form.lot_project_location} onChange={(value) => updateField('lot_project_location', value)} placeholder="Example: Bailen, Cavite" required />
                  <Field label="Location Code" value={form.lot_project_location_code} onChange={(value) => updateField('lot_project_location_code', value)} placeholder="Example: LA" required />
                  <Field label="Administrator / Attorney-in-Fact" value={form.lot_project_administrator_name} onChange={(value) => updateField('lot_project_administrator_name', value)} placeholder="Example: Erlinda B. Causapin" />
                  <Field label="Tax Declaration No." value={form.lot_project_tax_declaration_no} onChange={(value) => updateField('lot_project_tax_declaration_no', value)} placeholder="Example: AA-06-0005-00105" />
                  <Field label="PIN" value={form.lot_project_pin} onChange={(value) => updateField('lot_project_pin', value)} placeholder="Example: 022-06-0005-003-04" />

                  <div>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-700">Cadastral Lot Numbers</p>
                        <p className="text-[11px] font-semibold text-slate-500">Add one lot number per field. The cursor will stay stable while typing.</p>
                      </div>
                      <button
                        type="button"
                        onClick={addLot}
                        disabled={isSaving}
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <FiPlus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    <div className="grid gap-2">
                      {lots.map((lot) => (
                        <div key={lot.rowId} className="flex gap-2">
                          <input
                            value={lot.value}
                            onChange={(event) => updateLot(lot.rowId, event.target.value)}
                            placeholder="Example: CAD-001 or 1306"
                            disabled={isSaving}
                            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => removeLot(lot.rowId)}
                            disabled={isSaving}
                            className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-black text-slate-700">Status</span>
                    <select
                      value={form.lot_project_status}
                      onChange={(event) => updateField('lot_project_status', event.target.value)}
                      disabled={isSaving}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    <FiFileText className="h-4 w-4 text-slate-700" />
                    <h3 className="text-sm font-black text-slate-950">Document Templates</h3>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">Select templates to add their documents to the project default checklist.</p>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <button type="button" onClick={selectAllTemplates} disabled={isSaving || isTemplatesLoading} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Select All Templates</button>
                  <button type="button" onClick={clearTemplates} disabled={isSaving} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Clear Templates</button>
                  <button type="button" onClick={useAllLibraryDocs} disabled={isSaving || isDocumentsLoading} className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Use All Library Docs</button>
                </div>

                <div className="relative mb-3">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search active templates..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div className="max-h-[285px] space-y-2 overflow-y-auto pr-1">
                  {!isTemplatesLoading && filteredTemplates.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs font-semibold text-slate-500">No active templates found.</p>
                  ) : null}

                  {filteredTemplates.map((template) => {
                    const selected = selectedTemplates.includes(Number(template.template_id))
                    const docs = templateDocuments.filter((item) => Number(item.template_id) === Number(template.template_id))
                    const required = docs.filter((item) => Boolean(item.document_is_required)).length

                    return (
                      <button
                        key={template.template_id}
                        type="button"
                        onClick={() => toggleTemplate(template)}
                        disabled={isSaving}
                        className={`w-full rounded-lg border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                          selected
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="flex gap-2">
                          <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'}`}>
                            {selected ? <FiCheckCircle className="h-3 w-3" /> : null}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-950">{template.template_name}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{template.template_description || 'No description'}</p>
                            <p className="mt-1 text-[11px] font-black text-slate-700">{required} required / {docs.length} docs</p>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            <section className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <FiFileText className="h-4 w-4 text-slate-700" />
                    <h3 className="text-sm font-black text-slate-950">Default Document Requirements</h3>
                  </div>
                  <p className="mt-1 text-xs font-semibold text-slate-500">These become the default checklist for listings created under this project.</p>
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
                  <Badge>{selectedTemplates.length} templates</Badge>
                  <Badge tone="emerald">{requiredCount} required</Badge>
                  <Badge tone="slate">{optionalCount} optional</Badge>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-3">
                  <p className="text-xs font-black text-slate-950">Add Existing Documents</p>
                  <p className="text-[11px] font-semibold text-slate-500">Search active library documents and add them to this project.</p>
                </div>

                <div className="relative mb-3">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Search document library..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div className="grid max-h-[150px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {!isDocumentsLoading && filteredLibraryDocuments.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs font-semibold text-slate-500 md:col-span-2">No available documents found.</p>
                  ) : null}

                  {filteredLibraryDocuments.map((document) => (
                    <div key={document.document_id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 transition hover:border-blue-200 hover:bg-blue-50/40">
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-xs font-black text-slate-950">{document.document_name}</p>
                        <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{document.document_description || 'No description'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addDocument(document)}
                        disabled={isSaving}
                        className="h-9 shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 text-xs font-black text-blue-700 transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 max-h-[470px] space-y-2 overflow-y-auto pr-1">
                {selectedDocuments.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white p-4 text-xs font-semibold text-slate-500">No default documents selected yet.</p>
                ) : null}

                {selectedDocuments.map((document) => (
                  <div key={document.document_id} className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_150px_120px_auto] md:items-center">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-slate-950">{document.document_name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{document.document_description || 'No description'}</p>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-slate-700">Requirement</span>
                      <select
                        value={document.requirement}
                        onChange={(event) => updateDocument(document.document_id, 'requirement', event.target.value)}
                        disabled={isSaving}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="required">Required</option>
                        <option value="optional">Optional</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-slate-700">Status</span>
                      <select
                        value={document.status}
                        onChange={(event) => updateDocument(document.document_id, 'status', event.target.value)}
                        disabled={isSaving}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeDocument(document.document_id)}
                      disabled={isSaving}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-xs font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-xs font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditProjectModal
