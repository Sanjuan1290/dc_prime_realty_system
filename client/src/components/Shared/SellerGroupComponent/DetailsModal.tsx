import { useState } from "react";
import { FiEdit2, FiSave, FiX } from "react-icons/fi";

type SellerGroupStatus = "Active" | "Inactive";

type SellerGroupRecord = {
  id: number;
  groupName: string;
  groupHead: string;
  description: string;
  bailenPoolRate: number;
  maragondonPoolRate: number;
  members: number;
  activeMembers: number;
  status: SellerGroupStatus;
  createdAt: string;
};

type Props = {
  setShowDetailsModal: React.Dispatch<React.SetStateAction<boolean>>;
  setShowEditGroupModal: React.Dispatch<React.SetStateAction<boolean>>;
  selectedGroup: SellerGroupRecord | null;
};

type GroupMember = {
  id: number;
  name: string;
  email: string;
  role: "Agent" | "Manager" | "Broker" | "Broker Network Manager";
  bailen_rate: number;
  maragondon_rate: number;
  status: "Active" | "Inactive";
};

const DetailsModal = ({
  setShowDetailsModal,
  setShowEditGroupModal,
  selectedGroup,
}: Props) => {
  const [editingMemberId, setEditingMemberId] = useState<number | null>(null);

  const [members, setMembers] = useState<GroupMember[]>([
    {
      id: 1,
      name: "CANTIGA, ROLINDA C.",
      email: "rolinda@gmail.com",
      role: "Agent",
      bailen_rate: 3,
      maragondon_rate: 4,
      status: "Active",
    },
    {
      id: 2,
      name: "PARROCHO, JOSEPH E.",
      email: "joseph@gmail.com",
      role: "Manager",
      bailen_rate: 5,
      maragondon_rate: 4,
      status: "Active",
    },
    {
      id: 3,
      name: "REYES, MARIA L.",
      email: "maria@gmail.com",
      role: "Broker",
      bailen_rate: 7,
      maragondon_rate: 5,
      status: "Inactive",
    },
  ]);

  if (!selectedGroup) return null;

  const updateMemberRate = (
    memberId: number,
    field: "bailen_rate" | "maragondon_rate",
    value: string
  ) => {
    const numericValue = Number(value);

    setMembers((prevMembers) =>
      prevMembers.map((member) =>
        member.id === memberId
          ? {
              ...member,
              [field]: Number.isNaN(numericValue) ? 0 : numericValue,
            }
          : member
      )
    );
  };

  const handleEditRate = (memberId: number) => {
    setEditingMemberId(memberId);
  };

  const handleSaveRate = () => {
    setEditingMemberId(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">
              {selectedGroup.groupName}
            </h3>
            <p className="text-sm text-slate-500">
              Seller group details, pool rates, and members.
            </p>
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
            <section className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Group Head
                </p>
                <h4 className="mt-2 font-bold text-slate-950">
                  {selectedGroup.groupHead}
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Members
                </p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {selectedGroup.members}
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Status</p>
                <span
                  className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                    selectedGroup.status === "Active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-50 text-slate-500"
                  }`}
                >
                  {selectedGroup.status}
                </span>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h4 className="font-bold text-slate-950">Description</h4>
              <p className="mt-2 text-sm text-slate-600">
                {selectedGroup.description}
              </p>
            </section>

            <section className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">Bailen</p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {selectedGroup.bailenPoolRate}%
                </h4>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-semibold text-slate-500">
                  Maragondon
                </p>
                <h4 className="mt-2 text-2xl font-bold text-slate-950">
                  {selectedGroup.maragondonPoolRate}%
                </h4>
              </div>

            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 px-4 py-3">
                <h4 className="font-bold text-slate-950">Group Members</h4>
                <p className="text-sm text-slate-500">
                  Edit member rates per project. Click Edit Rate to make the
                  Bailen and Maragondon rate columns editable.
                </p>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[980px]">
                  <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr_1fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                    <p>Member</p>
                    <p>Role</p>
                    <p>Bailen Rate</p>
                    <p>Maragondon Rate</p>
                    <p>Status</p>
                    <p className="text-right">Action</p>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {members.map((member) => {
                      const isEditing = editingMemberId === member.id;

                      return (
                        <div
                          key={member.id}
                          className="grid grid-cols-[1.5fr_1fr_1fr_1fr_0.8fr_1fr] items-center px-4 py-4 text-sm"
                        >
                          <div>
                            <p className="font-bold text-slate-950">
                              {member.name}
                            </p>
                            <p className="text-sm text-slate-500">
                              {member.email}
                            </p>
                          </div>

                          <p className="font-semibold text-slate-700">
                            {member.role}
                          </p>

                          <div>
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={member.bailen_rate}
                                onChange={(event) =>
                                  updateMemberRate(
                                    member.id,
                                    "bailen_rate",
                                    event.target.value
                                  )
                                }
                                className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-blue-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                              />
                            ) : (
                              <p className="font-bold text-blue-700">
                                {member.bailen_rate}%
                              </p>
                            )}
                          </div>

                          <div>
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                step="0.01"
                                value={member.maragondon_rate}
                                onChange={(event) =>
                                  updateMemberRate(
                                    member.id,
                                    "maragondon_rate",
                                    event.target.value
                                  )
                                }
                                className="h-10 w-24 rounded-xl border border-slate-200 px-3 text-sm font-bold text-blue-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                              />
                            ) : (
                              <p className="font-bold text-blue-700">
                                {member.maragondon_rate}%
                              </p>
                            )}
                          </div>

                          <span
                            className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                              member.status === "Active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 bg-slate-50 text-slate-500"
                            }`}
                          >
                            {member.status}
                          </span>

                          <div className="flex justify-end">
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={handleSaveRate}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 text-xs font-bold text-white transition hover:bg-blue-700"
                              >
                                <FiSave className="h-3.5 w-3.5" />
                                Save Rate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleEditRate(member.id)}
                                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                              >
                                <FiEdit2 className="h-3.5 w-3.5" />
                                Edit Rate
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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