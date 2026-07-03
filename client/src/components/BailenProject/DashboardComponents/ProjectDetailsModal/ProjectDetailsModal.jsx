import { FiEdit3, FiPrinter, FiX } from 'react-icons/fi';

const DetailItem = ({ label, value }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 text-sm font-bold text-slate-900">{value || '-'}</p>
  </div>
);

const StatusBadge = ({ status }) => {
  const isActive = status === 'active';

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-bold capitalize ${isActive ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {status || '-'}
    </span>
  );
};

const ProjectDetailsModal = ({ project, onClose, onEdit }) => {
  const lots = project?.cadastral_lots || [];
  const activeLots = lots.filter((lot) => lot.bailen_cadastral_lot_number_status === 'active');
  const hiddenLots = lots.filter((lot) => lot.bailen_cadastral_lot_number_status === 'inactive');

  const openPriceList = () => {
    window.open(
      `${import.meta.env.VITE_API_URL}/bailen/dashboard/project/${project.project_bailen_id}/price-list/print`,
      '_blank',
      'noopener,noreferrer'
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Project Details</h2>
            <p className="mt-1 text-sm text-slate-500">Project information, document setup, and cadastral lot usage.</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close project details"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <DetailItem label="ID" value={project.project_bailen_id} />
            <DetailItem label="Name" value={project.project_bailen_name} />
            <DetailItem label="Location" value={project.project_bailen_location} />
            <DetailItem label="Location Code" value={project.project_bailen_location_code} />
            <DetailItem label="Administrator" value={project.project_bailen_administrator_name} />
            <DetailItem label="Tax Declaration No." value={project.project_bailen_tax_declaration_no} />
            <DetailItem label="PIN" value={project.project_bailen_pin} />
            <DetailItem label="Status" value={project.project_bailen_status} />
            <DetailItem label="Document Template" value={project.project_bailen_document_template} />
            <DetailItem label="Default Documents" value={project.project_bailen_default_documents} />
            <DetailItem label="Required Documents" value={project.project_bailen_required_documents} />
            <DetailItem label="Optional Documents" value={project.project_bailen_optional_documents} />
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-bold text-slate-950">Cadastral Lot Numbers</h3>
                <p className="text-sm text-slate-500">Hidden lots are not shown when creating new listings, but old listings keep them.</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">{activeLots.length} active</span>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{hiddenLots.length} hidden</span>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {lots.length === 0 ? (
                <div className="p-5 text-sm font-semibold text-slate-500">No cadastral lot numbers yet.</div>
              ) : (
                lots.map((lot) => (
                  <div key={lot.bailen_cadastral_lot_number_id || lot.bailen_cadastral_lot_number} className="grid gap-3 p-4 text-sm md:grid-cols-[1fr_auto_auto] md:items-center">
                    <div>
                      <p className="font-bold text-slate-950">{lot.bailen_cadastral_lot_number}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        {lot.used_count > 0
                          ? `Used by ${lot.used_by_units}. Hiding this lot will not remove it from old listings.`
                          : 'Not used by any listing yet.'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">{Number(lot.used_count || 0)} linked unit(s)</p>
                    <StatusBadge status={lot.bailen_cadastral_lot_number_status} />
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="font-bold text-slate-950">Default Documents</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {(project.default_documents || []).length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">No default documents assigned.</p>
              ) : (
                project.default_documents.map((document) => (
                  <div key={document.project_bailen_default_document_id || document.document_id} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="font-bold text-slate-950">{document.document_name}</p>
                    <p className="mt-1 text-xs font-semibold capitalize text-slate-500">{document.requirement} • {document.status}</p>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={openPriceList}
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
            Edit Project
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectDetailsModal;
