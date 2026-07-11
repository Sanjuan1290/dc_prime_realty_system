import { useMemo, useState } from 'react'
import { FiCheckCircle, FiSearch, FiX } from 'react-icons/fi'
import StatusAlert from '../../Shared/StatusAlert'

const Field = ({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  required = false,
  helper,
}) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>

    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    />

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const SelectField = ({ label, value, onChange, children, helper }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">{label}</span>

    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
    >
      {children}
    </select>

    {helper ? <p className="text-xs font-semibold text-slate-500">{helper}</p> : null}
  </label>
)

const normalizeRequirement = (value, fallback = 'required') => {
  if (value === false || value === 0 || value === '0') return 'optional'
  if (value === true || value === 1 || value === '1') return 'required'

  const normalized = String(value ?? '').trim().toLowerCase()
  if (normalized === 'optional' || normalized === 'false') return 'optional'
  if (normalized === 'required' || normalized === 'true') return 'required'

  return fallback
}

const normalizeStatus = (value) =>
  String(value || 'active').trim().toLowerCase() === 'inactive' ? 'inactive' : 'active'

const getDocumentId = (document = {}) =>
  Number(document.document_id || document.id || 0)

const normalizeDocument = (document = {}, fallbackRequirement = 'required') => ({
  ...document,
  id: getDocumentId(document),
  document_id: getDocumentId(document),
  name: document.name || document.document_name || 'Unnamed document',
  description: document.description || document.document_description || 'No description',
  requirement: normalizeRequirement(
    document.requirement ??
      document.template_document_list_is_required ??
      document.lot_project_default_document_is_required ??
      document.document_is_required,
    fallbackRequirement
  ),
  status: normalizeStatus(
    document.status ||
      document.lot_project_default_document_status ||
      document.document_status
  ),
})

const normalizeProjectDocuments = (project = {}) =>
  (project.defaultDocuments || project.default_documents || [])
    .map((document) => normalizeDocument(document, 'required'))
    .filter((document) => document.id)

const normalizeCadastralLots = (project = {}) =>
  (project.cadastral_lots || project.cadastralLots || project.cadastralLots || [])
    .map((lot) =>
      String(lot?.lotNumber || lot?.lot_project_cadastral_lot_number || lot || '').trim()
    )
    .filter(Boolean)

const mergeDocumentLists = (currentDocuments = [], incomingDocuments = []) => {
  const merged = new Map(
    currentDocuments
      .map((document) => normalizeDocument(document, 'required'))
      .filter((document) => document.id)
      .map((document) => [document.id, document])
  )

  incomingDocuments
    .map((document) => normalizeDocument(document, 'required'))
    .filter((document) => document.id)
    .forEach((document) => {
      const existing = merged.get(document.id)

      if (!existing) {
        merged.set(document.id, document)
        return
      }

      merged.set(document.id, {
        ...existing,
        name: existing.name || document.name,
        description: existing.description || document.description,
        requirement:
          existing.requirement === 'required' || document.requirement === 'required'
            ? 'required'
            : 'optional',
      })
    })

  return Array.from(merged.values())
}

