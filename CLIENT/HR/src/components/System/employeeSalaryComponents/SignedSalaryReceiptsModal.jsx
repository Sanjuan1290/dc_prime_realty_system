// Signed receipt uploads and protected viewing remain blocked until Batch 9.
const SignedSalaryReceiptsModal = ({ onClose }) => <div role="dialog" aria-modal="true" className="fixed inset-0 z-[99] flex items-center justify-center bg-slate-950/60 p-4">
  <section className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"><h2 className="text-lg font-bold">Signed salary receipts</h2>
  <p className="mt-3 text-sm text-slate-600">Signed receipt upload and protected document viewing are unavailable in this staging build. Batch 9 will restore them after independent HR file access is tested.</p>
  <button type="button" onClick={onClose} className="mt-5 rounded-lg bg-slate-900 px-4 py-2 text-white">Close</button></section></div>
export default SignedSalaryReceiptsModal
