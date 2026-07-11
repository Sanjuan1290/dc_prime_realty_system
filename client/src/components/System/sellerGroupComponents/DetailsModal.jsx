import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FiEdit2, FiSave, FiSearch, FiX } from "react-icons/fi";
import StatusAlert from "../../Shared/StatusAlert";
import { useFetch, useFetchPatch } from "../../../utils/useFetch";

const roleLabels = {
  broker_network_manager: "Broker Network Manager",
  broker: "Broker",
  manager: "Manager",
  agent: "Agent",
};

const getRateValue = (rates = [], projectId) => {
  const rate = rates.find((item) => Number(item.lot_project_id) === Number(projectId));
  return rate?.accredited_seller_project_rate ?? 0;
};

const DetailsModal = ({ setShowDetailsModal, setShowEditGroupModal, selectedGroup, onSaved }) => {
  const queryClient = useQueryClient();
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [warning, setWarning] = useState("");
  const [localMembers, setLocalMembers] = useState(null);
  const [memberSearch, setMemberSearch] = useState("");

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["seller-group-details", selectedGroup.seller_group_id],
    queryFn: () => useFetch(`/seller-groups/${selectedGroup.seller_group_id}`),
  });

  const details = data?.data || { group: selectedGroup, members: [] };
  const group = details.group;
  const members = localMembers || details.members || [];
  const projectRates = group?.project_rates || [];
  const filteredMembers = members.filter((member) => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return true;
    return [member.full_name, member.email, member.role, member.reports_under_name]
      .some((value) => String(value || "").toLowerCase().includes(keyword));
  });

  const updateRateMutation = useMutation({
    mutationFn: (member) =>
      useFetchPatch(`/seller-groups/${selectedGroup.seller_group_id}/members/${member.accredited_seller_id}/rates`, {
        project_rates: member.project_rates || [],
      }),
    onSuccess: (result) => {
      setEditingMemberId(null);
      setWarning("");
      setLocalMembers(null);
      queryClient.invalidateQueries({ queryKey: ["seller-group-details", selectedGroup.seller_group_id] });
      queryClient.invalidateQueries({ queryKey: ["seller-groups"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["accredited"] });
      onSaved?.(result.message || "Seller rate updated.");
    },
    onError: (error) => setWarning(error.message),
  });

  const updateMemberRate = (memberId, projectId, value) => {
    const sourceMembers = localMembers || details.members || [];
    setLocalMembers(
      sourceMembers.map((member) => {
        if (member.accredited_seller_id !== memberId) return member;

        const existingRates = member.project_rates || [];
        const hasRate = existingRates.some((rate) => Number(rate.lot_project_id) === Number(projectId));
        const nextRates = hasRate
          ? existingRates.map((rate) =>
              Number(rate.lot_project_id) === Number(projectId)
                ? { ...rate, accredited_seller_project_rate: value }
                : rate
            )
          : [
              ...existingRates,
              {
                lot_project_id: projectId,
                accredited_seller_project_rate: value,
              },
            ];

        return { ...member, project_rates: nextRates };
      })
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div><h3 className="text-xl font-bold text-slate-950">{group.seller_group_name}</h3><p className="text-sm text-slate-500">Seller group details, pool rates, and members.</p></div>
          <button type="button" onClick={() => setShowDetailsModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"><FiX className="h-5 w-5" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {updateRateMutation.isPending ? <StatusAlert type="loading" message="Saving seller project rates..." /> : null}
            {warning ? <StatusAlert type="warning" message={warning} /> : null}
            {isLoading ? <StatusAlert type="loading" message="Loading group details..." /> : null}
            {isError ? <StatusAlert type="error" message={error?.message || "Failed to load group details."} /> : null}

            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-500">Group Head</p><h4 className="mt-2 font-bold text-slate-950">{group.group_head_name || "No head assigned"}</h4></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-500">Project Rates</p><h4 className="mt-2 text-2xl font-bold text-blue-700">{projectRates.length}</h4></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-500">Members</p><h4 className="mt-2 text-2xl font-bold text-slate-950">{group.member_count}</h4></div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-500">Status</p><span className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${group.seller_group_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{group.seller_group_status}</span></div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><h4 className="font-bold text-slate-950">Description</h4><p className="mt-2 text-sm text-slate-600">{group.seller_group_description || "No description"}</p></section>

            <section className="grid gap-4 md:grid-cols-3">
              {projectRates.length ? projectRates.map((rate) => (
                <div key={rate.lot_project_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-sm font-semibold text-slate-500">{rate.lot_project_name}</p><h4 className="mt-2 text-2xl font-bold text-slate-950">{Number(rate.seller_group_pool_rate || 0).toFixed(2)}%</h4></div>
              )) : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-4 text-sm font-semibold text-slate-500">No project pool rates yet.</div>}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3"><h4 className="font-bold text-slate-950">Group Members</h4><p className="text-sm text-slate-500">Click Edit Rate to convert project rate columns into number inputs. Group Head uses this same project-rate table.</p><div className="relative mt-3 max-w-md"><FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search member name, email, or role..." className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50" /></div></div>
              <div className="overflow-x-auto"><div className="min-w-[1250px]">
                <div className="grid grid-cols-[1.45fr_0.9fr_1.25fr_2fr_0.75fr_1fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500"><p>Member</p><p>Role</p><p>Reports Under</p><p>Project Rates</p><p>Status</p><p className="text-right">Action</p></div>
                <div className="divide-y divide-slate-100">
                  {filteredMembers.length === 0 ? <div className="px-4 py-10 text-center"><p className="font-bold text-slate-700">No matching members.</p><p className="text-sm text-slate-500">Try another name, email, or role.</p></div> : filteredMembers.map((member) => {
                    const isEditing = editingMemberId === member.accredited_seller_id;
                    return (
                      <div key={member.accredited_seller_id} className="grid grid-cols-[1.45fr_0.9fr_1.25fr_2fr_0.75fr_1fr] items-center px-4 py-4 text-sm">
                        <div><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-slate-950">{member.full_name}</p>{Number(group.seller_group_head_user_id) === Number(member.user_id) ? <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-amber-700 ring-1 ring-amber-100">Group Head</span> : null}</div><p className="text-sm text-slate-500">{member.email}</p></div>
                        <p className="font-semibold capitalize text-slate-700">{roleLabels[member.role] || member.role.replaceAll("_", " ")}</p>
                        <div><p className="font-semibold text-slate-800">{member.reports_under_name || "Direct to Developer"}</p><p className="text-xs text-slate-500">{member.reports_under_user_id ? "Included in hierarchy chain" : "No parent seller"}</p></div>
                        <div className="grid gap-2 md:grid-cols-2">
                          {projectRates.map((projectRate) => {
                            const value = getRateValue(member.project_rates, projectRate.lot_project_id);
                            return isEditing ? (
                              <label key={projectRate.lot_project_id} className="flex flex-col gap-1">
                                <span className="text-[11px] font-bold text-slate-500">{projectRate.lot_project_location_code || projectRate.lot_project_name}</span>
                                <input type="number" min={0} max={15} step="0.01" value={value} onChange={(event) => updateMemberRate(member.accredited_seller_id, projectRate.lot_project_id, event.target.value)} className="h-9 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-blue-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                              </label>
                            ) : (
                              <span key={projectRate.lot_project_id} className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700 ring-1 ring-blue-100">
                                {projectRate.lot_project_location_code || projectRate.lot_project_name}: {Number(value || 0).toFixed(2)}%
                              </span>
                            );
                          })}
                        </div>
                        <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${member.accredited_seller_status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-500"}`}>{member.accredited_seller_status}</span>
                        <div className="flex justify-end">{isEditing ? <button type="button" disabled={updateRateMutation.isPending} onClick={() => updateRateMutation.mutate(member)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"><FiSave className="h-3.5 w-3.5" />{updateRateMutation.isPending ? "Saving..." : "Save Rate"}</button> : <button type="button" onClick={() => setEditingMemberId(member.accredited_seller_id)} className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><FiEdit2 className="h-3.5 w-3.5" />Edit Rate</button>}</div>
                      </div>
                    );
                  })}
                </div>
              </div></div>
            </section>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end"><button type="button" onClick={() => setShowDetailsModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100">Close</button><button type="button" onClick={() => { setShowDetailsModal(false); setShowEditGroupModal(true); }} className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">Edit Group</button></div>
      </div>
    </div>
  );
};

export default DetailsModal;

