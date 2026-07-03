import React from 'react'
import { FiEdit3, FiPrinter, FiX } from 'react-icons/fi'

const DetailItem = ({ label, value }) => (
  <div className="min-w-0">
    <p className="text-sm font-bold text-slate-950">{label}: <span className="font-semibold text-slate-700">{value || '-'}</span></p>
  </div>
)

const ProjectDetailsModal = ({ project, onClose, onEdit }) => {
  const cadastralLots = project.project_bailen_cadastral_lot_numbers?.length
    ? project.project_bailen_cadastral_lot_numbers.join(', ')
    : '-'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-950">Project Details</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close project details"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-x-12 gap-y-5 p-6 text-sm md:grid-cols-2">
          <DetailItem label="ID" value={project.project_bailen_id} />
          <DetailItem label="Name" value={project.project_bailen_name} />
          <DetailItem label="Location" value={project.project_bailen_location} />
          <DetailItem label="Location Code" value={project.project_bailen_location_code} />
          <DetailItem label="Administrator" value={project.project_bailen_administrator_name} />
          <DetailItem label="Tax Declaration No." value={project.project_bailen_tax_declaration_no} />
          <DetailItem label="PIN" value={project.project_bailen_pin} />
          <DetailItem label="Cadastral Lot Numbers" value={cadastralLots} />
          <DetailItem label="Status" value={project.project_bailen_status} />
          <DetailItem label="Document Template" value={project.project_bailen_document_template} />
          <DetailItem label="Default Documents" value={project.project_bailen_default_documents} />
          <DetailItem label="Required Documents" value={project.project_bailen_required_documents} />
          <DetailItem label="Ended At" value={project.project_bailen_ended_at || '-'} />
          <DetailItem label="Created At" value={project.project_bailen_created_at} />
          <DetailItem label="Updated At" value={project.project_bailen_updated_at} />
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            <FiPrinter className="h-4 w-4" />
            Print Price List
          </button>

          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            <FiEdit3 className="h-4 w-4" />
            Edit
          </button>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

export default ProjectDetailsModal
