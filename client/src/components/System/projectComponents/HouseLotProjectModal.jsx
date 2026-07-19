import { FiHome, FiX } from 'react-icons/fi'

const HouseLotProjectModal = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 px-5">
          <h2 className="text-base font-black text-slate-950">
            Add House & Lot Project
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close modal"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-[360px] flex-1 items-center justify-center bg-slate-50 p-5">
          <div className="text-center">
            <FiHome className="mx-auto h-10 w-10 text-slate-300" />

            <h3 className="mt-4 text-lg font-black text-slate-800">
              House & Lot Project
            </h3>

            <p className="mt-2 text-sm font-semibold text-slate-500">
              Blank for now. This modal will be designed later.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 bg-white px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-300 bg-white px-5 text-sm font-black text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

export default HouseLotProjectModal

