import React, { useMemo, useState } from 'react'
import { FiBarChart2, FiEdit3, FiEye, FiFileText, FiGrid, FiMapPin, FiPlus, FiPrinter } from 'react-icons/fi'
import PageHeader from '../../components/Shared/PageHeader'
import EditProjectModal from '../../components/BailenProject/DashboardComponents/EditProjectModal/EditProjectModal'
import ProjectDetailsModal from '../../components/BailenProject/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal'

const project = {
  project_bailen_id: 1,
  project_bailen_name: 'Bailen Project',
  project_bailen_location: 'Bailen, Cavite',
  project_bailen_location_code: 'LA',
  project_bailen_administrator_name: 'IMELDA B. VILLALOBOS',
  project_bailen_tax_declaration_no: 'AA-06-0005-00105',
  project_bailen_pin: '022-06-0005-003-04',
  project_bailen_cadastral_lot_numbers: ['1306', '1314'],
  project_bailen_status: 'active',
  project_bailen_document_template: 'Required for Submission',
  project_bailen_default_documents: 14,
  project_bailen_required_documents: 14,
  project_bailen_optional_documents: 0,
  project_bailen_created_at: '2026-06-28',
  project_bailen_updated_at: '2026-06-28',
  project_bailen_ended_at: null,
}

const listingStats = [
  {
    label: 'Total Units',
    value: 3,
    helper: 'All Bailen unit records',
    icon: FiGrid,
  },
  {
    label: 'Available',
    value: 1,
    helper: 'Ready for reservation',
    icon: FiPlus,
  },
  {
    label: 'Sold',
    value: 1,
    helper: 'With buyer profile',
    icon: FiBarChart2,
  },
  {
    label: 'Default Docs',
    value: 14,
    helper: 'Required for buyer submission',
    icon: FiFileText,
  },
]

const recentUnits = [
  {
    unit: 'LA-0402',
    cadastral: 'CAD-001, CAD-002',
    buyer: 'Robert San Juan',
    tcp: '₱1,008,000.00',
    status: 'Sold',
  },
  {
    unit: 'LA-0403',
    cadastral: 'CAD-003',
    buyer: 'No client yet',
    tcp: '₱519,750.00',
    status: 'Available',
  },
  {
    unit: 'LA-0404',
    cadastral: 'CAD-004',
    buyer: 'No client yet',
    tcp: '₱581,900.00',
    status: 'Hold',
  },
]

const statusStyles = {
  active: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  inactive: 'border-slate-200 bg-slate-50 text-slate-600',
  ended: 'border-red-200 bg-red-50 text-red-700',
  Sold: 'border-blue-200 bg-blue-50 text-blue-700',
  Available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  Hold: 'border-amber-200 bg-amber-50 text-amber-700',
}

const formatLotNumbers = (lots = []) => {
  if (!lots.length) return '-'
  return lots.join(', ')
}

const Dashboard = () => {
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const projectSummary = useMemo(
    () => [
      {
        label: 'Project ID',
        value: project.project_bailen_id,
      },
      {
        label: 'Location Code',
        value: project.project_bailen_location_code,
      },
      {
        label: 'PIN',
        value: project.project_bailen_pin,
      },
      {
        label: 'Cadastral Lots',
        value: formatLotNumbers(project.project_bailen_cadastral_lot_numbers),
      },
      {
        label: 'Document Template',
        value: project.project_bailen_document_template,
      },
      {
        label: 'Required Documents',
        value: project.project_bailen_required_documents,
      },
    ],
    []
  )

  return (
    <main className="flex flex-col gap-6">
      <section className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title="Bailen Dashboard"
          description="Project summary, unit activity, document requirements, and project controls."
          icon={FiMapPin}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={() => setShowDetailsModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 active:scale-[0.98]"
          >
            <FiEye className="h-4 w-4" />
            View Details
          </button>

          <button
            type="button"
            onClick={() => setShowEditModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 active:scale-[0.98]"
          >
            <FiEdit3 className="h-4 w-4" />
            Edit Project
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Active Project</p>
            <h2 className="mt-1 text-2xl font-bold text-slate-950">{project.project_bailen_name}</h2>
            <p className="mt-1 text-sm font-semibold text-slate-600">
              {project.project_bailen_location} • Code {project.project_bailen_location_code}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${statusStyles[project.project_bailen_status]}`}>
              {project.project_bailen_status}
            </span>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {project.project_bailen_required_documents} required docs
            </span>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {listingStats.map((item) => {
          const Icon = item.icon

          return (
            <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">{item.label}</p>
                  <h3 className="mt-2 text-3xl font-bold text-slate-950">{item.value}</h3>
                  <p className="mt-2 text-sm text-slate-500">{item.helper}</p>
                </div>

                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            </div>
          )
        })}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-5">
            <h2 className="text-lg font-bold text-slate-950">Project Details</h2>
            <p className="mt-1 text-sm text-slate-500">Main project information for Bailen records.</p>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2">
            {projectSummary.map((item) => (
              <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{item.label}</p>
                <p className="mt-2 text-sm font-bold text-slate-950">{item.value || '-'}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-2 border-t border-slate-200 p-5 sm:flex-row">
            <button
              type="button"
              onClick={() => setShowDetailsModal(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <FiEye className="h-4 w-4" />
              Open Details
            </button>
            <button
              type="button"
              onClick={() => setShowEditModal(true)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <FiEdit3 className="h-4 w-4" />
              Edit Project
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              <FiPrinter className="h-4 w-4" />
              Print Price List
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">Recent Unit Records</h2>
              <p className="mt-1 text-sm text-slate-500">Latest Bailen units and buyer status.</p>
            </div>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
            >
              <FiPlus className="h-4 w-4" />
              Add Listing
            </button>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[1fr_1.4fr_1.3fr_1fr_0.8fr] bg-slate-50 px-5 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                <p>Unit</p>
                <p>Cadastral Lot Nos.</p>
                <p>Buyer</p>
                <p>TCP</p>
                <p>Status</p>
              </div>

              <div className="divide-y divide-slate-100">
                {recentUnits.map((unit) => (
                  <div key={unit.unit} className="grid grid-cols-[1fr_1.4fr_1.3fr_1fr_0.8fr] items-center px-5 py-4 text-sm">
                    <p className="font-bold text-slate-950">{unit.unit}</p>
                    <p className="font-semibold text-slate-600">{unit.cadastral}</p>
                    <p className="font-semibold text-slate-700">{unit.buyer}</p>
                    <p className="font-bold text-blue-700">{unit.tcp}</p>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[unit.status]}`}>
                      {unit.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {showDetailsModal ? (
        <ProjectDetailsModal
          project={project}
          onClose={() => setShowDetailsModal(false)}
          onEdit={() => {
            setShowDetailsModal(false)
            setShowEditModal(true)
          }}
        />
      ) : null}

      {showEditModal ? <EditProjectModal project={project} onClose={() => setShowEditModal(false)} /> : null}
    </main>
  )
}

export default Dashboard
