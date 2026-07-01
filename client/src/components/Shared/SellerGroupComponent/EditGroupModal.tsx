import { FiX } from "react-icons/fi";

type Props = {
    setShowEditGroupModal: React.Dispatch<React.SetStateAction<boolean>>
    selectedGroup: SellerGroupRecord | null
}

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

const EditGroupModal = ({ setShowEditGroupModal, selectedGroup } : Props) => {

    if(!selectedGroup) return 
    
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">
                  Edit Seller Group
                </h3>
                <p className="text-sm text-slate-500">
                  Update group details, pool rates, and status.
                </p>
              </div>

              <button
                onClick={() => setShowEditGroupModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      Group Name
                    </p>
                    <input
                      type="text"
                      defaultValue={selectedGroup.groupName}
                      className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    />
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      Group Head
                    </p>
                    <select
                      defaultValue={selectedGroup.groupHead}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      <option value="PARROCHO, JOSEPH E.">
                        PARROCHO, JOSEPH E.
                      </option>
                      <option value="REYES, MARIA L.">REYES, MARIA L.</option>
                      <option value="Direct to Developer">
                        Direct to Developer
                      </option>
                    </select>
                  </label>
                </div>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">
                    Description
                  </p>
                  <textarea
                    rows={4}
                    defaultValue={selectedGroup.description}
                    className="resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-4">
                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      Bailen Rate
                    </p>
                    <select
                      defaultValue={selectedGroup.bailenPoolRate}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      Maragondon Rate
                    </p>
                    <select
                      defaultValue={selectedGroup.maragondonPoolRate}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">
                      General Trias Rate
                    </p>
                    <select
                      defaultValue={selectedGroup.generalTriasPoolRate}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((rate) => (
                        <option key={rate} value={rate}>
                          {rate}%
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex flex-col gap-2">
                    <p className="text-sm font-bold text-slate-700">Status</p>
                    <select
                      defaultValue={selectedGroup.status}
                      className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowEditGroupModal(false)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>

              <button className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">
                Save Changes
              </button>
            </div>
          </div>
        </div>
  )
        
  
}

export default EditGroupModal