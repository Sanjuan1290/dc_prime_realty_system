import { useState } from "react";
import { FiEdit2, FiSave, FiX } from "react-icons/fi";

const sampleMembers = [
  {
    accredited_seller_id: 1,
    user_id: 2,
    full_name: "MARIA REYES DELA CRUZ",
    email: "maria@dcprime.test",
    role: "broker_network_manager",
    reports_under_user_id: null,
    reports_under_name: null,
    accredited_seller_assigned_rate_bailen: 8,
    accredited_seller_assigned_rate_maragondon: 8,
    accredited_seller_assigned_rate_general_trias: 7,
    accredited_seller_status: "active",
  },
  {
    accredited_seller_id: 2,
    user_id: 3,
    full_name: "JUAN LAZARO SANTOS",
    email: "juan@dcprime.test",
    role: "broker",
    reports_under_user_id: 2,
    reports_under_name: "MARIA REYES DELA CRUZ",
    accredited_seller_assigned_rate_bailen: 7,
    accredited_seller_assigned_rate_maragondon: 7,
    accredited_seller_assigned_rate_general_trias: 6,
    accredited_seller_status: "active",
  },
  {
    accredited_seller_id: 3,
    user_id: 4,
    full_name: "LEA GARCIA RAMOS",
    email: "lea@dcprime.test",
    role: "agent",
    reports_under_user_id: 3,
    reports_under_name: "JUAN LAZARO SANTOS",
    accredited_seller_assigned_rate_bailen: 3,
    accredited_seller_assigned_rate_maragondon: 3,
    accredited_seller_assigned_rate_general_trias: 2.5,
    accredited_seller_status: "inactive",
  },
];

