import React, { useMemo, useState } from 'react'
import { FiCheckSquare, FiFileText, FiPlus, FiSearch, FiX } from 'react-icons/fi'

const templates = [
  {
    id: 1,
    name: "Required for Submission (For OFW's or Representative)",
    description: 'No description',
    docs: '2 required / 2 docs',
  },
  {
    id: 2,
    name: "Required for Submission (For Married Client's)",
    description: 'No description',
    docs: '4 required / 4 docs',
  },
  {
    id: 3,
    name: 'Required for Submission',
    description: 'No description',
    docs: '14 required / 14 docs',
  },
]

const libraryDocuments = [
  { id: 1, name: "CLIENT REGISTRATION FORM (Seller's Copy)", description: 'No description' },
  { id: 2, name: 'CLIENT REGISTRATION FORM (Administrator Copy)', description: 'No description' },
  { id: 3, name: "BUYER'S INFORMATION FORM", description: 'No description' },
  { id: 4, name: 'INTENT TO BUY', description: 'No description' },
]

const selectedDocuments = [
  { id: 1, name: "Two valid Government-issued ID's (w/ 3 specimen signatures)", source: 'From library' },
  { id: 2, name: 'TIN No. / TIN ID', source: 'From library' },
  { id: 3, name: 'PSA (Single)', source: 'From library' },
  { id: 4, name: "CLIENT REGISTRATION FORM (Seller's Copy)", source: 'From library' },
  { id: 5, name: 'CLIENT REGISTRATION FORM (Administrator Copy)', source: 'From library' },
]

const Field = ({ label, value, onChange, type = 'text' }) => (
  <label className="flex flex-col gap-1.5">
    <span className="text-sm font-bold text-slate-700">{label}</span>
    <input
      type={type}
      value={value}
      onChange={onChange}
      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
)

