import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiUsers, FiX } from "react-icons/fi";
import StatusAlert from "../../Shared/StatusAlert";
import { useFetch, useFetchPut } from "../../../utils/useFetch";

const rateOptions = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const normalizeRateValue = (value, fallback = 8) => {
  const numericValue = Number(value);
  return String(rateOptions.includes(numericValue) ? numericValue : fallback);
};

const normalizeProjectRates = (projects = [], currentRates = []) => {
  const rateMap = new Map((currentRates || []).map((rate) => [Number(rate.lot_project_id), rate]));

  return projects.map((project) => {
    const projectId = Number(project.lot_project_id || project.id);
    const savedRate = rateMap.get(projectId)?.seller_group_pool_rate;

    return {
      lot_project_id: projectId,
      lot_project_name: project.lot_project_name || project.label,
      lot_project_location_code: project.lot_project_location_code,
      seller_group_pool_rate: normalizeRateValue(savedRate),
    };
  });
};

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved }) => {
  const queryClient = useQueryClient();
  const [warning, setWarning] = useState("");
  const [projectRates, setProjectRates] = useState(selectedGroup?.project_rates || []);
  const [form, setForm] = useState({
    seller_group_name: selectedGroup?.seller_group_name || "",
    seller_group_head_user_id: selectedGroup?.seller_group_head_user_id ? String(selectedGroup.seller_group_head_user_id) : "",
    seller_group_description: selectedGroup?.seller_group_description || "",
    seller_group_status: selectedGroup?.seller_group_status || "active",
  });

  const { data: parentData, isLoading: isParentsLoading, isError: isParentsError, error: parentsError } = useQuery({
    queryKey: ["parent-sellers"],
    queryFn: () => useFetch("/accredited/parents"),
  });

  const { data: projectData, isLoading: isProjectsLoading, isError: isProjectsError, error: projectsError } = useQuery({
    queryKey: ["lot-project-options"],
    queryFn: () => useFetch("/projects/lot-projects/options"),
  });

  const parentSellers = parentData?.data || [];
  const lotProjects = projectData?.data || [];

  useEffect(() => {
    if (!lotProjects.length) return;
    setProjectRates(normalizeProjectRates(lotProjects, selectedGroup?.project_rates || []));
  }, [lotProjects.length, selectedGroup?.seller_group_id]);

  const createMutation = useMutation({
    mutationFn: () => useFetchPut(`/seller-groups/edit/${selectedGroup.seller_group_id}`, { ...form, project_rates: projectRates }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
      queryClient.invalidateQueries({ queryKey: ["seller-group-options"] });
      setShowEditGroupModal(false);
      onSaved?.(data.message || "Seller group updated successfully.");
    },
    onError: (error) => setWarning(error.message),
  });

  const updateForm = (field, value) => {
    setWarning("");
    setForm((currentForm) => ({ ...currentForm, [field]: value }));
  };

  const updateProjectRate = (projectId, value) => {
    setProjectRates((current) => current.map((rate) => Number(rate.lot_project_id) === Number(projectId) ? { ...rate, seller_group_pool_rate: value } : rate));
  };

  const handleSubmit = () => {
    setWarning("");
    if (!form.seller_group_name.trim()) {
      setWarning("Seller group name is required.");
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Edit Seller Group</h3>
            <p className="text-sm text-slate-500">Add a group, assign head, and set project pool rates.</p>
          </div>
          <button type="button" onClick={() => setShowEditGroupModal(false)} disabled={createMutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {createMutation.isPending ? <StatusAlert type="loading" message="Saving seller group and project rates..." /> : null}
            {isParentsLoading || isProjectsLoading ? <StatusAlert type="loading" message="Loading parent sellers and lot projects..." /> : null}
            {isParentsError ? <StatusAlert type="error" message={parentsError?.message || "Failed to load parent sellers."} /> : null}
            {isProjectsError ? <StatusAlert type="error" message={projectsError?.message || "Failed to load lot projects."} /> : null}
            {warning ? <StatusAlert type="warning" message={warning} /> : null}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-3"><FiUsers className="h-5 w-5 text-blue-700" /><div><h4 className="font-bold text-slate-950">Group Information</h4><p className="text-sm text-slate-500">Pool rate must be between 6% and 15%.</p></div></div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Group Name</p><input type="text" value={form.seller_group_name} onChange={(event) => updateForm("seller_group_name", event.target.value)} placeholder="Example: Prime External Realty" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Group Head</p><select value={form.seller_group_head_user_id} onChange={(event) => updateForm("seller_group_head_user_id", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="">No head assigned</option>{parentSellers.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name}</option>)}</select></label>
            </div>

            <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Description</p><textarea rows={4} value={form.seller_group_description} onChange={(event) => updateForm("seller_group_description", event.target.value)} placeholder="Describe this seller group..." className="resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>

            <div className="grid gap-4 md:grid-cols-4">
              {projectRates.map((rate) => (
                <label key={rate.lot_project_id} className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">{rate.lot_project_name} Pool</p><select value={rate.seller_group_pool_rate} onChange={(event) => updateProjectRate(rate.lot_project_id, event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">{rateOptions.map((option) => <option key={option} value={option}>{option}%</option>)}</select></label>
              ))}
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Status</p><select value={form.seller_group_status} onChange={(event) => updateForm("seller_group_status", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={createMutation.isPending} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button><button type="button" disabled={createMutation.isPending} onClick={handleSubmit} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{createMutation.isPending ? "Saving..." : "Save Changes"}</button></div>
      </div>
    </div>
  );
};

export default EditGroupModal;
