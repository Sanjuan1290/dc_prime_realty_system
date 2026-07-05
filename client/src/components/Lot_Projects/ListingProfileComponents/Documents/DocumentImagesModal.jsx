import { FiX } from 'react-icons/fi'

const DocumentImagesModal = ({ document, onClose }) => {
  const images = document?.images?.length ? document.images : document?.fileUrl ? [document.fileUrl] : []
  return <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4"><div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"><div className="flex items-center justify-between border-b border-slate-200 px-6 py-5"><div><h2 className="text-xl font-black text-slate-950">Document Images</h2><p className="mt-1 text-sm font-semibold text-slate-500">{document?.name}</p></div><button type="button" onClick={onClose} className="h-10 w-10 rounded-2xl text-slate-500 hover:bg-slate-100"><FiX className="mx-auto" /></button></div><div className="flex-1 overflow-y-auto bg-slate-100 p-6">{images.length ? <div className="grid gap-4 md:grid-cols-2">{images.map((image, index) => <div key={`${image}-${index}`} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"><img src={image} alt={`${document?.name || 'Document'} ${index + 1}`} className="mx-auto max-h-[580px] w-full object-contain" /></div>)}</div> : <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-semibold text-slate-500">No uploaded images available.</div>}</div></div></div>
}

export default DocumentImagesModal