const EditProjectModal = ({ project, onClose }) => {
  const [form, setForm] = useState({
    name: project.project_bailen_name || '',
    location: project.project_bailen_location || '',
    locationCode: project.project_bailen_location_code || '',
    administrator: project.project_bailen_administrator_name || '',
    taxDeclarationNo: project.project_bailen_tax_declaration_no || '',
    pin: project.project_bailen_pin || '',
    status: project.project_bailen_status || 'active',
  })

  const [lotNumbers, setLotNumbers] = useState(project.project_bailen_cadastral_lot_numbers || [])
  const [templateSearch, setTemplateSearch] = useState('')
  const [documentSearch, setDocumentSearch] = useState('')
  const [checkedTemplates, setCheckedTemplates] = useState([3])

  const filteredTemplates = useMemo(() => {
    const keyword = templateSearch.trim().toLowerCase()
    if (!keyword) return templates
    return templates.filter((template) => template.name.toLowerCase().includes(keyword))
  }, [templateSearch])

  const filteredDocuments = useMemo(() => {
    const keyword = documentSearch.trim().toLowerCase()
    if (!keyword) return libraryDocuments
    return libraryDocuments.filter((document) => document.name.toLowerCase().includes(keyword))
  }, [documentSearch])

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const addLotNumber = () => {
    setLotNumbers((current) => [...current, ''])
  }

  const updateLotNumber = (index, value) => {
    setLotNumbers((current) => current.map((item, itemIndex) => (itemIndex === index ? value : item)))
  }

  const removeLotNumber = (index) => {
    setLotNumbers((current) => current.filter((_, itemIndex) => itemIndex !== index))
  }

  const toggleTemplate = (templateId) => {
    setCheckedTemplates((current) =>
      current.includes(templateId)
        ? current.filter((id) => id !== templateId)
        : [...current, templateId]
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-3">
      <div className="flex h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Edit Project</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close edit project"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 xl:grid-cols-[0.9fr_1.2fr]">
          <div className="flex flex-col gap-5">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-4">
                <h3 className="text-base font-bold text-slate-950">Project Information</h3>
                <p className="text-sm text-slate-500">Basic project details and status.</p>
              </div>

              <div className="grid gap-4">
                <Field label="Project name" value={form.name} onChange={(event) => updateField('name', event.target.value)} />
                <Field label="Location" value={form.location} onChange={(event) => updateField('location', event.target.value)} />
                <Field label="Location Code" value={form.locationCode} onChange={(event) => updateField('locationCode', event.target.value)} />
                <Field label="Administrator" value={form.administrator} onChange={(event) => updateField('administrator', event.target.value)} />
                <Field label="Tax declaration no." value={form.taxDeclarationNo} onChange={(event) => updateField('taxDeclarationNo', event.target.value)} />
                <Field label="PIN" value={form.pin} onChange={(event) => updateField('pin', event.target.value)} />

                <div>
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold text-slate-700">Cadastral Lot Numbers</h4>
                      <p className="text-xs text-slate-500">Add values like 1306 or 1307. Listings will select from these.</p>
                    </div>
                    <button
                      type="button"
                      onClick={addLotNumber}
                      className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <FiPlus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    {lotNumbers.map((lotNumber, index) => (
                      <div key={`${lotNumber}-${index}`} className="grid grid-cols-[1fr_auto] gap-2">
                        <input
                          type="text"
                          value={lotNumber}
                          onChange={(event) => updateLotNumber(index, event.target.value)}
                          className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                        />
                        <button
                          type="button"
                          onClick={() => removeLotNumber(index)}
                          className="h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="flex flex-col gap-1.5">
                  <span className="text-sm font-bold text-slate-700">Status</span>
                  <select
                    value={form.status}
                    onChange={(event) => updateField('status', event.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="ended">Ended</option>
                  </select>
                </label>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <div className="mb-4 flex items-start gap-2">
                <FiFileText className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                <div>
                  <h3 className="text-base font-bold text-slate-950">Document Templates</h3>
                  <p className="text-sm text-slate-500">Select one or more templates. Selected documents appear on the right.</p>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                <button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Select All Templates</button>
                <button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Clear Templates</button>
                <button type="button" className="h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50">Use All Library Docs</button>
              </div>

              <label className="relative mb-4 block">
                <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                  placeholder="Search templates..."
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>

              <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
                {filteredTemplates.map((template) => {
                  const checked = checkedTemplates.includes(template.id)

                  return (
                    <label
                      key={template.id}
                      className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-4 transition ${checked ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-200'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleTemplate(template.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-950">{template.name}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{template.description}</p>
                        <p className="mt-2 text-xs font-bold text-slate-600">{template.docs}</p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>
          </div>

          <section className="flex min-h-0 flex-col rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="shrink-0 border-b border-slate-200 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-2">
                  <FiCheckSquare className="mt-1 h-4 w-4 shrink-0 text-slate-600" />
                  <div>
                    <h3 className="text-base font-bold text-slate-950">Default Document Requirements</h3>
                    <p className="text-sm text-slate-500">These become the default checklist for listings created under this project.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">1 templates</span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">14 required</span>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">0 optional</span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                  Required for Submission
                  <button type="button" className="text-blue-500 hover:text-blue-800">×</button>
                </span>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                <h4 className="text-sm font-bold text-slate-950">Add Existing Documents</h4>
                <p className="mt-1 text-xs text-slate-500">Create missing documents in Document Library first, then search and add them here.</p>

                <label className="relative mt-3 block">
                  <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={documentSearch}
                    onChange={(event) => setDocumentSearch(event.target.value)}
                    placeholder="Search document library..."
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {filteredDocuments.map((document) => (
                    <div key={document.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
                      <div>
                        <p className="text-sm font-bold leading-5 text-slate-950">{document.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{document.description}</p>
                      </div>
                      <button
                        type="button"
                        className="h-9 shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-500"
                      >
                        Added
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {selectedDocuments.map((document) => (
                  <div key={document.id} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 lg:grid-cols-[1fr_auto_auto_auto] lg:items-center">
                    <div>
                      <h4 className="text-sm font-bold leading-5 text-slate-950">{document.name}</h4>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{document.source}</p>
                    </div>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-600">Requirement</span>
                      <select className="h-11 min-w-36 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option>Required</option>
                        <option>Optional</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-bold text-slate-600">Status</span>
                      <select className="h-11 min-w-32 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option>Active</option>
                        <option>Inactive</option>
                      </select>
                    </label>

                    <button
                      type="button"
                      className="h-11 rounded-xl bg-red-600 px-4 text-sm font-bold text-white transition hover:bg-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Save Project Changes
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditProjectModal
