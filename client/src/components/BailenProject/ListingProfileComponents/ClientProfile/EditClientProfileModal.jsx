import { FiSave, FiX } from 'react-icons/fi'

const EditClientProfileModal = ({ setShowEditClientProfileModal }) => {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Edit Client Profile</h3>
            <p className="text-sm text-slate-500">Buyer details saved for this listing only.</p>
          </div>
          <button type="button" onClick={() => setShowEditClientProfileModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto p-6">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['First Name', 'Robert'],
              ['Middle Name', 'Cortez'],
              ['Last Name', 'San Juan'],
              ['Contact Number', '0917 000 0000'],
              ['Email', 'robert@email.com'],
              ['Civil Status', 'Single'],
              ['Birthdate', '2005-07-01'],
              ['TIN', '000-000-000'],
              ['Valid ID No.', 'ID-00001'],
            ].map(([label, value]) => (
              <label key={label} className="flex flex-col gap-2">
                <span className="text-sm font-bold text-slate-700">{label}</span>
                <input defaultValue={value} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
              </label>
            ))}

            <label className="flex flex-col gap-2 md:col-span-3">
              <span className="text-sm font-bold text-slate-700">Home Address</span>
              <input defaultValue="Indang, Cavite" className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-slate-200 p-4">
            <h4 className="font-bold text-slate-950">Work / Business Information</h4>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {[
                ['Occupation / Business', 'Web Developer'],
                ['Employer / Company', 'D&C Prime Realty'],
                ['Monthly Income', '16000'],
                ['Office Address', 'Indang, Cavite'],
              ].map(([label, value]) => (
                <label key={label} className="flex flex-col gap-2">
                  <span className="text-sm font-bold text-slate-700">{label}</span>
                  <input defaultValue={value} className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
                </label>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-4">
            <h4 className="font-bold text-blue-900">Second Buyer</h4>
            <p className="mt-1 text-sm text-blue-800">Show this section when buyer type is spouses or and-account.</p>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowEditClientProfileModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">
            <FiSave className="h-4 w-4" />
            Save Client Profile
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditClientProfileModal
