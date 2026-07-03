import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { FiEdit3, FiGrid, FiMapPin, FiPrinter, FiRefreshCw, FiShield, FiTrendingUp } from 'react-icons/fi';
import PageHeader from '../../components/Shared/PageHeader';
import StatusAlert from '../../components/Shared/StatusAlert';
import { useFetch, useFetchPut } from '../../utils/useFetch';
import EditProjectModal from '../../components/BailenProject/DashboardComponents/EditProjectModal/EditProjectModal';
import ProjectDetailsModal from '../../components/BailenProject/DashboardComponents/ProjectDetailsModal/ProjectDetailsModal';

const formatMoney = (value) => {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number(value || 0));
};

const formatNumber = (value) => new Intl.NumberFormat('en-PH').format(Number(value || 0));

const formatStatus = (value) => {
  return String(value || '-')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const statusClass = (status) => {
  const styles = {
    available: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    sold: 'border-blue-200 bg-blue-50 text-blue-700',
    hold: 'border-amber-200 bg-amber-50 text-amber-700',
    pending_for_cancellation: 'border-orange-200 bg-orange-50 text-orange-700',
    cancelled: 'border-red-200 bg-red-50 text-red-700',
    superseded: 'border-slate-200 bg-slate-50 text-slate-600',
  };

  return styles[status] || 'border-slate-200 bg-slate-50 text-slate-600';
};

const StatCard = ({ label, value, helper, icon: Icon }) => (
  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-slate-500">{label}</p>
        <h3 className="mt-2 text-2xl font-bold text-slate-950">{value}</h3>
        <p className="mt-2 text-sm text-slate-500">{helper}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const queryClient = useQueryClient();
  const [showProjectDetailsModal, setShowProjectDetailsModal] = useState(false);
  const [showEditProjectModal, setShowEditProjectModal] = useState(false);
  const [alert, setAlert] = useState(null);

  const { data, isLoading, isFetching, isError, error } = useQuery({
    queryKey: ['bailen-dashboard'],
    queryFn: () => useFetch('/bailen/dashboard'),
  });

  const project = data?.data?.project || null;
  const summary = data?.data?.summary || {};
  const recentUnits = data?.data?.recent_units || [];

  const updateProjectMutation = useMutation({
    mutationFn: (payload) => useFetchPut(`/bailen/dashboard/project/${project.project_bailen_id}`, payload),
    onMutate: () => {
      setAlert({ type: 'loading', message: 'Saving Bailen project details...' });
    },
    onSuccess: (result) => {
      setAlert({ type: 'success', message: result?.message || 'Project updated successfully.' });
      setShowEditProjectModal(false);
      queryClient.invalidateQueries({ queryKey: ['bailen-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['bailen-project'] });
      queryClient.invalidateQueries({ queryKey: ['bailen-listings'] });
    },
    onError: (mutationError) => {
      setAlert({ type: 'error', message: mutationError.message || 'Failed to update project.' });
    },
  });

  const stats = useMemo(
    () => [
      {
        label: 'Total Units',
        value: formatNumber(summary.total_units),
        helper: 'All Bailen unit records',
        icon: FiGrid,
      },
      {
        label: 'Available Units',
        value: formatNumber(summary.available_units),
        helper: 'Ready for reservation',
        icon: FiShield,
      },
      {
        label: 'Sold Units',
        value: formatNumber(summary.sold_units),
        helper: 'Active and fully paid buyers',
        icon: FiTrendingUp,
      },
      {
        label: 'Inventory Value',
        value: formatMoney(summary.total_inventory_value),
        helper: 'Based on current TCP records',
        icon: FiMapPin,
      },
    ],
    [summary]
  );

  const openPriceList = () => {
    if (!project?.project_bailen_id) return;

    window.open(
      `${import.meta.env.VITE_API_URL}/bailen/dashboard/project/${project.project_bailen_id}/price-list/print`,
      '_blank',
      'noopener,noreferrer'
    );
  };

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
            onClick={() => queryClient.invalidateQueries({ queryKey: ['bailen-dashboard'] })}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <FiRefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openPriceList}
            disabled={!project}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiPrinter className="h-4 w-4" />
            Print Price List
          </button>
          <button
            type="button"
            onClick={() => setShowEditProjectModal(true)}
            disabled={!project}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <FiEdit3 className="h-4 w-4" />
            Edit Project
          </button>
        </div>
      </section>

      {alert ? (
        <StatusAlert
          type={alert.type}
          message={alert.message}
          onClose={alert.type === 'loading' ? undefined : () => setAlert(null)}
        />
      ) : null}

      {isLoading ? <StatusAlert type="loading" message="Loading Bailen dashboard..." /> : null}
      {isError ? <StatusAlert type="error" message={error?.message || 'Failed to load Bailen dashboard.'} /> : null}

      {project ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-slate-950">{project.project_bailen_name}</h2>
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold capitalize text-emerald-700">
                  {project.project_bailen_status}
                </span>
              </div>
              <p className="mt-1 text-sm font-semibold text-slate-500">{project.project_bailen_location}</p>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-400">Location Code</p>
                  <p className="mt-1 font-bold text-slate-950">{project.project_bailen_location_code}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-400">Administrator</p>
                  <p className="mt-1 font-bold text-slate-950">{project.project_bailen_administrator_name || '-'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-400">Active Cadastral Lots</p>
                  <p className="mt-1 font-bold text-slate-950">{project.active_cadastral_lots?.length || 0}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-bold uppercase text-slate-400">Required Docs</p>
                  <p className="mt-1 font-bold text-slate-950">{project.project_bailen_required_documents || 0}</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowProjectDetailsModal(true)}
              className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              View Details
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Recent Unit Records</h2>
            <p className="text-sm text-slate-500">Latest units updated in the Bailen project.</p>
          </div>
          <p className="text-sm font-semibold text-slate-500">{recentUnits.length} shown</p>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[1fr_1fr_0.8fr_1fr_1fr_1fr_1fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Unit</p>
              <p>Cadastral</p>
              <p>Area</p>
              <p>TCP</p>
              <p>Buyer</p>
              <p>Documents</p>
              <p>Status</p>
            </div>

            <div className="divide-y divide-slate-100">
              {recentUnits.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  No recent unit records found.
                </div>
              ) : (
                recentUnits.map((unit) => (
                  <div key={unit.bailen_listing_id} className="grid grid-cols-[1fr_1fr_0.8fr_1fr_1fr_1fr_1fr] items-center px-4 py-4 text-sm">
                    <div>
                      <p className="font-bold text-slate-950">{unit.unit_code}</p>
                      <p className="text-xs font-semibold capitalize text-slate-500">{unit.lot_type}</p>
                    </div>
                    <p className="font-semibold text-slate-600">{unit.cadastral_lots || '-'}</p>
                    <p className="font-semibold text-slate-700">{formatNumber(unit.lot_area_sqm)} sqm</p>
                    <p className="font-bold text-slate-950">{formatMoney(unit.tcp)}</p>
                    <p className="font-semibold text-slate-700">{unit.buyer_name || 'No buyer'}</p>
                    <p className="font-semibold capitalize text-slate-600">{formatStatus(unit.document_status)}</p>
                    <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusClass(unit.status)}`}>
                      {formatStatus(unit.status)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </section>

      {showProjectDetailsModal && project ? (
        <ProjectDetailsModal
          project={project}
          onClose={() => setShowProjectDetailsModal(false)}
          onEdit={() => {
            setShowProjectDetailsModal(false);
            setShowEditProjectModal(true);
          }}
        />
      ) : null}

      {showEditProjectModal && project ? (
        <EditProjectModal
          project={project}
          onClose={() => setShowEditProjectModal(false)}
          onSave={(payload) => updateProjectMutation.mutate(payload)}
          isSaving={updateProjectMutation.isPending}
        />
      ) : null}
    </main>
  );
};

export default Dashboard;
