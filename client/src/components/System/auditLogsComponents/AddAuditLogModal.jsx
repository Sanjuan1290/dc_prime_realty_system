import { useState } from 'react'
import { FiPlus, FiX } from 'react-icons/fi'

const actionOptions = ['system', 'create', 'update', 'delete', 'send', 'approve', 'reject', 'release', 'view']

const AddAuditLogModal = ({ onClose, onSubmit, isSaving }) => {
  const [form, setForm] = useState({
    action: 'system',
    module: '',
    entityType: '',
    entityId: '',
    title: '',
    description: '',
  })

  const updateField = (field, value) => setForm((current) => ({ ...current, [field]: value }))

  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-xl font-black text-slate-950">Add Manual Audit Entry</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">Use this only for admin notes that need to be part of the audit trail.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-700">Action Label</span>
              <select
                value={form.action}
                onChange={(event) => updateField('action', event.target.value)}
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              >
                {actionOptions.map((action) => <option key={action} value={action}>{action}</option>)}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-700">Module</span>
              <input
                value={form.module}
                onChange={(event) => updateField('module', event.target.value)}
                placeholder="Example: Documents, Users, Payments"
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-700">Entity Type</span>
              <input
                value={form.entityType}
                onChange={(event) => updateField('entityType', event.target.value)}
                placeholder="Example: user, listing, document"
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-black text-slate-700">Entity ID</span>
              <input
                value={form.entityId}
                onChange={(event) => updateField('entityId', event.target.value)}
                placeholder="Example: 15 or LA-0401"
                className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-700">Title <span className="text-red-500">*</span></span>
            <input
              value={form.title}
              onChange={(event) => updateField('title', event.target.value)}
              placeholder="Example: Corrected buyer document status"
              required
              className="h-11 rounded-2xl border border-slate-200 px-4 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-sm font-black text-slate-700">Description</span>
            <textarea
              value={form.description}
              onChange={(event) => updateField('description', event.target.value)}
              placeholder="Write a clear note explaining what happened and why."
              rows={4}
              className="resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-end">
            <button type="button" onClick={onClose} className="h-11 rounded-2xl border border-slate-200 px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FiPlus className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save Audit Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddAuditLogModal
