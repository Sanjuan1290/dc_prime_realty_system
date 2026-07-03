import { FiUploadCloud, FiX } from 'react-icons/fi'

const UploadDocumentModal = ({ setShowUploadDocumentModal }) => {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h3 className="text-xl font-bold text-slate-950">Upload Client Document</h3>
            <p className="text-sm text-slate-500">Attach a file to this listing checklist.</p>
          </div>
          <button type="button" onClick={() => setShowUploadDocumentModal(false)} className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-950">
            <FiX className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          <div className="grid gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Document Type</span>
              <select className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50">
                <option>Valid Government ID</option>
                <option>Proof of Billing</option>
                <option>Proof of Income</option>
                <option>Signed Reservation Form</option>
              </select>
            </label>

            <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center transition hover:border-blue-300 hover:bg-blue-50">
              <FiUploadCloud className="h-10 w-10 text-blue-700" />
              <div>
                <p className="font-bold text-slate-950">Click to upload file</p>
                <p className="text-sm text-slate-500">PDF, JPG, or PNG</p>
              </div>
              <input type="file" className="hidden" />
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-bold text-slate-700">Remarks</span>
              <textarea rows={4} className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="Optional note" />
            </label>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => setShowUploadDocumentModal(false)} className="h-11 rounded-xl border border-slate-200 bg-white px-5 text-sm font-bold text-slate-700 hover:bg-slate-50">Cancel</button>
          <button type="button" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-bold text-white hover:bg-blue-700">
            <FiUploadCloud className="h-4 w-4" />
            Upload Document
          </button>
        </div>
      </div>
    </div>
  )
}

export default UploadDocumentModal
