import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiUsers, FiX } from "react-icons/fi";
import StatusAlert from "../../Shared/StatusAlert";
import { useFetch, useFetchPut } from "../../../utils/useFetch";

const rateOptions = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup, onSaved }) => {
  const queryClient = useQueryClient();
  const [warning, setWarning] = useState("");
  const [form, setForm] = useState({
    seller_group_name: selectedGroup?.seller_group_name || "",
    seller_group_head_user_id: selectedGroup?.seller_group_head_user_id ? String(selectedGroup.seller_group_head_user_id) : "",
    seller_group_description: selectedGroup?.seller_group_description || "",
    seller_group_pool_rate_bailen: String(selectedGroup?.seller_group_pool_rate_bailen || 8),
    seller_group_pool_rate_maragondon: String(selectedGroup?.seller_group_pool_rate_maragondon || 8),
    seller_group_pool_rate_general_trias: String(selectedGroup?.seller_group_pool_rate_general_trias || 8),
    seller_group_status: selectedGroup?.seller_group_status || "active",
  });

  const { data: parentData, isLoading: isParentsLoading, isError: isParentsError, error: parentsError } = useQuery({
    queryKey: ["parent-sellers"],
    queryFn: () => useFetch("/accredited/parents"),
  });

  const parentSellers = parentData?.data || [];

  const editMutation = useMutation({
    mutationFn: () => useFetchPut(`/seller-groups/edit/${selectedGroup.seller_group_id}`, form),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
      setShowEditGroupModal(false);
      onSaved?.(data.message || "Seller group updated successfully.");
    },
    onError: (error) => setWarning(error.message),
  });

  const updateForm = (field, value) => setForm((currentForm) => ({ ...currentForm, [field]: value }));

  const handleSubmit = () => {
    setWarning("");
    if (!form.seller_group_name.trim()) {
      setWarning("Seller group name is required.");
      return;
    }
    editMutation.mutate();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Edit Seller Group</h3>
            <p className="text-sm text-slate-500">Update group details, group head, and project pool rates.</p>
          </div>
          <button type="button" onClick={() => setShowEditGroupModal(false)} disabled={editMutation.isPending} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {editMutation.isPending ? <StatusAlert type="loading" message="Saving seller group changes..." /> : null}
            {isParentsLoading ? <StatusAlert type="loading" message="Loading parent seller options..." /> : null}
            {isParentsError ? <StatusAlert type="error" message={parentsError?.message || "Failed to load parent sellers."} /> : null}
            {warning ? <StatusAlert type="warning" message={warning} /> : null}
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <div className="flex items-center gap-3"><FiUsers className="h-5 w-5 text-blue-700" /><div><h4 className="font-bold text-slate-950">Group Information</h4><p className="text-sm text-slate-500">Pool rate must be between 6% and 15%.</p></div></div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Group Name</p><input type="text" value={form.seller_group_name} onChange={(event) => updateForm("seller_group_name", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Group Head</p><select value={form.seller_group_head_user_id} onChange={(event) => updateForm("seller_group_head_user_id", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="">No head assigned</option>{parentSellers.map((seller) => <option key={seller.user_id} value={seller.user_id}>{seller.full_name}</option>)}</select></label>
            </div>

            <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Description</p><textarea rows={4} value={form.seller_group_description} onChange={(event) => updateForm("seller_group_description", event.target.value)} className="resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" /></label>

            <div className="grid gap-4 md:grid-cols-4">
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Bailen Pool</p><select value={form.seller_group_pool_rate_bailen} onChange={(event) => updateForm("seller_group_pool_rate_bailen", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">{rateOptions.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Maragondon Pool</p><select value={form.seller_group_pool_rate_maragondon} onChange={(event) => updateForm("seller_group_pool_rate_maragondon", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">{rateOptions.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Gentri Pool</p><select value={form.seller_group_pool_rate_general_trias} onChange={(event) => updateForm("seller_group_pool_rate_general_trias", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">{rateOptions.map((rate) => <option key={rate} value={rate}>{rate}%</option>)}</select></label>
              <label className="flex flex-col gap-2"><p className="text-sm font-bold text-slate-700">Status</p><select value={form.seller_group_status} onChange={(event) => updateForm("seller_group_status", event.target.value)} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowEditGroupModal(false)} disabled={editMutation.isPending} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">Cancel</button><button type="button" disabled={editMutation.isPending} onClick={handleSubmit} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300">{editMutation.isPending ? "Saving..." : "Save Changes"}</button></div>
      </div>
    </div>
  );
};

export default EditGroupModal;

