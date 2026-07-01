import PageHeader from "../../components/Shared/PageHeader";
import { FaUserPlus } from "react-icons/fa";
import {
  FiEdit2,
  FiEye,
  FiPlus,
  FiSearch,
  FiTrash2,
} from "react-icons/fi";
import { NavLink } from "react-router-dom";
import { useState } from "react";
import NewGroupModal from "../../components/System/SellerGroupComponent/NewGroupModal";
import EditGroupModal from "../../components/System/SellerGroupComponent/EditGroupModal";
import DetailsModal from "../../components/System/SellerGroupComponent/DetailsModal";

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

const SellerGroup = () => {
  const [showNewGroupModal, setShowNewGroupModal] = useState(false);
  const [showEditGroupModal, setShowEditGroupModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<SellerGroupRecord | null>(
    null
  );

  const sellerGroups: SellerGroupRecord[] = [
    {
      id: 1,
      groupName: "Prime Sales Team",
      groupHead: "PARROCHO, JOSEPH E.",
      description: "Internal sales group for Bailen lot selling.",
      bailenPoolRate: 10,
      maragondonPoolRate: 8,
      members: 12,
      activeMembers: 10,
      status: "Active",
      createdAt: "2026-06-28",
    },
    {
      id: 2,
      groupName: "External Realty Group",
      groupHead: "REYES, MARIA L.",
      description: "External realty partners and broker network.",
      bailenPoolRate: 12,
      maragondonPoolRate: 10,
      members: 8,
      activeMembers: 7,
      status: "Active",
      createdAt: "2026-06-25",
    },
    {
      id: 3,
      groupName: "Direct Sellers",
      groupHead: "Direct to Developer",
      description: "Direct sellers handled by admin.",
      bailenPoolRate: 6,
      maragondonPoolRate: 6,
      members: 4,
      activeMembers: 3,
      status: "Inactive",
      createdAt: "2026-06-20",
    },
  ];


  const openDetailsModal = (group: SellerGroupRecord) => {
    setSelectedGroup(group);
    setShowDetailsModal(true);
  };

  const openEditModal = (group: SellerGroupRecord) => {
    setSelectedGroup(group);
    setShowEditGroupModal(true);
  };

  return (
    <main className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <PageHeader
          title={"Seller Groups"}
          description={
            "Manage seller groups, hierarchy, pool rates, and member commission rates."
          }
          icon={FaUserPlus}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <NavLink
            to={"/super_admin/users"}
            className="inline-flex h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
          >
            Back to Users
          </NavLink>

          <button
            onClick={() => setShowNewGroupModal(true)}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            <FiPlus className="h-4 w-4" />
            New Group
          </button>
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Groups</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">
            {sellerGroups.length}
          </h3>
          <p className="mt-2 text-sm text-slate-500">All seller groups</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Active Groups</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">
            {
              sellerGroups.filter((group) => group.status === "Active")
                .length
            }
          </h3>
          <p className="mt-2 text-sm text-slate-500">Available for assignment</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">Total Members</p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">
            {sellerGroups.reduce((total, group) => total + group.members, 0)}
          </h3>
          <p className="mt-2 text-sm text-slate-500">Members across groups</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-semibold text-slate-500">
            Avg. Bailen Pool
          </p>
          <h3 className="mt-2 text-3xl font-bold text-slate-950">
            {(
              sellerGroups.reduce(
                (total, group) => total + group.bailenPoolRate,
                0
              ) / sellerGroups.length
            ).toFixed(1)}
            %
          </h3>
          <p className="mt-2 text-sm text-slate-500">Sample group average</p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-950">
              Seller Group Records
            </h2>
            <p className="text-sm text-slate-500">
              View pool rates, group heads, member count, and group status.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <label className="relative block">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                placeholder="Search group or head"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50 md:w-80"
              />
            </label>

            <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
              <option value="all_status">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1050px]">
            <div className="grid grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_0.8fr_1fr] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
              <p>Group</p>
              <p>Group Head</p>
              <p>Bailen Pool</p>
              <p>Members</p>
              <p>Created</p>
              <p>Status</p>
              <p className="text-right">Action</p>
            </div>

            <div className="divide-y divide-slate-100">
              {sellerGroups.map((group) => (
                <div
                  key={group.id}
                  className="grid grid-cols-[1.4fr_1.2fr_1fr_1fr_1fr_0.8fr_1fr] items-center px-4 py-4 text-sm transition hover:bg-slate-50"
                >
                  <div>
                    <p className="font-bold text-slate-950">
                      {group.groupName}
                    </p>
                    <p className="text-sm text-slate-500">
                      {group.description}
                    </p>
                  </div>

                  <p className="font-semibold text-slate-700">
                    {group.groupHead}
                  </p>

                  <div>
                    <p className="font-bold text-blue-700">
                      {group.bailenPoolRate}%
                    </p>
                    <p className="text-xs text-slate-500">Bailen Project</p>
                  </div>

                  <div>
                    <p className="font-bold text-slate-950">
                      {group.members}
                    </p>
                    <p className="text-xs text-slate-500">
                      {group.activeMembers} active
                    </p>
                  </div>

                  <p className="font-semibold text-slate-700">
                    {group.createdAt}
                  </p>

                  <div>
                    <span
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                        group.status === "Active"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {group.status}
                    </span>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => openDetailsModal(group)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FiEye className="h-3.5 w-3.5" />
                      View
                    </button>

                    <button
                      onClick={() => openEditModal(group)}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    >
                      <FiEdit2 className="h-3.5 w-3.5" />
                      Edit
                    </button>

                    <button className="inline-flex h-9 items-center justify-center rounded-lg border border-red-200 bg-white px-3 text-xs font-bold text-red-600 transition hover:bg-red-50">
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {showNewGroupModal && <NewGroupModal setShowNewGroupModal={setShowNewGroupModal}/> }

      {showEditGroupModal && selectedGroup && ( <EditGroupModal setShowEditGroupModal={setShowEditGroupModal} selectedGroup={selectedGroup}/> )}

      {showDetailsModal && selectedGroup && (
        <DetailsModal
        setShowDetailsModal={ setShowDetailsModal } 
        setShowEditGroupModal={setShowEditGroupModal} 
        selectedGroup={selectedGroup}/>) }
      
    </main>
  );
};

export default SellerGroup;