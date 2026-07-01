import { FiUsers, FiX } from "react-icons/fi"

type Props = {
    setShowNewGroupModal: React.Dispatch<React.SetStateAction<boolean>>
}

const NewGroupModal = ({ setShowNewGroupModal } : Props) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
              <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      New Seller Group
                    </h3>
                    <p className="text-sm text-slate-500">
                      Add a group, assign head, and set project pool rates.
                    </p>
                  </div>
    
                  <button
                    onClick={() => setShowNewGroupModal(false)}
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
                          placeholder="Example: Prime Sales Team"
                          className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                        />
                      </label>
    
                      <label className="flex flex-col gap-2">
                        <p className="text-sm font-bold text-slate-700">
                          Group Head
                        </p>
                        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                          <option value="">Select group head</option>
                          <option value="joseph">PARROCHO, JOSEPH E.</option>
                          <option value="maria">REYES, MARIA L.</option>
                          <option value="direct">Direct to Developer</option>
                        </select>
                      </label>
                    </div>
    
                    <label className="flex flex-col gap-2">
                      <p className="text-sm font-bold text-slate-700">
                        Description
                      </p>
                      <textarea
                        rows={4}
                        placeholder="Short group description"
                        className="resize-none rounded-xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                      />
                    </label>
    
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-4">
                        <h4 className="font-bold text-slate-950">
                          Project Pool Rates
                        </h4>
                        <p className="text-sm text-slate-500">
                          Set pool rate per project. Bailen is the current active
                          project.
                        </p>
                      </div>
    
                      <div className="grid gap-4 md:grid-cols-3">
                        <label className="flex flex-col gap-2">
                          <p className="text-sm font-bold text-slate-700">
                            Bailen Pool Rate
                          </p>
                          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                            {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                          </select>
                        </label>
    
                        <label className="flex flex-col gap-2">
                          <p className="text-sm font-bold text-slate-700">
                            Maragondon Pool Rate
                          </p>
                          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                            {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                          </select>
                        </label>
    
                        <label className="flex flex-col gap-2">
                          <p className="text-sm font-bold text-slate-700">
                            General Trias Pool Rate
                          </p>
                          <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                            {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((rate) => (
                              <option key={rate} value={rate}>
                                {rate}%
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                    </div>
    
                    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                      <div className="flex gap-3">
                        <FiUsers className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
                        <div>
                          <p className="text-sm font-bold text-blue-800">
                            Member rates
                          </p>
                          <p className="mt-1 text-sm text-blue-700">
                            Individual member commission rates can be managed after
                            creating the seller group.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
    
                <div className="flex flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => setShowNewGroupModal(false)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
    
                  <button className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white transition hover:bg-blue-700">
                    Create Group
                  </button>
                </div>
              </div>
            </div>
  )
}

export default NewGroupModal