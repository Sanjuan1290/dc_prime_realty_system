import { useMemo, useState } from 'react';
import { FiAlertCircle, FiCheckCircle, FiPlus, FiRotateCcw, FiSave, FiTrash2, FiX } from 'react-icons/fi';
import StatusAlert from '../../../../Shared/StatusAlert';

const normalizeLot = (lot) => {
  if (typeof lot === 'string') {
    return {
      bailen_cadastral_lot_number_id: null,
      bailen_cadastral_lot_number: lot,
      bailen_cadastral_lot_number_status: 'active',
      used_count: 0,
      used_by_units: '',
      is_new: true,
    };
  }

  return {
    bailen_cadastral_lot_number_id: lot.bailen_cadastral_lot_number_id || null,
    bailen_cadastral_lot_number: lot.bailen_cadastral_lot_number || '',
    bailen_cadastral_lot_number_status: lot.bailen_cadastral_lot_number_status || 'active',
    used_count: Number(lot.used_count || 0),
    used_by_units: lot.used_by_units || '',
    is_new: false,
  };
};

const Field = ({ label, value, onChange, placeholder, required = false }) => (
  <label className="flex flex-col gap-2">
    <span className="text-sm font-bold text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </span>
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
    />
  </label>
);

const EditProjectModal = ({ project, onClose, onSave, isSaving = false }) => {
  const [form, setForm] = useState({
    project_bailen_name: project?.project_bailen_name || '',
    project_bailen_location: project?.project_bailen_location || '',
    project_bailen_location_code: project?.project_bailen_location_code || 'LA',
    project_bailen_administrator_name: project?.project_bailen_administrator_name || '',
    project_bailen_tax_declaration_no: project?.project_bailen_tax_declaration_no || '',
    project_bailen_pin: project?.project_bailen_pin || '',
    project_bailen_status: project?.project_bailen_status || 'active',
  });

  const [lotNumbers, setLotNumbers] = useState(() => {
    const lots = project?.cadastral_lots?.length
      ? project.cadastral_lots
      : project?.project_bailen_cadastral_lot_numbers || [];

    return lots.map(normalizeLot);
  });

  const [newLotNumber, setNewLotNumber] = useState('');
  const [localAlert, setLocalAlert] = useState(null);

  const activeLots = useMemo(
    () => lotNumbers.filter((lot) => lot.bailen_cadastral_lot_number_status === 'active'),
    [lotNumbers]
  );

  const hiddenLots = useMemo(
    () => lotNumbers.filter((lot) => lot.bailen_cadastral_lot_number_status === 'inactive'),
    [lotNumbers]
  );

  const updateField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const addLotNumber = () => {
    const lotNumber = newLotNumber.trim();

    if (!lotNumber) {
      setLocalAlert({ type: 'warning', message: 'Enter a cadastral lot number first.' });
      return;
    }

    const isDuplicate = lotNumbers.some(
      (lot) => lot.bailen_cadastral_lot_number.toLowerCase() === lotNumber.toLowerCase()
    );

    if (isDuplicate) {
      setLotNumbers((current) =>
        current.map((lot) =>
          lot.bailen_cadastral_lot_number.toLowerCase() === lotNumber.toLowerCase()
            ? { ...lot, bailen_cadastral_lot_number_status: 'active' }
            : lot
        )
      );
      setNewLotNumber('');
      setLocalAlert({ type: 'success', message: 'Existing cadastral lot restored.' });
      return;
    }

    setLotNumbers((current) => [
      ...current,
      {
        bailen_cadastral_lot_number_id: null,
        bailen_cadastral_lot_number: lotNumber,
        bailen_cadastral_lot_number_status: 'active',
        used_count: 0,
        used_by_units: '',
        is_new: true,
      },
    ]);
    setNewLotNumber('');
    setLocalAlert(null);
  };

  const hideLotNumber = (lotNumber) => {
    setLotNumbers((current) =>
      current.map((lot) =>
        lot.bailen_cadastral_lot_number === lotNumber
          ? { ...lot, bailen_cadastral_lot_number_status: 'inactive' }
          : lot
      )
    );
  };

  const restoreLotNumber = (lotNumber) => {
    setLotNumbers((current) =>
      current.map((lot) =>
        lot.bailen_cadastral_lot_number === lotNumber
          ? { ...lot, bailen_cadastral_lot_number_status: 'active' }
          : lot
      )
    );
  };

  const removeDraftLot = (lotNumber) => {
    setLotNumbers((current) =>
      current.filter((lot) => lot.bailen_cadastral_lot_number !== lotNumber)
    );
  };

  const handleSubmit = (event) => {
    event.preventDefault();

    if (!form.project_bailen_name.trim()) {
      setLocalAlert({ type: 'error', message: 'Project name is required.' });
      return;
    }

    if (!form.project_bailen_location.trim()) {
      setLocalAlert({ type: 'error', message: 'Project location is required.' });
      return;
    }

    if (!form.project_bailen_location_code.trim()) {
      setLocalAlert({ type: 'error', message: 'Location code is required.' });
      return;
    }

    onSave({
      ...form,
      project_bailen_location_code: form.project_bailen_location_code.trim().toUpperCase(),
      cadastral_lot_numbers: activeLots.map((lot) => lot.bailen_cadastral_lot_number),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <form onSubmit={handleSubmit} className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-950">Edit Bailen Project</h2>
            <p className="mt-1 text-sm text-slate-500">
              Update project details. Cadastral lots used by listings will be hidden from new listings instead of deleted.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label="Close edit project modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          {localAlert ? (
            <StatusAlert
              type={localAlert.type}
              message={localAlert.message}
              onClose={() => setLocalAlert(null)}
              className="mb-4"
            />
          ) : null}

          {isSaving ? (
            <StatusAlert type="loading" message="Saving project changes..." className="mb-4" />
          ) : null}

          <section className="grid gap-4 md:grid-cols-2">
            <Field
              label="Project Name"
              value={form.project_bailen_name}
              onChange={(value) => updateField('project_bailen_name', value)}
              placeholder="Bailen Project"
              required
            />
            <Field
              label="Location"
              value={form.project_bailen_location}
              onChange={(value) => updateField('project_bailen_location', value)}
              placeholder="Bailen, Cavite"
              required
            />
            <Field
              label="Location Code"
              value={form.project_bailen_location_code}
              onChange={(value) => updateField('project_bailen_location_code', value)}
              placeholder="LA"
              required
            />
            <Field
              label="Administrator"
              value={form.project_bailen_administrator_name}
              onChange={(value) => updateField('project_bailen_administrator_name', value)}
              placeholder="Administrator name"
            />
            <Field
              label="Tax Declaration No."
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

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Status</span>
              <select
                value={form.project_bailen_status}
                onChange={(event) => updateField('project_bailen_status', event.target.value)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </section>

          <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-950">Cadastral Lot Numbers</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Hide old lots instead of deleting them. Old listings will keep their history.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  value={newLotNumber}
                  onChange={(event) => setNewLotNumber(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addLotNumber();
                    }
                  }}
                  placeholder="Example: CAD-010"
                  className="h-11 min-w-[220px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
                <button
                  type="button"
                  onClick={addLotNumber}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-[0.98]"
                >
                  <FiPlus className="h-4 w-4" />
                  Add Lot
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-950">Active Lots</h4>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {activeLots.length} active
                  </span>
                </div>

                <div className="space-y-2">
                  {activeLots.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                      No active cadastral lots.
                    </p>
                  ) : (
                    activeLots.map((lot) => (
                      <div key={lot.bailen_cadastral_lot_number} className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-950">{lot.bailen_cadastral_lot_number}</p>
                            {lot.used_count > 0 ? (
                              <p className="mt-1 text-xs font-semibold text-amber-700">
                                Used by {lot.used_by_units}. Hiding this will only remove it from new listings.
                              </p>
                            ) : (
                              <p className="mt-1 text-xs font-semibold text-slate-500">Not used by any listing yet.</p>
                            )}
                          </div>

                          {lot.is_new ? (
                            <button
                              type="button"
                              onClick={() => removeDraftLot(lot.bailen_cadastral_lot_number)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 text-xs font-bold text-red-700 transition hover:bg-red-100"
                            >
                              <FiTrash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => hideLotNumber(lot.bailen_cadastral_lot_number)}
                              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-700 transition hover:bg-amber-100"
                            >
                              <FiAlertCircle className="h-3.5 w-3.5" />
                              Hide
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="font-bold text-slate-950">Hidden Lots</h4>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                    {hiddenLots.length} hidden
                  </span>
                </div>

                <div className="space-y-2">
                  {hiddenLots.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-slate-200 p-4 text-sm font-semibold text-slate-500">
                      No hidden cadastral lots.
                    </p>
                  ) : (
                    hiddenLots.map((lot) => (
                      <div key={lot.bailen_cadastral_lot_number} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="font-bold text-slate-950">{lot.bailen_cadastral_lot_number}</p>
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {lot.used_count > 0 ? `Still visible on old listings: ${lot.used_by_units}` : 'Hidden from new listing selection.'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => restoreLotNumber(lot.bailen_cadastral_lot_number)}
                            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100"
                          >
                            <FiRotateCcw className="h-3.5 w-3.5" />
                            Restore
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <FiCheckCircle className="h-4 w-4 animate-pulse" /> : <FiSave className="h-4 w-4" />}
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditProjectModal;
