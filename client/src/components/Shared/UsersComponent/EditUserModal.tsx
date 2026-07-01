import { FiX } from 'react-icons/fi'

type Props = {
    setShowEditUser: React.Dispatch<React.SetStateAction<boolean>>
}
const EditUserModal = ({ setShowEditUser } : Props) => {
  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">Edit User</h3>
                <p className="text-sm text-slate-500">
                  Update account details and hierarchy.
                </p>
              </div>

              <button
                onClick={() => setShowEditUser(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-5 px-6 py-5">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Full Name</p>
                  <input
                    type="text"
                    defaultValue="CANTIGA, ROLINDA C."
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Email</p>
                  <input
                    type="text"
                    defaultValue="rolinda@gmail.com"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Role</p>
                  <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                    <option value="super_admin">Super Admin</option>
                    <option value="admin">Admin</option>
                    <option value="broker_network_manager">
                      Broker Network Manager
                    </option>
                    <option value="broker">Broker</option>
                    <option value="manager">Manager</option>
                    <option value="agent">Agent</option>
                  </select>
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">Status</p>
                  <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">
                    Contact No.
                  </p>
                  <input
                    type="text"
                    defaultValue="0917 000 0000"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">
                    Accreditation Date
                  </p>
                  <input
                    type="date"
                    defaultValue="2026-06-28"
                    className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  />
                </label>

                <label className="flex flex-col gap-2">
                  <p className="text-sm font-bold text-slate-700">
                    Reports Under
                  </p>
                  <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                    <option value="joseph">PARROCHO, JOSEPH E.</option>
                    <option value="direct">Direct to Developer</option>
                    <option value="none">No Parent</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowEditUser(false)}
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

export default EditUserModal