const DetailsModal = ({
  setShowDetailsModal,
  setShowEditGroupModal,
  selectedGroup,
  onSaved,
}) => {
  const [details, setDetails] = useState({
    group: selectedGroup,
    members: sampleMembers,
  });
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [warning, setWarning] = useState("");

  const updateMemberRate = (memberId, field, value) => {
    const numericValue = Number(value);

    setDetails((currentDetails) => ({
      ...currentDetails,
      members: currentDetails.members.map((member) =>
        member.accredited_seller_id === memberId
          ? {
              ...member,
              [field]: Number.isNaN(numericValue) ? 0 : numericValue,
            }
          : member
      ),
    }));
  };

  const saveMemberRates = (member) => {
    setIsSaving(true);
    setWarning("");

    setTimeout(() => {
      setIsSaving(false);
      setEditingMemberId(null);
      onSaved?.(`${member.full_name} rates updated.`);
    }, 200);
  };

  const group = details.group;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">{group.seller_group_name}</h3>
            <p className="text-sm text-slate-500">Seller group details, pool rates, and members.</p>
          </div>

          <button
            type="button"
            onClick={() => setShowDetailsModal(false)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
          >
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          <div className="grid gap-5">
            {warning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
                {warning}
              </div>
            )}

            <section className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Group Head</p>
                <h4 className="mt-2 font-bold text-slate-950">
                  {group.group_head_name || "No head assigned"}
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Bailen Pool</p>
                <h4 className="mt-2 text-2xl font-bold text-blue-700">
                  {Number(group.seller_group_pool_rate_bailen).toFixed(2)}%
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Members</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">{group.member_count}</h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Status</p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                    group.seller_group_status === "active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {group.seller_group_status}
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-bold text-slate-950">Description</h4>
              <p className="mt-2 text-sm text-slate-600">
                {group.seller_group_description || "No description"}
              </p>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Bailen</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {Number(group.seller_group_pool_rate_bailen).toFixed(2)}%
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Maragondon</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {Number(group.seller_group_pool_rate_maragondon).toFixed(2)}%
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">General Trias</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {Number(group.seller_group_pool_rate_general_trias).toFixed(2)}%
                </h4>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h4 className="font-bold text-slate-950">Group Members</h4>
                <p className="text-sm text-slate-500">
                  Click Edit Rate to convert project rate columns into number inputs. Backend validates the full parent rate chain.
                </p>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[1250px]">
                  <div className="grid grid-cols-[1.45fr_0.9fr_1.25fr_0.8fr_0.9fr_0.9fr_0.75fr_1fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <p>Member</p>
                    <p>Role</p>
                    <p>Reports Under</p>
                    <p>Bailen Rate</p>
                    <p>Maragondon Rate</p>
                    <p>Gentri Rate</p>
                    <p>Status</p>
                    <p className="text-right">Action</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {details.members.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <p className="font-bold text-slate-700">No members yet.</p>
                        <p className="text-sm text-slate-500">Create seller users and assign them to this group.</p>
                      </div>
                    ) : (
                      details.members.map((member) => {
                        const isEditing = editingMemberId === member.accredited_seller_id;

                        return (
                          <div
                            key={member.accredited_seller_id}
                            className="grid grid-cols-[1.45fr_0.9fr_1.25fr_0.8fr_0.9fr_0.9fr_0.75fr_1fr] items-center px-4 py-4 text-sm"
                          >
                            <div>
                              <p className="font-bold text-slate-950">{member.full_name}</p>
                              <p className="text-sm text-slate-500">{member.email}</p>
                            </div>

                            <p className="font-semibold capitalize text-slate-700">
                              {member.role.replaceAll("_", " ")}
                            </p>

                            <div>
                              <p className="font-semibold text-slate-800">
                                {member.reports_under_name || "Direct to Developer"}
                              </p>
                              <p className="text-xs text-slate-500">
                                {member.reports_under_user_id ? "Included in hierarchy chain" : "No parent seller"}
                              </p>
                            </div>

                            <div>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={member.accredited_seller_assigned_rate_bailen}
                                  onChange={(event) =>
                                    updateMemberRate(
                                      member.accredited_seller_id,
                                      "accredited_seller_assigned_rate_bailen",
                                      event.target.value
                                    )
                                  }
                                  className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-blue-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                                />
                              ) : (
                                <p className="font-bold text-blue-700">
                                  {Number(member.accredited_seller_assigned_rate_bailen).toFixed(2)}%
                                </p>
                              )}
                            </div>

                            <div>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={member.accredited_seller_assigned_rate_maragondon}
                                  onChange={(event) =>
                                    updateMemberRate(
                                      member.accredited_seller_id,
                                      "accredited_seller_assigned_rate_maragondon",
                                      event.target.value
                                    )
                                  }
                                  className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-blue-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                                />
                              ) : (
                                <p className="font-bold text-slate-700">
                                  {Number(member.accredited_seller_assigned_rate_maragondon).toFixed(2)}%
                                </p>
                              )}
                            </div>

                            <div>
                              {isEditing ? (
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={member.accredited_seller_assigned_rate_general_trias}
                                  onChange={(event) =>
                                    updateMemberRate(
                                      member.accredited_seller_id,
                                      "accredited_seller_assigned_rate_general_trias",
                                      event.target.value
                                    )
                                  }
                                  className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-blue-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                                />
                              ) : (
                                <p className="font-bold text-slate-700">
                                  {Number(member.accredited_seller_assigned_rate_general_trias).toFixed(2)}%
                                </p>
                              )}
                            </div>

                            <span
                              className={`w-fit rounded-full border px-3 py-1 text-xs font-bold capitalize ${
                                member.accredited_seller_status === "active"
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                  : "border-slate-200 bg-slate-50 text-slate-500"
                              }`}
                            >
                              {member.accredited_seller_status}
                            </span>

                            <div className="flex justify-end">
                              {isEditing ? (
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => saveMemberRates(member)}
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                >
                                  <FiSave className="h-3.5 w-3.5" />
                                  Save Rate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(member.accredited_seller_id)}
                                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                >
                                  <FiEdit2 className="h-3.5 w-3.5" />
                                  Edit Rate
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setShowDetailsModal(false)}
            className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
          >
            Close
          </button>

          <button
            type="button"
            onClick={() => {
              setShowDetailsModal(false);
              setShowEditGroupModal(true);
            }}
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Edit Group
          </button>
        </div>
      </div>
    </div>
  );
};

export default DetailsModal;
