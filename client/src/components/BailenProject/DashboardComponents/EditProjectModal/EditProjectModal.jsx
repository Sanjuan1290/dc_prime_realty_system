import { useMemo, useState } from 'react'
import {
  FiCheckCircle,
  FiFileText,
  FiPlus,
  FiSave,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import StatusAlert from '../../../Shared/StatusAlert'

const templateOptions = [
  {
    id: 1,
    name: "Required for Submission(For OFW's or Representative)",
    description: 'No description',
    required: 2,
    total: 2,
  },
  {
    id: 2,
    name: "Required for Submission(For Married Client's)",
    description: 'No description',
    required: 4,
    total: 4,
  },
  {
    id: 3,
    name: 'Required for Submission',
    description: 'No description',
    required: 14,
    total: 14,
  },
]

const libraryDocuments = [
  { id: 1, name: "CLIENT REGISTRATION FORM (Seller's Copy)", description: 'No description' },
  { id: 2, name: 'CLIENT REGISTRATION FORM (Administrator Copy)', description: 'No description' },
  { id: 3, name: "BUYER'S INFORMATION FORM", description: 'No description' },
  { id: 4, name: 'INTENT TO BUY', description: 'No description' },
  { id: 5, name: "OFFER TO BUY & BUYER'S PROFILE", description: 'No description' },
  { id: 6, name: 'RESERVATION AGREEMENT', description: 'No description' },
]

const defaultDocuments = [
  {
    id: 7,
    name: 'Two valid Government-issued ID’s (w/ 3 specimen signatures)',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 8,
    name: 'TIN No. / TIN ID',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 9,
    name: 'PSA (Single)',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 1,
    name: "CLIENT REGISTRATION FORM (Seller's Copy)",
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 2,
    name: 'CLIENT REGISTRATION FORM (Administrator Copy)',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 3,
    name: "BUYER'S INFORMATION FORM",
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 4,
    name: 'INTENT TO BUY',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 5,
    name: "OFFER TO BUY & BUYER'S PROFILE",
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 6,
    name: 'RESERVATION AGREEMENT',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 10,
    name: 'Proof of Income',
    description: 'From library',
    requirement: 'optional',
    status: 'active',
  },
  {
    id: 11,
    name: 'Proof of Billing',
    description: 'From library',
    requirement: 'optional',
    status: 'active',
  },
  {
    id: 12,
    name: 'Birth Certificate',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
  {
    id: 13,
    name: 'Marriage Certificate',
    description: 'From library',
    requirement: 'optional',
    status: 'active',
  },
  {
    id: 14,
    name: 'Signed Reservation Agreement',
    description: 'From library',
    requirement: 'required',
    status: 'active',
  },
]

const Field = ({ label, value, onChange, placeholder }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-xs font-black text-slate-700">{label}</span>
    <input
      value={value}
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
    project_bailen_name: project?.project_bailen_name || 'Bailen Project',
    project_bailen_location: project?.project_bailen_location || 'Bailen, Cavite',
    project_bailen_location_code: project?.project_bailen_location_code || 'LA',
    project_bailen_administrator_name: project?.project_bailen_administrator_name || 'IMELDA B. VILLALOBOS',
    project_bailen_tax_declaration_no: project?.project_bailen_tax_declaration_no || 'AA-06-0005-00105',
    project_bailen_pin: project?.project_bailen_pin || '022-06-0005-003-04',
    project_bailen_status: project?.project_bailen_status || 'active',
  })

  const [lots, setLots] = useState(() => {
    const projectLots = project?.cadastral_lots?.length
      ? project.cadastral_lots.map((lot) => lot.lotNumber || lot.bailen_cadastral_lot_number || lot)
      : ['1306', '1314']

    return projectLots.filter(Boolean)
  })

  const [templates, setTemplates] = useState([3])
  const [documents, setDocuments] = useState(defaultDocuments)
  const [templateSearch, setTemplateSearch] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [alert, setAlert] = useState(null)

  const requiredCount = useMemo(
    () => documents.filter((document) => document.requirement === 'required').length,
    [documents]
  )

  const optionalCount = useMemo(
    () => documents.filter((document) => document.requirement === 'optional').length,
    [documents]
  )

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase()
    if (!keyword) return templateOptions
    return templateOptions.filter((template) => template.name.toLowerCase().includes(keyword))
  }, [templateSearch])

  const filteredLibraryDocuments = useMemo(() => {
    const keyword = documentSearch.trim().toLowerCase()
    if (!keyword) return libraryDocuments
    return libraryDocuments.filter((document) => document.name.toLowerCase().includes(keyword))
  }, [documentSearch])

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const updateLot = (index, value) => {
    setLots((current) => current.map((lot, lotIndex) => (lotIndex === index ? value : lot)))
  }

  const addLot = () => {
    setLots((current) => [...current, ''])
    setAlert({ type: 'info', message: 'New cadastral lot field added.' })
  }

  const removeLot = (index) => {
    setLots((current) => current.filter((_, lotIndex) => lotIndex !== index))
    setAlert({ type: 'warning', message: 'Cadastral lot removed from this mock form.' })
  }

  const toggleTemplate = (templateId) => {
    setTemplates((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId]
    )
  }

  const addDocument = (document) => {
    const exists = documents.some((item) => item.id === document.id)
    if (exists) {
      setAlert({ type: 'info', message: 'Document is already included.' })
      return
    }

    setDocuments((current) => [
      ...current,
      {
        ...document,
        description: 'From library',
        requirement: 'required',
        status: 'active',
      },
    ])
    setAlert({ type: 'success', message: `${document.name} added.` })
  }

  const removeDocument = (documentId) => {
    setDocuments((current) => current.filter((document) => document.id !== documentId))
    setAlert({ type: 'warning', message: 'Document removed from default requirements.' })
  }

  const updateDocument = (documentId, key, value) => {
    setDocuments((current) =>
      current.map((document) =>
        document.id === documentId ? { ...document, [key]: value } : document
      )
    )
  }

  const selectAllTemplates = () => {
    setTemplates(templateOptions.map((template) => template.id))
    setAlert({ type: 'success', message: 'All templates selected.' })
  }

  const clearTemplates = () => {
    setTemplates([])
    setAlert({ type: 'warning', message: 'Template selection cleared.' })
  }

  const handleSubmit = (event) => {
    event.preventDefault()

    if (!form.project_bailen_name.trim()) {
      setAlert({ type: 'error', message: 'Project name is required.' })
      return
    }

    if (!form.project_bailen_location.trim()) {
      setAlert({ type: 'error', message: 'Location is required.' })
      return
    }

    const payload = {
      ...form,
      project_bailen_location_code: form.project_bailen_location_code.trim().toUpperCase(),
      cadastral_lots: lots.filter((lot) => lot.trim()),
      template_ids: templates,
      default_documents: documents,
    }

    setAlert({ type: 'success', message: 'Mock project changes saved.' })
    onSave?.(payload)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-3">
      <form
        onSubmit={handleSubmit}
        className="flex h-[94vh] w-full max-w-7xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-base font-black text-slate-950">Edit Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
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
              onClose={() => setAlert(null)}
              className="mb-4"
            />
          ) : null}

          {isSaving ? (
            <StatusAlert type="loading" message="Saving mock project changes..." className="mb-4" />
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr]">
            <div className="flex min-w-0 flex-col gap-4">
              <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="mb-4">
                  <h3 className="text-sm font-black text-slate-950">Project Information</h3>
                  <p className="text-xs font-semibold text-slate-500">Basic project details and status.</p>
                </div>

                <div className="grid gap-3">
                  <Field
                    label="Project name"
                    value={form.project_bailen_name}
                    onChange={(value) => updateField('project_bailen_name', value)}
                    placeholder="Bailen Project"
                  />
                  <Field
                    label="Location"
                    value={form.project_bailen_location}
                    onChange={(value) => updateField('project_bailen_location', value)}
                    placeholder="Bailen, Cavite"
                  />
                  <Field
                    label="Location Code"
                    value={form.project_bailen_location_code}
                    onChange={(value) => updateField('project_bailen_location_code', value)}
                    placeholder="LA"
                  />
                  <Field
                    label="Administrator"
                    value={form.project_bailen_administrator_name}
                    onChange={(value) => updateField('project_bailen_administrator_name', value)}
                    placeholder="Administrator"
                  />
                  <Field
                    label="Tax declaration no."
                    value={form.project_bailen_tax_declaration_no}
                    onChange={(value) => updateField('project_bailen_tax_declaration_no', value)}
                    placeholder="AA-06-0005-00105"
                  />
                  <Field
                    label="PIN"
                    value={form.project_bailen_pin}
                    onChange={(value) => updateField('project_bailen_pin', value)}
                    placeholder="022-06-0005-003-04"
                  />

                  <div>
                    <div className="mb-2 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-black text-slate-700">Cadastral Lot Numbers</p>
                        <p className="text-[11px] font-semibold text-slate-500">
                          Add values like 1306 or 1307. Listings will select from these.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={addLot}
                        className="inline-flex h-9 items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-50"
                      >
                        <FiPlus className="h-3.5 w-3.5" />
                        Add
                      </button>
                    </div>

                    <div className="grid gap-2">
                      {lots.map((lot, index) => (
                        <div key={`${lot}-${index}`} className="flex gap-2">
                          <input
                            value={lot}
                            onChange={(event) => updateLot(index, event.target.value)}
                            placeholder="1306"
                            className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                          />
                          <button
                            type="button"
                            onClick={() => removeLot(index)}
                            className="h-10 rounded-lg bg-red-600 px-4 text-xs font-black text-white transition hover:bg-red-700"
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
                      value={form.project_bailen_status}
                      onChange={(event) => updateField('project_bailen_status', event.target.value)}
                      className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
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
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    Select one or more templates. The selected documents appear on the right immediately.
                  </p>
                </div>

                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={selectAllTemplates}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Select All Templates
                  </button>
                  <button
                    type="button"
                    onClick={clearTemplates}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Clear Templates
                  </button>
                  <button
                    type="button"
                    onClick={() => setAlert({ type: 'info', message: 'All library documents were applied in mock mode.' })}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    Use All Library Docs
                  </button>
                </div>

                <div className="relative mb-3">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={templateSearch}
                    onChange={(event) => setTemplateSearch(event.target.value)}
                    placeholder="Search templates..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div className="max-h-[285px] space-y-2 overflow-y-auto pr-1">
                  {filteredTemplates.map((template) => {
                    const selected = templates.includes(template.id)

                    return (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => toggleTemplate(template.id)}
                        className={`w-full rounded-lg border p-3 text-left transition ${
                          selected
                            ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-300'
                            : 'border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/40'
                        }`}
                      >
                        <div className="flex gap-2">
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                            }`}
                          >
                            {selected ? <FiCheckCircle className="h-3 w-3" /> : null}
                          </span>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-950">{template.name}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{template.description}</p>
                            <p className="mt-1 text-[11px] font-black text-slate-700">
                              {template.required} required / {template.total} docs
                            </p>
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
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    These become the default checklist for listings created under this project. Listings can still be customized later.
                  </p>
                </div>
                <div className="flex shrink-0 flex-row gap-2 sm:flex-col sm:items-end">
                  <Badge>{templates.length} templates</Badge>
                  <Badge tone="emerald">{requiredCount} required</Badge>
                  <Badge tone="slate">{optionalCount} optional</Badge>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {templates.map((templateId) => {
                  const template = templateOptions.find((item) => item.id === templateId)
                  if (!template) return null

                  return (
                    <button
                      key={templateId}
                      type="button"
                      onClick={() => toggleTemplate(templateId)}
                      className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-[11px] font-black text-blue-700 transition hover:bg-blue-200"
                    >
                      {template.name}
                      <FiX className="h-3 w-3" />
                    </button>
                  )
                })}
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="mb-3">
                  <p className="text-xs font-black text-slate-950">Add Existing Documents</p>
                  <p className="text-[11px] font-semibold text-slate-500">
                    Create missing documents in Document Library first, then search and add them here.
                  </p>
                </div>

                <div className="relative mb-3">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Search document library..."
                    className="h-10 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </div>

                <div className="grid max-h-[150px] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
                  {filteredLibraryDocuments.map((document) => {
                    const added = documents.some((item) => item.id === document.id)

                    return (
                      <div
                        key={document.id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-xs font-black text-slate-950">{document.name}</p>
                          <p className="mt-0.5 text-[11px] font-semibold text-slate-500">{document.description}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => addDocument(document)}
                          disabled={added}
                          className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-black transition ${
                            added
                              ? 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400'
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

              <div className="mt-3 max-h-[470px] space-y-2 overflow-y-auto pr-1">
                {documents.map((document) => (
                  <div
                    key={document.id}
                    className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-[1fr_150px_120px_auto] md:items-center"
                  >
                    <div className="min-w-0">
                      <p className="break-words text-sm font-black text-slate-950">{document.name}</p>
                      <p className="mt-1 text-[11px] font-semibold text-slate-500">{document.description}</p>
                    </div>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-slate-700">Requirement</span>
                      <select
                        value={document.requirement}
                        onChange={(event) => updateDocument(document.id, 'requirement', event.target.value)}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="required">Required</option>
                        <option value="optional">Optional</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-black text-slate-700">Status</span>
                      <select
                        value={document.status}
                        onChange={(event) => updateDocument(document.id, 'status', event.target.value)}
                        className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      onClick={() => removeDocument(document.id)}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-red-600 px-3 text-xs font-black text-white transition hover:bg-red-700"
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
            <FiSave className="h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default EditProjectModal