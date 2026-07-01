import { FiX } from "react-icons/fi";

type SellerGroupStatus = "Active" | "Inactive";

type SellerGroupRecord = {
  id: number;
  groupName: string;
  groupHead: string;
  description: string;
  bailenPoolRate: number;
  maragondonPoolRate: number;
  generalTriasPoolRate: number;
  members: number;
  activeMembers: number;
  status: SellerGroupStatus;
  createdAt: string;
};

type Props ={
    setShowDetailsModal: React.Dispatch<React.SetStateAction<boolean>>,
    setShowEditGroupModal: React.Dispatch<React.SetStateAction<boolean>>,
    selectedGroup: SellerGroupRecord | null
}

const DetailsModal = ({ setShowDetailsModal, setShowEditGroupModal, selectedGroup } : Props) => {

    if(!selectedGroup) return 

    
    const members = [
        {
        name: "CANTIGA, ROLINDA C.",
        email: "rolinda@gmail.com",
        role: "Agent",
        rate: "3%",
        status: "Active",
        },
        {
        name: "PARROCHO, JOSEPH E.",
        email: "joseph@gmail.com",
        role: "Manager",
        rate: "5%",
        status: "Active",
        },
        {
        name: "REYES, MARIA L.",
        email: "maria@gmail.com",
        role: "Broker",
        rate: "7%",
        status: "Inactive",
        },
    ];


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
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
                    onClick={() => setShowDetailsModal(false)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                  >
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
    
                <div className="overflow-y-auto px-6 py-5">
                  <div className="grid gap-5">
                    <section className="grid gap-4 md:grid-cols-4">
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
                          Bailen Pool
                        </p>
                        <h4 className="mt-2 text-2xl font-bold text-blue-700">
                          {selectedGroup.bailenPoolRate}%
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
                        <p className="text-sm font-semibold text-slate-500">
                          Status
                        </p>
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
    
                    <section className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">
                          Bailen
                        </p>
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
    
                      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                        <p className="text-sm font-semibold text-slate-500">
                          General Trias
                        </p>
                        <h4 className="mt-2 text-2xl font-bold text-slate-950">
                          {selectedGroup.generalTriasPoolRate}%
                        </h4>
                      </div>
                    </section>
    
                    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="border-b border-slate-200 px-4 py-3">
                        <h4 className="font-bold text-slate-950">Group Members</h4>
                        <p className="text-sm text-slate-500">
                          Sample member rates for design only.
                        </p>
                      </div>
    
                      <div className="overflow-x-auto">
                        <div className="min-w-[760px]">
                          <div className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
                            <p>Member</p>
                            <p>Role</p>
                            <p>Rate</p>
                            <p>Status</p>
                          </div>
    
                          <div className="divide-y divide-slate-100">
                            {members.map((member) => (
                              <div
                                key={member.email}
                                className="grid grid-cols-[1.5fr_1fr_1fr_0.8fr] items-center px-4 py-4 text-sm"
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
    
                                <p className="font-bold text-blue-700">
                                  {member.rate}
                                </p>
    
                                <span
                                  className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${
                                    member.status === "Active"
                                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                      : "border-slate-200 bg-slate-50 text-slate-500"
                                  }`}
                                >
                                  {member.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>
    
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setShowDetailsModal(false)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    Close
                  </button>
    
                  <button
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
  )
}

export default DetailsModal