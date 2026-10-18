import { FiEdit3, FiPlusCircle, FiX } from 'react-icons/fi'

// Choose the operation first: a new-listing import must never silently edit existing units.
const ListingImportChoiceModal = ({ canCreateListings, canEditListings, onCreate, onEdit, onClose }) => (
  <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm">
    <div role="dialog" aria-modal="true" aria-labelledby="listing-import-choose-heading" className="w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
      <header className="flex items-start justify-between border-b border-slate-200 p-5">
        <div>
          <h2 id="listing-import-choose-heading" className="text-xl font-black text-slate-950">Import Excel</h2>
          <p className="mt-1 text-sm text-slate-600">What would you like to import?</p>
        </div>
        <button type="button" aria-label="Close import options" onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FiX /></button>
      </header>
      <div className="space-y-3 p-5">
        {canCreateListings ? <button type="button" onClick={onCreate} className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50">
          <FiPlusCircle className="mt-1 shrink-0 text-blue-600" size={20} />
          <span><strong className="block text-sm text-slate-950">Import New Listings</strong><span className="mt-1 block text-xs text-slate-600">Add new units from the existing Listing Import template.</span></span>
        </button> : null}
        {canEditListings ? <button type="button" onClick={onEdit} className="flex w-full items-start gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-blue-300 hover:bg-blue-50">
          <FiEdit3 className="mt-1 shrink-0 text-blue-600" size={20} />
          <span><strong className="block text-sm text-slate-950">Bulk Edit Existing Listings</strong><span className="mt-1 block text-xs text-slate-600">Upload an edited workbook from Export Listings to update existing units.</span></span>
        </button> : null}
      </div>
      <footer className="flex justify-end border-t border-slate-200 bg-slate-50 p-4"><button type="button" onClick={onClose} className="rounded-xl border border-slate-300 px-5 py-2.5 text-sm font-bold">Cancel</button></footer>
    </div>
  </div>
)

export default ListingImportChoiceModal