const AddLotProjectModal = ({
  project = null,
  mode = 'create',
  documents = [],
  templates = [],
  templateDocuments = [],
  isLoadingDocuments = false,
  isSaving: externalIsSaving = false,
  onClose,
  onSave,
}) => {
  const isEdit = mode === 'edit' || Boolean(project)

  const [form, setForm] = useState(() => ({
    name: project?.project_bailen_name || project?.lot_project_name || project?.name || '',
    location: project?.project_bailen_location || project?.lot_project_location || project?.location || '',
    locationCode: project?.project_bailen_location_code || project?.lot_project_location_code || project?.locationCode || '',
    administrator: project?.project_bailen_administrator_name || project?.lot_project_administrator_name || project?.administrator || '',
    taxDeclarationNo: project?.project_bailen_tax_declaration_no || project?.lot_project_tax_declaration_no || project?.taxDeclarationNo || '',
    pin: project?.project_bailen_pin || project?.lot_project_pin || project?.pin || '',
    status: project?.project_bailen_status || project?.lot_project_status || project?.status || 'active',
  }))

  const [cadastralInput, setCadastralInput] = useState('')
  const [cadastralLots, setCadastralLots] = useState(() => normalizeCadastralLots(project || {}))
  const [templateSearch, setTemplateSearch] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([])
  const [alert, setAlert] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedDocuments, setSelectedDocuments] = useState(() => normalizeProjectDocuments(project || {}))
  const isSaving = externalIsSaving || isSubmitting

  const documentLibrary = useMemo(
    () =>
      documents
        .filter((document) => document.document_status === 'active')
        .map(normalizeDocument),
    [documents]
  )

  const documentTemplates = useMemo(
    () =>
      templates
        .filter((template) => template.template_status === 'active')
        .map((template) => {
          const docs = templateDocuments
            .filter((item) => Number(item.template_id) === Number(template.template_id))
            .map((item) => ({
              documentId: Number(item.document_id),
              requirement: normalizeRequirement(
                item.template_document_list_is_required ?? item.document_is_required,
                'required'
              ),
              status: normalizeStatus(item.document_status),
            }))
            .filter((item) => item.documentId)

          return {
            id: template.template_id,
            name: template.template_name,
            description: template.template_description || 'No description',
            docs,
            required: docs.filter((document) => document.requirement === 'required').length,
          }
        }),
    [templates, templateDocuments]
  )

  const selectedDocIds = useMemo(
    () => new Set(selectedDocuments.map((document) => document.id)),
    [selectedDocuments]
  )

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase()

    if (!keyword) return documentTemplates

    return documentTemplates.filter((template) =>
      template.name.toLowerCase().includes(keyword)
    )
  }, [documentTemplates, templateSearch])

  const filteredDocuments = useMemo(() => {
    const keyword = documentSearch.trim().toLowerCase()

    if (!keyword) return documentLibrary

    return documentLibrary.filter((document) =>
      document.name.toLowerCase().includes(keyword)
    )
  }, [documentLibrary, documentSearch])

  const requiredCount = useMemo(
    () => selectedDocuments.filter((document) => document.requirement === 'required').length,
    [selectedDocuments]
  )

  const optionalCount = useMemo(
    () => selectedDocuments.filter((document) => document.requirement === 'optional').length,
    [selectedDocuments]
  )

  const updateForm = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))

    if (alert?.type === 'error') {
      setAlert(null)
    }
  }

  const addCadastralLot = () => {
    const value = cadastralInput.trim()

    if (!value) {
      setAlert({ type: 'error', message: 'Enter cadastral lot number first.' })
      return
    }

    if (cadastralLots.includes(value)) {
      setAlert({ type: 'warning', message: 'This cadastral lot number is already added.' })
      return
    }

    setCadastralLots((current) => [...current, value])
    setCadastralInput('')
    setAlert({ type: 'success', message: `${value} added to cadastral lots.` })
  }

  const removeCadastralLot = (lot) => {
    setCadastralLots((current) => current.filter((item) => item !== lot))
    setAlert({ type: 'warning', message: `${lot} removed from cadastral lots.` })
  }

  const addDocument = (document) => {
    if (selectedDocIds.has(document.id)) {
      setAlert({ type: 'info', message: 'Document is already added.' })
      return
    }

    setSelectedDocuments((current) => mergeDocumentLists(current, [document]))
    setAlert({ type: 'success', message: `${document.name} added.` })
  }

  const removeDocument = (documentId) => {
    setSelectedDocuments((current) =>
      current.filter((document) => document.id !== documentId)
    )

    setAlert({ type: 'warning', message: 'Document removed from default requirements.' })
  }

  const updateDocument = (documentId, key, value) => {
    setSelectedDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, [key]: value } : document
      )
    )
  }

  const getDocumentsFromTemplates = (templateRows = []) =>
    templateRows.flatMap((template) =>
      template.docs
        .map((templateDocument) => {
          const libraryDocument = documentLibrary.find(
            (document) => document.id === templateDocument.documentId
          )

          if (!libraryDocument) return null

          return {
            ...libraryDocument,
            requirement: templateDocument.requirement,
            status: templateDocument.status,
          }
        })
        .filter(Boolean)
    )

  const toggleTemplate = (template) => {
    const exists = selectedTemplateIds.includes(template.id)

    if (exists) {
      setSelectedTemplateIds((current) => current.filter((id) => id !== template.id))
      setAlert({ type: 'warning', message: `${template.name} template unchecked. Documents are kept for manual review.` })
      return
    }

    setSelectedTemplateIds((current) => [...current, template.id])
    setSelectedDocuments((current) =>
      mergeDocumentLists(current, getDocumentsFromTemplates([template]))
    )

    setAlert({
      type: 'success',
      message: `${template.name} template selected.`,
    })
  }

  const selectAllTemplates = () => {
    setSelectedTemplateIds(documentTemplates.map((template) => template.id))
    setSelectedDocuments((current) =>
      mergeDocumentLists(current, getDocumentsFromTemplates(documentTemplates))
    )
    setAlert({ type: 'success', message: 'All document templates selected.' })
  }

  const clearTemplates = () => {
    setSelectedTemplateIds([])
    setAlert({
      type: 'warning',
      message: 'All templates unchecked. Documents are kept for manual review.',
    })
  }

  const useAllLibraryDocs = () => {
    setSelectedDocuments((current) => mergeDocumentLists(current, documentLibrary))
    setAlert({ type: 'success', message: 'All library documents added.' })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!form.name.trim()) {
      setAlert({ type: 'error', message: 'Project name is required.' })
      return
    }

    if (!form.location.trim()) {
      setAlert({ type: 'error', message: 'Project location is required.' })
      return
    }

    if (!form.locationCode.trim()) {
      setAlert({ type: 'error', message: 'Location code is required.' })
      return
    }

    setIsSubmitting(true)
    setAlert({
      type: 'loading',
      message: isEdit ? 'Saving project changes...' : 'Adding lot project...',
    })

    try {
      await onSave({
        name: form.name.trim(),
        location: form.location.trim(),
        locationCode: form.locationCode.trim().toUpperCase(),
        administrator: form.administrator.trim(),
        taxDeclarationNo: form.taxDeclarationNo.trim(),
        pin: form.pin.trim(),
        status: form.status,
        cadastralLots,
        defaultDocuments: selectedDocuments.map((document) => ({
          document_id: document.id,
          requirement: document.requirement,
          status: document.status,
          is_required: document.requirement === 'required',
        })),
      })
    } catch (error) {
      setIsSubmitting(false)
      setAlert({
        type: 'error',
        message: error.message || (isEdit ? 'Failed to save project changes.' : 'Failed to add lot project.'),
      })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <form
        onSubmit={handleSubmit}
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-base font-black text-slate-950">{isEdit ? 'Edit Lot Project' : 'Add Lot Project'}</h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50 p-4">
          {alert ? (
            <StatusAlert
              type={alert.type}
              message={alert.message}
              onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          {isLoadingDocuments ? (
            <StatusAlert
              type="loading"
              message="Loading document library and templates..."
              className="mb-4"
            />
          ) : null}

          <div className="grid gap-4 xl:grid-cols-[0.75fr_1fr]">
            <div className="flex flex-col gap-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-950">
                  Project Information
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Basic project details and status.
                </p>

                <div className="mt-4 grid gap-3">
                  <Field
                    label="Project Name"
                    value={form.name}
                    onChange={(value) => updateForm('name', value)}
                    placeholder="Example: Bailen Project"
                    required
                  />

                  <Field
                    label="Location"
                    value={form.location}
                    onChange={(value) => updateForm('location', value)}
                    placeholder="Example: Bailen, Cavite"
                    required
                  />

                  <Field
                    label="Location Code"
                    value={form.locationCode}
                    onChange={(value) => updateForm('locationCode', value)}
                    placeholder="ex. LA, PE"
                    helper="This becomes the unit prefix."
                    required
                  />

                  <Field
                    label="Administrator"
                    value={form.administrator}
                    onChange={(value) => updateForm('administrator', value)}
                    placeholder="Enter admin name"
                  />

                  <Field
                    label="Tax Declaration No."
                    value={form.taxDeclarationNo}
                    onChange={(value) => updateForm('taxDeclarationNo', value)}
                    placeholder="AA-06-0005-xxxxx"
                  />

                  <Field
                    label="PIN"
                    value={form.pin}
                    onChange={(value) => updateForm('pin', value)}
                    placeholder="022-06-0005-xxx-xx"
                  />

                  <div>
                    <div className="flex items-end gap-2">
                      <div className="flex-1">
                        <Field
                          label="Cadastral Lot Numbers"
                          value={cadastralInput}
                          onChange={setCadastralInput}
                          placeholder="Example: 1306"
                          helper="Add values like 1306 or 1307. Listings will select from these."
                        />
                      </div>

                      <button
                        type="button"
                        onClick={addCadastralLot}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        Add
                      </button>
                    </div>

                    {cadastralLots.length ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {cadastralLots.map((lot) => (
                          <button
                            key={lot}
                            type="button"
                            onClick={() => removeCadastralLot(lot)}
                            className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 transition hover:bg-blue-100"
                          >
                            {lot} ×
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-2 rounded-lg border border-dashed border-blue-200 bg-blue-50 p-3 text-xs font-semibold text-blue-700">
                        No cadastral lot numbers yet. Add at least one if this project has fixed cadastral lots.
                      </div>
                    )}
                  </div>

                  <SelectField
                    label="Status"
                    value={form.status}
                    onChange={(value) => updateForm('status', value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </SelectField>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h3 className="text-sm font-black text-slate-950">
                  Document Templates
                </h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Select one or more templates. The selected documents appear on the right immediately.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllTemplates}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Select All Templates
                  </button>

                  <button
                    type="button"
                    onClick={clearTemplates}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Clear Templates
                  </button>

                  <button
                    type="button"
                    onClick={useAllLibraryDocs}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                  >
                    Use All Library Docs
                  </button>
                </div>

                <div className="relative mt-4">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div className="mt-3 max-h-[320px] space-y-2 overflow-y-auto pr-1">
                  {filteredTemplates.map((template) => {
                    const selected = selectedTemplateIds.includes(template.id)

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => toggleTemplate(template)}
                        className={`w-full rounded-xl border p-3 text-left transition ${
                          selected
                            ? 'border-blue-400 bg-blue-50 ring-2 ring-blue-100'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleTemplate(template)}
                            onClick={(event) => event.stopPropagation()}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300"
                          />

                          <div>
                            <p className="text-xs font-black text-slate-950">
                              {template.name}
                            </p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {template.description}
                            </p>

                            <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">
                              {template.required} required / {template.docs.length} docs
                            </span>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </section>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-950">
                    Default Document Requirements
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    These become the default checklist for listings created under this project.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">
                    {selectedTemplateIds.length} templates
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                    {requiredCount} required
                  </span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
                    {optionalCount} optional
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {selectedTemplateIds.map((id) => {
                  const template = documentTemplates.find((item) => item.id === id)

                  if (!template) return null

                  return (
                    <span
                      key={id}
                      className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-black text-blue-700"
                    >
                      {template.name} ×
                    </span>
                  )
                })}
              </div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h4 className="text-sm font-black text-slate-950">
                  Add Existing Documents
                </h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Create missing documents in Document Library first, then search and add them here.
                </p>

                <div className="relative mt-3">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Search document library..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div className="mt-3 grid max-h-[150px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {filteredDocuments.map((document) => {
                    const added = selectedDocIds.has(document.id)

                    return (
                      <div
                        key={document.id}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-3"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-950">
                            {document.name}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">
                            {document.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => addDocument(document)}
                          disabled={added}
                          className={`h-8 rounded-lg border px-3 text-xs font-black transition ${
                            added
                              ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
                              : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                          }`}
                        >
                          {added ? 'Added' : 'Add'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-4 max-h-[430px] space-y-3 overflow-y-auto pr-1">
                {selectedDocuments.map((document) => (
                  <div
                    key={document.id}
                    className="grid gap-3 rounded-xl border border-slate-200 bg-white p-3 md:grid-cols-[1fr_130px_130px_auto] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-950">
                        {document.name}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {document.description}
                      </p>
                    </div>

                    <SelectField
                      label="Requirement"
                      value={document.requirement}
                      onChange={(value) =>
                        updateDocument(document.id, 'requirement', value)
                      }
                    >
                      <option value="required">Required</option>
                      <option value="optional">Optional</option>
                    </SelectField>

                    <SelectField
                      label="Status"
                      value={document.status}
                      onChange={(value) =>
                        updateDocument(document.id, 'status', value)
                      }
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </SelectField>

                    <button
                      type="button"
                      onClick={() => removeDocument(document.id)}
                      className="h-10 rounded-lg bg-red-600 px-4 text-sm font-black text-white transition hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}

                {!selectedDocuments.length ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center text-sm font-semibold text-slate-500">
                    No documents selected yet.
                  </div>
                ) : null}
              </div>
            </section>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Saving...
              </>
            ) : (
              <>
                <FiCheckCircle className="h-4 w-4" />
                {isEdit ? 'Save Changes' : 'Add Lot Project'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default AddLotProjectModal

