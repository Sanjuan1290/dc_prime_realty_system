import { useState } from 'react'
import { FiCheckCircle, FiClock, FiUploadCloud } from 'react-icons/fi'
import UploadDocumentModal from './UploadDocumentModal'

const Documents = () => {
  const [showUploadDocumentModal, setShowUploadDocumentModal] = useState(false)

  const documents = [
    { name: 'Valid Government ID', required: true, status: 'Approved', date: '2026-07-01' },
    { name: 'Proof of Billing', required: true, status: 'Submitted', date: '2026-07-01' },
    { name: 'Proof of Income', required: true, status: 'Missing', date: '-' },
    { name: 'Signed Reservation Form', required: true, status: 'Approved', date: '2026-07-01' },
  ]

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-950">Documents</h2>
          <p className="text-sm text-slate-500">Checklist is based on the saved listing document snapshot.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowUploadDocumentModal(true)}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          <FiUploadCloud className="h-4 w-4" />
          Upload Document
        </button>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          ['Total', '4'],
          ['Required', '4'],
          ['Approved', '2'],
          ['Missing', '1'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-bold text-slate-500">{label}</p>
            <h3 className="mt-2 text-xl font-bold text-slate-950">{value}</h3>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <div className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.9fr] bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-500">
          <p>Document</p>
          <p>Required</p>
          <p>Status</p>
          <p>Date Submitted</p>
        </div>
        <div className="divide-y divide-slate-100">
          {documents.map((doc) => (
            <div key={doc.name} className="grid grid-cols-[1.4fr_0.7fr_0.8fr_0.9fr] items-center px-4 py-4 text-sm">
              <p className="font-bold text-slate-950">{doc.name}</p>
              <p className="font-semibold text-slate-700">{doc.required ? 'Yes' : 'No'}</p>
              <span className={`flex w-fit items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold ${
                doc.status === 'Approved'
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : doc.status === 'Submitted'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-amber-200 bg-amber-50 text-amber-700'
              }`}>
                {doc.status === 'Missing' ? <FiClock className="h-3.5 w-3.5" /> : <FiCheckCircle className="h-3.5 w-3.5" />}
                {doc.status}
              </span>
              <p className="font-semibold text-slate-700">{doc.date}</p>
            </div>
          ))}
        </div>
      </div>

      {showUploadDocumentModal ? <UploadDocumentModal setShowUploadDocumentModal={setShowUploadDocumentModal} /> : null}
    </div>
  )
}

export default Documents
