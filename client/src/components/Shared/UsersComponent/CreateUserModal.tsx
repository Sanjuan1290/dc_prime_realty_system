import React from 'react'
import { FiKey, FiMail, FiShield, FiUserCheck, FiUsers, FiX } from 'react-icons/fi'

type Props = {
    setShowCreateUser: React.Dispatch<React.SetStateAction<boolean>>
}
const CreateUserModal = ({ setShowCreateUser } : Props) => {
  return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h3 className="text-xl font-bold text-slate-950">
                  Create User
                </h3>
                <p className="text-sm text-slate-500">
                  Add account details, access role, and seller hierarchy.
                </p>
              </div>

              <button
                onClick={() => setShowCreateUser(false)}
                className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            <div className="overflow-y-auto px-6 py-5">
              <div className="grid gap-6">
                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <FiUsers className="h-5 w-5" />
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-950">
                        Personal Information
                      </h4>
                      <p className="text-sm text-slate-500">
                        Basic user profile details.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        First Name
                      </p>
                      <input
                        type="text"
                        placeholder="Example: Rolinda"
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Middle Name
                      </p>
                      <input
                        type="text"
                        placeholder="Optional"
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Last Name
                      </p>
                      <input
                        type="text"
                        placeholder="Example: Cantiga"
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">Email</p>
                      <input
                        type="email"
                        placeholder="user@gmail.com"
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>

                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Contact No.
                      </p>
                      <input
                        type="text"
                        placeholder="09XX XXX XXXX"
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-blue-700 shadow-sm">
                      <FiShield className="h-5 w-5" />
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-950">
                        Account Access
                      </h4>
                      <p className="text-sm text-slate-500">
                        Set login role and account status.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">Role</p>
                      <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option value="">Select role</option>
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
                      <p className="text-sm font-bold text-slate-700">
                        Status
                      </p>
                      <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Temporary Password
                      </p>
                      <input
                        type="text"
                        placeholder="Auto-generated later"
                        className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
                  </div>

                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                    <div className="flex gap-3">
                      <FiKey className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                      <div>
                        <p className="text-sm font-bold text-amber-800">
                          First login password change
                        </p>
                        <p className="mt-1 text-sm text-amber-700">
                          New users should be required to change their password
                          after first login.
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
                      <FiUserCheck className="h-5 w-5" />
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-950">
                        Seller Hierarchy
                      </h4>
                      <p className="text-sm text-slate-500">
                        Use this only for broker network manager, broker,
                        manager, and agent accounts.
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Seller Group
                      </p>
                      <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option value="">Select seller group</option>
                        <option value="external_realty">
                          External Realty Group
                        </option>
                        <option value="prime_sales">Prime Sales Team</option>
                        <option value="direct_sellers">Direct Sellers</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Reports Under
                      </p>
                      <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                        <option value="">Select parent seller</option>
                        <option value="direct">Direct to Developer</option>
                        <option value="joseph">PARROCHO, JOSEPH E.</option>
                        <option value="maria">REYES, MARIA L.</option>
                      </select>
                    </label>

                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Accreditation Date
                      </p>
                      <input
                        type="date"
                        className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex gap-3">
                    <FiMail className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                    <div>
                      <p className="text-sm font-bold text-blue-800">
                        Account email notice
                      </p>
                      <p className="mt-1 text-sm text-blue-700">
                        Later, the backend can email the temporary password and
                        login link after creating the account.
                      </p>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowCreateUser(false)}
                className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
              >
                Cancel
              </button>

              <button className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">
                Create User
              </button>
            </div>
          </div>
        </div>
  )
}

export default CreateUserModal